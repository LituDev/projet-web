import { HttpError } from './error.js';

export function requireAuth(req, res, next) {
  if (!req.session?.user) {
    return next(new HttpError(401, 'unauthenticated', 'Authentification requise.'));
  }
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    const user = req.session?.user;
    if (!user) {
      return next(new HttpError(401, 'unauthenticated', 'Authentification requise.'));
    }
    if (!roles.includes(user.role)) {
      return next(new HttpError(403, 'forbidden', 'Droits insuffisants.'));
    }
    next();
  };
}
