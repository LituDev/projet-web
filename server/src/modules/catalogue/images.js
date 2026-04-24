import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { promises as fs, createReadStream, mkdirSync } from 'node:fs';
import path from 'node:path';
import { query } from '../../db/pool.js';
import { HttpError } from '../../middlewares/error.js';
import { requireRole } from '../../middlewares/auth.js';

const UPLOADS_ROOT = path.resolve(process.cwd(), 'uploads');
const ORIGINALS_DIR = path.join(UPLOADS_ROOT, 'produits');
const CACHE_DIR = path.join(UPLOADS_ROOT, 'cache');

mkdirSync(ORIGINALS_DIR, { recursive: true });
mkdirSync(CACHE_DIR, { recursive: true });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_SIZES = new Set(['400x260', '800x500', '1200x750']);
const MAX_ORIGINAL_WIDTH = 2000;
const ORIGINAL_QUALITY = 88;
const VARIANT_QUALITY = 82;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) cb(null, true);
    else cb(new HttpError(415, 'unsupported_media_type', 'Format accepté : JPEG, PNG, WebP.'));
  },
});

function handleUpload(req, res, next) {
  upload.single('image')(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new HttpError(413, 'file_too_large', 'Image trop volumineuse (max 5 Mo).'));
      }
      return next(new HttpError(400, 'bad_upload', err.message));
    }
    next(err);
  });
}

async function assertProduitOwner(produitId, session) {
  const { rows } = await query(
    `SELECT e.owner_id
     FROM produit p JOIN entreprise e ON e.id = p.entreprise_id
     WHERE p.id = $1`,
    [produitId],
  );
  if (rows.length === 0) throw new HttpError(404, 'not_found', 'Produit introuvable.');
  if (session.user.role !== 'admin' && rows[0].owner_id !== session.user.id) {
    throw new HttpError(403, 'forbidden', 'Vous ne pouvez pas modifier ce produit.');
  }
}

async function clearCacheFor(produitId) {
  const entries = await fs.readdir(CACHE_DIR).catch(() => []);
  await Promise.all(
    entries
      .filter((f) => f.startsWith(`${produitId}-`))
      .map((f) => fs.unlink(path.join(CACHE_DIR, f)).catch(() => {})),
  );
}

const placeholderCache = new Map();
async function getPlaceholder(w, h) {
  const key = `${w}x${h}`;
  let buf = placeholderCache.get(key);
  if (!buf) {
    buf = await sharp({
      create: { width: w, height: h, channels: 3, background: { r: 230, g: 230, b: 225 } },
    })
      .webp({ quality: 70 })
      .toBuffer();
    placeholderCache.set(key, buf);
  }
  return buf;
}

export const uploadProduitImage = [
  requireRole('seller', 'admin'),
  handleUpload,
  async (req, res, next) => {
    try {
      const produitId = req.params.id;
      if (!UUID_RE.test(produitId)) throw new HttpError(400, 'bad_request', 'Identifiant invalide.');
      if (!req.file) throw new HttpError(400, 'bad_request', 'Fichier manquant (champ "image").');
      await assertProduitOwner(produitId, req.session);

      const filename = `${produitId}.webp`;
      const destPath = path.join(ORIGINALS_DIR, filename);

      await sharp(req.file.buffer, { failOn: 'error' })
        .rotate()
        .resize({ width: MAX_ORIGINAL_WIDTH, withoutEnlargement: true })
        .webp({ quality: ORIGINAL_QUALITY })
        .toFile(destPath);

      await query('UPDATE produit SET image_filename = $1, updated_at = NOW() WHERE id = $2', [
        filename,
        produitId,
      ]);
      await clearCacheFor(produitId);

      res.status(201).json({ image_filename: filename });
    } catch (err) {
      if (err?.message?.startsWith('Input buffer')) {
        return next(new HttpError(400, 'bad_image', 'Image illisible ou corrompue.'));
      }
      next(err);
    }
  },
];

export const deleteProduitImage = [
  requireRole('seller', 'admin'),
  async (req, res, next) => {
    try {
      const produitId = req.params.id;
      if (!UUID_RE.test(produitId)) throw new HttpError(400, 'bad_request', 'Identifiant invalide.');
      await assertProduitOwner(produitId, req.session);

      await fs.unlink(path.join(ORIGINALS_DIR, `${produitId}.webp`)).catch(() => {});
      await clearCacheFor(produitId);
      await query('UPDATE produit SET image_filename = NULL, updated_at = NOW() WHERE id = $1', [
        produitId,
      ]);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
];

const imagesRouter = express.Router();

imagesRouter.get('/:w/:h/:produitId', async (req, res, next) => {
  try {
    const w = Number.parseInt(req.params.w, 10);
    const h = Number.parseInt(req.params.h, 10);
    const key = `${w}x${h}`;
    if (!Number.isFinite(w) || !Number.isFinite(h) || !ALLOWED_SIZES.has(key)) {
      throw new HttpError(400, 'bad_size', 'Taille non autorisée.');
    }
    const produitId = req.params.produitId;
    if (!UUID_RE.test(produitId)) throw new HttpError(400, 'bad_request', 'Identifiant invalide.');

    const cachePath = path.join(CACHE_DIR, `${produitId}-${key}.webp`);
    const originalPath = path.join(ORIGINALS_DIR, `${produitId}.webp`);

    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    if (await fs.stat(cachePath).then(() => true, () => false)) {
      return createReadStream(cachePath).pipe(res);
    }

    const originalExists = await fs.stat(originalPath).then(() => true, () => false);
    if (!originalExists) {
      res.setHeader('Cache-Control', 'public, max-age=60');
      const buf = await getPlaceholder(w, h);
      return res.end(buf);
    }

    await sharp(originalPath)
      .resize(w, h, { fit: 'cover', position: 'attention' })
      .webp({ quality: VARIANT_QUALITY })
      .toFile(cachePath);

    createReadStream(cachePath).pipe(res);
  } catch (err) {
    next(err);
  }
});

export default imagesRouter;
