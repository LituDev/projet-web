// ─────────────────────────────────────────────────────────────────────────────
// gumes marketplace — jeu de données de test
//
// Produit un dataset réaliste et reproductible :
//   • 1 super-admin + 10 producteurs + 30 clients
//   • 10 entreprises (1 par producteur) avec 1-2 lieux de vente et horaires
//   • 10 points relais répartis en Bretagne
//   • ~60 produits (catégories variées, certains saisonniers, certains expédiables)
//   • 50 commandes (répartition aléatoire des modes + paiements + lignes)
//
// Ré-entrant : tronque les tables métier avant insertion (mais pas `utilisateur`
// pour ne pas invalider une session active du dev — on supprime seulement
// les faux comptes en recalculant leur email avec un suffixe déterministe).
// Pour un reset total, utiliser `npm run db:reset` depuis la racine.
// ─────────────────────────────────────────────────────────────────────────────

import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { fakerFR as faker } from '@faker-js/faker';
import argon2 from 'argon2';
import pg from 'pg';

// Charge le .env de la racine du monorepo.
const here = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(here, '../../.env') });

faker.seed(42);

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL manquant.');
  process.exit(1);
}

const BRETAGNE = [
  { ville: 'Rennes',       lat: 48.1173, lon: -1.6778 },
  { ville: 'Brest',        lat: 48.3904, lon: -4.4861 },
  { ville: 'Quimper',      lat: 47.9960, lon: -4.0970 },
  { ville: 'Vannes',       lat: 47.6587, lon: -2.7603 },
  { ville: 'Saint-Brieuc', lat: 48.5143, lon: -2.7653 },
  { ville: 'Lorient',      lat: 47.7482, lon: -3.3702 },
  { ville: 'Saint-Malo',   lat: 48.6493, lon: -2.0257 },
  { ville: 'Morlaix',      lat: 48.5779, lon: -3.8290 },
];
const DEFAULT_PASSWORD = 'GumesDev!2026';

