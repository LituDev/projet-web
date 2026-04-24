// Importe les images déposées dans ce dossier vers server/uploads/produits/.
// Chaque fichier est apparié à un produit par son nom (slug insensible aux
// accents/casse) ou par son UUID. Les fichiers sources restent en place,
// l'opération est idempotente : on peut relancer sans effet de bord.
//
//   node db/seed-images/import.js            # import réel
//   node db/seed-images/import.js --dry-run  # diagnostic sans écriture

import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, basename, extname, join } from 'node:path';
import { promises as fs } from 'node:fs';
import { createRequire } from 'node:module';
import pg from 'pg';

const requireFromServer = createRequire(resolve(dirname(fileURLToPath(import.meta.url)), '../../server/package.json'));
const sharp = requireFromServer('sharp');

const here = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(here, '../../.env') });

const SOURCE_DIR = here;
const UPLOADS_DIR = resolve(here, '../../server/uploads/produits');
const CACHE_DIR = resolve(here, '../../server/uploads/cache');
const MAX_ORIGINAL_WIDTH = 2000;
const ORIGINAL_QUALITY = 88;

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const DIACRITICS_RE = new RegExp('[\\u0300-\\u036f]', 'g');
function slugify(s) {
  return s
    .toLowerCase()
    .normalize('NFD').replace(DIACRITICS_RE, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('DATABASE_URL manquant.');
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();

  const { rows: produits } = await client.query('SELECT id, nom FROM produit');
  const bySlug = new Map();
  for (const p of produits) {
    const s = slugify(p.nom);
    if (!bySlug.has(s)) bySlug.set(s, []);
    bySlug.get(s).push(p);
  }

  const entries = await fs.readdir(SOURCE_DIR, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile() && IMAGE_EXTS.has(extname(e.name).toLowerCase()))
    .map((e) => e.name);

  if (files.length === 0) {
    console.log(`Aucune image dans ${SOURCE_DIR}`);
    await client.end();
    return;
  }

  if (!DRY_RUN) {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    await fs.mkdir(CACHE_DIR, { recursive: true });
  }

  let ok = 0;
  let skipped = 0;
  let errors = 0;

  for (const file of files) {
    const stem = basename(file, extname(file));
    const slug = slugify(stem);
    let targets = [];

    if (UUID_RE.test(stem)) {
      const produit = produits.find((p) => p.id.toLowerCase() === stem.toLowerCase()) || null;
      if (!produit) {
        console.warn(`· ${file} → UUID inconnu`);
        skipped++;
        continue;
      }
      targets = [produit];
    } else {
      targets = bySlug.get(slug) || [];
      if (targets.length === 0) {
        console.warn(`· ${file} → aucun produit "${stem}"`);
        skipped++;
        continue;
      }
    }

    const multi = targets.length > 1 ? ` (×${targets.length})` : '';
    console.log(`✓ ${file} → ${targets[0].nom}${multi}`);
    if (DRY_RUN) {
      ok += targets.length;
      continue;
    }

    try {
      const src = join(SOURCE_DIR, file);
      const webp = await sharp(src, { failOn: 'error' })
        .rotate()
        .resize({ width: MAX_ORIGINAL_WIDTH, withoutEnlargement: true })
        .webp({ quality: ORIGINAL_QUALITY })
        .toBuffer();

      for (const produit of targets) {
        await fs.writeFile(join(UPLOADS_DIR, `${produit.id}.webp`), webp);

        const cached = await fs.readdir(CACHE_DIR).catch(() => []);
        await Promise.all(
          cached
            .filter((f) => f.startsWith(`${produit.id}-`))
            .map((f) => fs.unlink(join(CACHE_DIR, f)).catch(() => {})),
        );

        await client.query(
          'UPDATE produit SET image_filename = $1, updated_at = NOW() WHERE id = $2',
          [`${produit.id}.webp`, produit.id],
        );
      }
      ok += targets.length;
    } catch (err) {
      console.error(`✗ ${file} → ${err.message}`);
      errors++;
    }
  }

  await client.end();
  console.log(
    `\n${ok} importé(s), ${skipped} ignoré(s), ${errors} erreur(s)${DRY_RUN ? ' (dry-run)' : ''}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
