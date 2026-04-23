import { z } from 'zod';

export const avisCreateSchema = z.object({
  note: z.number().int().min(1).max(5),
  commentaire: z.string().trim().min(3).max(1000),
});

export const avisListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
  offset: z.coerce.number().int().min(0).default(0),
});
