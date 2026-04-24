import { z } from 'zod';

const password = z
  .string()
  .min(10, 'Mot de passe trop court (10 caractères minimum).')
  .max(128);

const tel = z.string().regex(/^\+?[0-9 .-]{10,20}$/, 'Numéro de téléphone invalide.');

export const registerClientSchema = z.object({
  role: z.literal('user'),
  email: z.string().email('Email invalide.').transform((s) => s.toLowerCase()),
  password,
  nom: z.string().min(1).max(80),
  prenom: z.string().min(1).max(80),
  tel,
  adresse: z.string().trim().max(250).optional(),
  ville: z.string().trim().max(120).optional(),
  code_postal: z.string().trim().regex(/^\d{5}$/, 'Code postal invalide.').optional(),
});

export const registerProducteurSchema = z.object({
  role: z.literal('seller'),
  email: z.string().email('Email invalide.').transform((s) => s.toLowerCase()),
  password,
  nom: z.string().min(1).max(80),
  prenom: z.string().min(1).max(80),
  tel,
});

export const registerSchema = z.discriminatedUnion('role', [
  registerClientSchema,
  registerProducteurSchema,
]);

export const loginSchema = z.object({
  email: z.string().email('Email invalide.').transform((s) => s.toLowerCase()),
  password: z.string().min(1, 'Mot de passe requis.'),
});

export const updateProfileClientSchema = z.object({
  prenom: z.string().min(1).max(80),
  nom: z.string().min(1).max(80),
  tel,
  adresse: z.string().trim().max(250).optional(),
  ville: z.string().trim().max(120).optional(),
  code_postal: z.string().trim().regex(/^\d{5}$/, 'Code postal invalide.').optional(),
});

export const updateProfileProducteurSchema = z.object({
  prenom: z.string().min(1).max(80),
  nom: z.string().min(1).max(80),
  tel,
});

export const requestResetSchema = z.object({
  email: z.string().email('Email invalide.').transform((s) => s.toLowerCase()),
});

export const confirmResetSchema = z.object({
  token: z.string().length(64),
  password,
});
