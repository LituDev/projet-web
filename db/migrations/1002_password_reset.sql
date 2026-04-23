CREATE TABLE IF NOT EXISTS password_reset_token (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
  token      CHAR(64)    NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '15 minutes',
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_prt_token   ON password_reset_token (token);
CREATE INDEX IF NOT EXISTS idx_prt_user_id ON password_reset_token (user_id);
