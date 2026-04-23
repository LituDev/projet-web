import express from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../../config.js';
import { loginSchema, registerSchema, updateProfileClientSchema, updateProfileProducteurSchema, requestResetSchema, confirmResetSchema } from './schemas.js';
import { authenticate, getCurrentUser, registerUser, unregisterSelf, updateProfile, requestPasswordReset, confirmPasswordReset } from './service.js';
import { requireAuth } from '../../middlewares/auth.js';

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: config.RATELIMIT_LOGIN_WINDOW_MS,
  limit: config.RATELIMIT_LOGIN_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'rate_limited', message: 'Trop de tentatives, réessayez plus tard.' } },
});

router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const input = registerSchema.parse(req.body);
    const user = await registerUser(input);
    req.session.user = { id: user.id, email: user.email, role: user.role };
    res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
});

router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = await authenticate(email, password);
    req.session.regenerate((regenErr) => {
      if (regenErr) return next(regenErr);
      req.session.user = user;
      req.session.save((saveErr) => (saveErr ? next(saveErr) : res.json({ user })));
    });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (req, res, next) => {
  if (!req.session) return res.status(204).end();
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie(config.SESSION_COOKIE_NAME);
    res.status(204).end();
  });
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await getCurrentUser(req.session.user.id);
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

router.patch('/me/profile', requireAuth, async (req, res, next) => {
  try {
    const role = req.session.user.role;
    const schema = role === 'seller' ? updateProfileProducteurSchema : updateProfileClientSchema;
    const input = schema.parse(req.body);
    await updateProfile(req.session.user.id, input, role);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.post('/password-reset/request', async (req, res, next) => {
  try {
    const { email } = requestResetSchema.parse(req.body);
    await requestPasswordReset(email);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.post('/password-reset/confirm', async (req, res, next) => {
  try {
    const { token, password } = confirmResetSchema.parse(req.body);
    await confirmPasswordReset(token, password);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// Désinscription — soft-delete + anonymisation (RGPD) + destruction de session
router.delete('/me', requireAuth, async (req, res, next) => {
  try {
    await unregisterSelf(req.session.user.id);
    req.session.destroy((err) => {
      if (err) return next(err);
      res.clearCookie(config.SESSION_COOKIE_NAME);
      res.status(204).end();
    });
  } catch (err) { next(err); }
});

export default router;
