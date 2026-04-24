import { z } from 'zod';

export const proximiteQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  rayon_m: z.coerce.number().int().positive().max(200_000).default(20_000),
  limite: z.coerce.number().int().positive().max(50).default(10),
});

const point = z.object({
  id: z.string().max(100),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});

export const itineraireSchema = z.object({
  depart: point,
  etapes: z.array(point).min(1).max(15),
});

export const routeQuerySchema = z.object({
  from_lat: z.coerce.number().min(-90).max(90),
  from_lon: z.coerce.number().min(-180).max(180),
  to_lat: z.coerce.number().min(-90).max(90),
  to_lon: z.coerce.number().min(-180).max(180),
});

export const geocodeQuerySchema = z.object({
  q: z.string().trim().min(1).max(160).optional(),
  ville: z.string().trim().min(1).max(120).optional(),
  code_postal: z.string().trim().regex(/^\d{5}$/).optional(),
  limit: z.coerce.number().int().min(1).max(10).default(5),
});
