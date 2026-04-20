import { z } from 'zod';

export const paiementSchema = z.discriminatedUnion('methode', [
  z.object({
    methode: z.literal('card_fake'),
    commande_id: z.uuid(),
    numero_carte: z.string().regex(/^\d{13,19}$/, 'Numéro de carte invalide (chiffres uniquement).'),
  }),
  z.object({
    methode: z.literal('on_pickup'),
    commande_id: z.uuid(),
  }),
  z.object({
    methode: z.literal('on_delivery'),
    commande_id: z.uuid(),
  }),
]);