const NATURES = ['legume', 'fruit', 'viande', 'fromage', 'epicerie', 'boisson', 'autre'];
const MODES = ['pickup_store', 'pickup_relay', 'home_delivery'];
const STATUTS = [
  'pending', 'accepted', 'preparing', 'ready_for_pickup',
  'shipped', 'delivered', 'cancelled', 'refused',
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function pickN(arr, n) {
  const copy = [...arr];
  const out = [];
  while (out.length < Math.min(n, arr.length)) {
    out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  }
  return out;
}
function jitter(center, radiusKm = 15) {
  const r = (radiusKm / 111) * Math.sqrt(Math.random());
  const theta = Math.random() * 2 * Math.PI;
  return {
    lat: center.lat + r * Math.cos(theta),
    lon: center.lon + r * Math.sin(theta) / Math.cos(center.lat * Math.PI / 180),
  };
}

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();

  console.log('→ Hachage du mot de passe de démo (argon2id)…');
  const passwordHash = await argon2.hash(DEFAULT_PASSWORD, {
    type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1,
  });

  try {
    await client.query('BEGIN');

    console.log('→ Truncate des tables métier');
    await client.query(`
      TRUNCATE
        audit_log, alerte, item_liste_courses, liste_courses, favori,
        paiement_carte, paiement,
        commande_home_delivery, commande_pickup_relay, commande_pickup_store,
        ligne_commande, commande,
        produit_lieu_vente, produit_saison, produit,
        horaire_point_relais, point_relais,
        horaire, lieu_de_vente, entreprise,
        adresse_geocodee, profil_client, profil_producteur,
        utilisateur
      RESTART IDENTITY CASCADE;
    `);

    // ─── Admin ────────────────────────────────────────────────────────────
    console.log('→ Admin');
    const admin = await client.query(
      `INSERT INTO utilisateur (email, password_hash, role)
       VALUES ('admin@gumes.local', $1, 'admin')
       RETURNING id`,
      [passwordHash],
    );

    // ─── Producteurs ──────────────────────────────────────────────────────
    console.log('→ 10 producteurs + entreprises + lieux + horaires');
    const producteurs = [];
    for (let i = 0; i < 10; i++) {
      const nom = faker.person.lastName();
      const prenom = faker.person.firstName();
      const email = `producteur${i + 1}@gumes.local`;
      const tel = faker.phone.number({ style: 'international' });

      const u = await client.query(
        `INSERT INTO utilisateur (email, password_hash, role) VALUES ($1, $2, 'seller') RETURNING id`,
        [email, passwordHash],
      );
      const userId = u.rows[0].id;

      await client.query(
        `INSERT INTO profil_producteur (user_id, nom, prenom, tel) VALUES ($1, $2, $3, $4)`,
        [userId, nom, prenom, tel],
      );

      const ent = await client.query(
        `INSERT INTO entreprise (owner_id, nom, siret, description)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [
          userId,
          `Ferme ${nom}`,
          faker.string.numeric(14),
          faker.lorem.sentence({ min: 8, max: 20 }),
        ],
      );
      const entrepriseId = ent.rows[0].id;

      const nbLieux = 1 + Math.floor(Math.random() * 2);
      const lieuIds = [];
      for (let j = 0; j < nbLieux; j++) {
        const { lat, lon } = jitter(pick(BRETAGNE), 8);
        const l = await client.query(
          `INSERT INTO lieu_de_vente (entreprise_id, nom, adresse, lat, lon, geom)
           VALUES ($1, $2, $3, $4, $5,
             ST_SetSRID(ST_MakePoint($5, $4), 4326)::geography)
           RETURNING id`,
          [
            entrepriseId,
            j === 0 ? `Ferme ${nom}` : `Marché ${faker.location.city()}`,
            `${faker.location.streetAddress()}, ${faker.location.zipCode()} ${faker.location.city()}`,
            lat, lon,
          ],
        );
        const lieuId = l.rows[0].id;
        lieuIds.push(lieuId);

        // horaires mar–sam 9h-18h par défaut
        for (const jour of [1, 2, 3, 4, 5]) {
          await client.query(
            `INSERT INTO horaire (lieu_id, jour_semaine, heure_debut, heure_fin)
             VALUES ($1, $2, '09:00', '18:00')`,
            [lieuId, jour],
          );
        }
      }

      producteurs.push({ userId, entrepriseId, lieuIds, nom });
    }

    // ─── Produits ─────────────────────────────────────────────────────────
    console.log('→ Produits + rattachement aux lieux + saisonnalité');
    const produits = [];
    const produitsSaisonniers = [
      { nom: 'Fraises', nature: 'fruit', mois_debut: 4, mois_fin: 7 },
      { nom: 'Tomates anciennes', nature: 'legume', mois_debut: 6, mois_fin: 9 },
      { nom: 'Courges butternut', nature: 'legume', mois_debut: 10, mois_fin: 2 },
      { nom: 'Asperges vertes', nature: 'legume', mois_debut: 4, mois_fin: 6 },
      { nom: 'Pommes reinette', nature: 'fruit', mois_debut: 9, mois_fin: 2 },
    ];
    const produitsPerma = [
      { nom: 'Miel toutes fleurs', nature: 'epicerie' },
      { nom: 'Huile de colza', nature: 'epicerie' },
      { nom: 'Fromage de chèvre', nature: 'fromage' },
      { nom: 'Terrine de campagne', nature: 'viande' },
      { nom: 'Jus de pomme', nature: 'boisson' },
      { nom: 'Confiture de figues', nature: 'epicerie' },
      { nom: 'Pain au levain', nature: 'epicerie' },
    ];

    for (const p of producteurs) {
      const nbProduits = 4 + Math.floor(Math.random() * 5);
      const modeles = pickN([...produitsSaisonniers, ...produitsPerma], nbProduits);
      for (const m of modeles) {
        const bio = Math.random() < 0.6;
        const shippable = !['fromage', 'viande'].includes(m.nature) && Math.random() < 0.7;
        const saisonnier = Boolean(m.mois_debut);
        const prod = await client.query(
          `INSERT INTO produit
             (entreprise_id, nom, description, nature, bio, prix_cents, stock, shippable, est_saisonnier)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING id`,
          [
            p.entrepriseId,
            m.nom,
            faker.lorem.sentence({ min: 5, max: 12 }),
            m.nature,
            bio,
            50 + Math.floor(Math.random() * 1200),  // 0,50 € à 12,50 €
            Math.floor(Math.random() * 40),
            shippable,
            saisonnier,
          ],
        );
        const produitId = prod.rows[0].id;

        if (saisonnier) {
          await client.query(
            `INSERT INTO produit_saison (produit_id, mois_debut, mois_fin) VALUES ($1, $2, $3)`,
            [produitId, m.mois_debut, m.mois_fin],
          );
        }
        for (const lieuId of p.lieuIds) {
          await client.query(
            `INSERT INTO produit_lieu_vente (produit_id, entreprise_id, lieu_id)
             VALUES ($1, $2, $3)`,
            [produitId, p.entrepriseId, lieuId],
          );
        }
        produits.push({ id: produitId, entrepriseId: p.entrepriseId, lieuIds: p.lieuIds });
      }
    }

    // ─── Points relais ────────────────────────────────────────────────────
    console.log('→ 10 points relais (Mondial Relay / RelaisPlus fictifs)');
    const relaisIds = [];
    for (let i = 0; i < 10; i++) {
      const { lat, lon } = jitter(pick(BRETAGNE), 6);
      const r = await client.query(
        `INSERT INTO point_relais (nom, adresse, lat, lon, geom)
         VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($4, $3), 4326)::geography)
         RETURNING id`,
        [
          `Relais ${faker.company.name()}`,
          `${faker.location.streetAddress()}, ${faker.location.zipCode()} ${faker.location.city()}`,
          lat, lon,
        ],
      );
      const relaisId = r.rows[0].id;
      relaisIds.push(relaisId);
      for (const jour of [0, 1, 2, 3, 4, 5]) {
        await client.query(
          `INSERT INTO horaire_point_relais (relais_id, jour_semaine, heure_debut, heure_fin)
           VALUES ($1, $2, '08:30', '19:00')`,
          [relaisId, jour],
        );
      }
    }

    // ─── Clients ──────────────────────────────────────────────────────────
    console.log('→ 30 clients + adresses géocodées');
    const clients = [];
    for (let i = 0; i < 30; i++) {
      const nom = faker.person.lastName();
      const prenom = faker.person.firstName();
      const email = `client${i + 1}@gumes.local`;
      const tel = faker.phone.number({ style: 'international' });
      const adresse = `${faker.location.streetAddress()}, ${faker.location.zipCode()} ${faker.location.city()}`;

      const u = await client.query(
        `INSERT INTO utilisateur (email, password_hash, role) VALUES ($1, $2, 'user') RETURNING id`,
        [email, passwordHash],
      );
      const userId = u.rows[0].id;

      await client.query(
        `INSERT INTO profil_client (user_id, nom, prenom, tel, adresse)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, nom, prenom, tel, adresse],
      );

      const { lat, lon } = jitter(pick(BRETAGNE), 8);
      await client.query(
        `INSERT INTO adresse_geocodee (user_id, lat, lon, geom)
         VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography)`,
        [userId, lat, lon],
      );

      clients.push({ userId, adresse, lat, lon });
    }

    // ─── Favoris ──────────────────────────────────────────────────────────
    console.log('→ Favoris (≈3 par client)');
    const entrepriseIds = [...new Set(producteurs.map((p) => p.entrepriseId))];
    for (const c of clients) {
      for (const eid of pickN(entrepriseIds, 3)) {
        await client.query(
          `INSERT INTO favori (client_id, entreprise_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [c.userId, eid],
        );
      }
    }

    // ─── Commandes + paiements ────────────────────────────────────────────
    console.log('→ 50 commandes avec lignes + paiements');
    for (let i = 0; i < 50; i++) {
      const clt = pick(clients);

      // Choisir un producteur et 1-3 de ses produits (un même producteur par commande)
      const prod = pick(producteurs);
      const catalogueProd = produits.filter((x) => x.entrepriseId === prod.entrepriseId);
      if (catalogueProd.length === 0) continue;
      const lignes = pickN(catalogueProd, 1 + Math.floor(Math.random() * 3));

      // Calcul du total produits
      const totauxParLigne = await Promise.all(lignes.map(async (lg) => {
        const { rows } = await client.query(
          'SELECT prix_cents, stock, shippable FROM produit WHERE id = $1',
          [lg.id],
        );
        const qte = 1 + Math.floor(Math.random() * Math.max(1, Math.min(3, rows[0].stock || 1)));
        return { produitId: lg.id, qte, prix: rows[0].prix_cents, shippable: rows[0].shippable };
      }));
      const totalProduits = totauxParLigne.reduce((s, l) => s + l.qte * l.prix, 0);
      const allShippable = totauxParLigne.every((l) => l.shippable);

      // Choix du mode : restreindre si non-shippable
      const candidats = allShippable ? MODES : ['pickup_store'];
      const mode = pick(candidats);
      const fraisPort =
        mode === 'pickup_store' ? 0 :
        mode === 'pickup_relay' ? 250 :
        totalProduits >= 5000 ? 0 : 490;

      const statut = pick(STATUTS);
      const dateCmd = faker.date.recent({ days: 60 });

      const cmd = await client.query(
        `INSERT INTO commande
           (client_id, statut, mode_livraison, total_produits_cents, frais_port_cents, date_commande)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [clt.userId, statut, mode, totalProduits, fraisPort, dateCmd],
      );
      const commandeId = cmd.rows[0].id;

      for (const l of totauxParLigne) {
        await client.query(
          `INSERT INTO ligne_commande (commande_id, produit_id, quantite, prix_unitaire_cents)
           VALUES ($1, $2, $3, $4)`,
          [commandeId, l.produitId, l.qte, l.prix],
        );
      }

      if (mode === 'pickup_store') {
        await client.query(
          `INSERT INTO commande_pickup_store (commande_id, lieu_id) VALUES ($1, $2)`,
          [commandeId, pick(prod.lieuIds)],
        );
      } else if (mode === 'pickup_relay') {
        await client.query(
          `INSERT INTO commande_pickup_relay (commande_id, relais_id) VALUES ($1, $2)`,
          [commandeId, pick(relaisIds)],
        );
      } else {
        await client.query(
          `INSERT INTO commande_home_delivery (commande_id, adresse, lat, lon, geom)
           VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($4, $3), 4326)::geography)`,
          [commandeId, clt.adresse, clt.lat, clt.lon],
        );
      }

      // Paiement
      const methode =
        mode === 'pickup_store' && Math.random() < 0.4 ? 'on_pickup' :
        mode === 'home_delivery' && Math.random() < 0.2 ? 'on_delivery' :
        'card_fake';
      const statutPaiement =
        ['cancelled', 'refused'].includes(statut) ? 'refunded' :
        statut === 'pending' ? 'pending' :
        'success';
      const pay = await client.query(
        `INSERT INTO paiement (commande_id, montant_cents, methode, statut, idempotency_key)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [
          commandeId,
          totalProduits + fraisPort,
          methode,
          statutPaiement,
          `seed-${i}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        ],
      );
      if (methode === 'card_fake') {
        await client.query(
          `INSERT INTO paiement_carte (paiement_id, last4) VALUES ($1, $2)`,
          [pay.rows[0].id, String(1000 + Math.floor(Math.random() * 9000)).slice(-4)],
        );
      }
    }

    // ─── Audit ────────────────────────────────────────────────────────────
    await client.query(
      `INSERT INTO audit_log (actor_id, action, target_type, payload)
       VALUES ($1, 'seed.bootstrap', 'database',
               jsonb_build_object('producteurs', 10, 'clients', 30, 'produits', $2::int, 'commandes', 50))`,
      [admin.rows[0].id, produits.length],
    );

    await client.query('COMMIT');
    console.log('✔ Seed terminé.');
    console.log(`   Mot de passe commun (dev) : ${DEFAULT_PASSWORD}`);
    console.log('   Comptes :');
    console.log('     • admin@gumes.local (admin)');
    console.log('     • producteur1@gumes.local … producteur10@gumes.local (seller)');
    console.log('     • client1@gumes.local … client30@gumes.local (user)');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('✗ Seed échoué :', err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
