import { z } from 'zod';

const ligne = z.object({
  produit_id: z.uuid(),
  quantite: z.number().int().min(1).max(100),
});

export const quoteSchema = z.object({
  lignes: z.array(ligne).min(1),
});

export const createCommandeSchema = z.discriminatedUnion('mode_livraison', [
  z.object({
    mode_livraison: z.literal('pickup_store'),
    lignes: z.array(ligne).min(1),
    lieu_id: z.uuid(),
  }),
  z.object({
    mode_livraison: z.literal('pickup_relay'),
    lignes: z.array(ligne).min(1),
    relais_id: z.uuid(),
  }),
  z.object({
    mode_livraison: z.literal('home_delivery'),
    lignes: z.array(ligne).min(1),
    adresse: z.string().min(5).max(250),
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
  }),
]);

export const patchStatutSchema = z.object({
  statut: z.enum([
    'accepted', 'refused', 'preparing',
    'ready_for_pickup', 'shipped', 'delivered', 'cancelled',
  ]),
});
