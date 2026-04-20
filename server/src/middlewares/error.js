import { ZodError, flattenError } from 'zod';
import { logger } from '../logger.js';

export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function notFound(req, res) {
  res.status(404).json({ error: { code: 'not_found', message: 'Ressource introuvable.' } });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: 'validation_error',
        message: 'Entrée invalide.',
        details: flattenError(err).fieldErrors,
      },
    });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
  }
  logger.error({ err }, 'Erreur non gérée');
  res.status(500).json({ error: { code: 'internal_error', message: 'Erreur interne.' } });
}
