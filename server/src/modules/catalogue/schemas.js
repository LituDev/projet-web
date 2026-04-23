import { z } from 'zod';

export const entrepriseCreateSchema = z.object({
  nom: z.string().min(1).max(120),
  siret: z.string().regex(/^\d{14}$/, 'Le SIRET doit faire 14 chiffres.'),
  description: z.string().max(2000).default(''),
});
export const entrepriseUpdateSchema = entrepriseCreateSchema.partial();

export const lieuCreateSchema = z.object({
  entreprise_id: z.uuid(),
  nom: z.string().min(1).max(120),
  adresse: z.string().min(5).max(250),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  actif: z.boolean().default(true),
  horaires: z
    .array(
      z.object({
        jour_semaine: z.number().int().min(0).max(6),
        heure_debut: z.string().regex(/^\d{2}:\d{2}$/),
        heure_fin: z.string().regex(/^\d{2}:\d{2}$/),
      }),
    )
    .default([]),
});
export const lieuUpdateSchema = lieuCreateSchema.partial().omit({ entreprise_id: true });

export const produitCreateSchema = z.object({
  entreprise_id: z.uuid({ message: "L'entreprise est invalide." }),
  nom: z.string().min(1, { message: 'Le nom est requis.' }).max(120, { message: 'Le nom ne peut pas dépasser 120 caractères.' }),
  description: z.string().max(2000, { message: 'La description ne peut pas dépasser 2000 caractères.' }).default(''),
  nature: z.enum(['legume', 'fruit', 'viande', 'fromage', 'epicerie', 'boisson', 'autre'], { message: 'Veuillez choisir une nature valide.' }),
  bio: z.boolean({ message: 'Le champ Bio est requis.' }),
  prix_cents: z.number({ message: 'Le prix doit être un nombre.' }).int({ message: 'Le prix doit être un nombre entier.' }).min(0, { message: 'Le prix ne peut pas être négatif.' }),
  stock: z.number({ message: 'Le stock doit être un nombre.' }).int({ message: 'Le stock doit être un nombre entier.' }).min(0, { message: 'Le stock ne peut pas être négatif.' }),
  shippable: z.boolean().default(false),
  visibilite: z.enum(['visible', 'hidden', 'out_of_stock']).default('visible'),
  est_saisonnier: z.boolean().default(false),
  mois_debut: z.number({ message: 'Le mois de début doit être un nombre.' }).int().min(1, { message: 'Le mois de début doit être entre 1 et 12.' }).max(12, { message: 'Le mois de début doit être entre 1 et 12.' }).optional(),
  mois_fin: z.number({ message: 'Le mois de fin doit être un nombre.' }).int().min(1, { message: 'Le mois de fin doit être entre 1 et 12.' }).max(12, { message: 'Le mois de fin doit être entre 1 et 12.' }).optional(),
  lieu_ids: z.array(z.uuid()).default([]),
}).refine(
  (p) => !p.est_saisonnier || (p.mois_debut && p.mois_fin),
  { message: 'Les mois de début et de fin sont requis pour un produit saisonnier.', path: ['est_saisonnier'] },
);
export const produitUpdateSchema = z.object({
  nom: z.string().min(1, { message: 'Le nom est requis.' }).max(120, { message: 'Le nom ne peut pas dépasser 120 caractères.' }).optional(),
  description: z.string().max(2000, { message: 'La description ne peut pas dépasser 2000 caractères.' }).optional(),
  nature: z.enum(['legume', 'fruit', 'viande', 'fromage', 'epicerie', 'boisson', 'autre'], { message: 'Veuillez choisir une nature valide.' }).optional(),
  bio: z.boolean().optional(),
  prix_cents: z.number({ message: 'Le prix doit être un nombre.' }).int({ message: 'Le prix doit être un nombre entier.' }).min(0, { message: 'Le prix ne peut pas être négatif.' }).optional(),
  stock: z.number({ message: 'Le stock doit être un nombre.' }).int({ message: 'Le stock doit être un nombre entier.' }).min(0, { message: 'Le stock ne peut pas être négatif.' }).optional(),
  shippable: z.boolean().optional(),
  visibilite: z.enum(['visible', 'hidden', 'out_of_stock']).optional(),
});

export const produitListQuerySchema = z.object({
  q: z.string().max(120).optional(),
  nature: z.enum(['legume', 'fruit', 'viande', 'fromage', 'epicerie', 'boisson', 'autre']).optional(),
  bio: z.enum(['true', 'false']).optional(),
  tri: z.enum(['nom_asc', 'prix_asc', 'prix_desc', 'stock_desc', 'bio_first']).default('nom_asc'),
  limit: z.coerce.number().int().min(1).max(100).default(24),
  offset: z.coerce.number().int().min(0).default(0),
});
