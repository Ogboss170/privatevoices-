-- ==============================================================================
-- Migration 043: End-to-End Encryption (E2EE) Public Key Bundle & E2EE Messages
-- Supports:
-- 1. ECDH (X25519 / P-256) public identity keys and signed pre-keys per user
-- 2. Storing encrypted ciphertexts, IVs, and encryption flags on messages
-- ==============================================================================

-- 1. Public Key Registry Table for Users
CREATE TABLE IF NOT EXISTS public.user_e2ee_keys (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  public_key_spki TEXT NOT NULL,           -- Base64 exported SPKI public key (ECDH P-256)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_e2ee_keys_user ON public.user_e2ee_keys(user_id);

ALTER TABLE public.user_e2ee_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public keys are readable by authenticated users" ON public.user_e2ee_keys;
CREATE POLICY "Public keys are readable by authenticated users"
  ON public.user_e2ee_keys FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can publish and update their own public key" ON public.user_e2ee_keys;
CREATE POLICY "Users can publish and update their own public key"
  ON public.user_e2ee_keys FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. Extend public.messages with E2EE metadata
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS is_e2ee BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS encrypted_payload TEXT,    -- Base64 ciphertext
  ADD COLUMN IF NOT EXISTS encryption_iv TEXT,        -- Base64 initialization vector (AES-GCM 96-bit)
  ADD COLUMN IF NOT EXISTS sender_ephemeral_key TEXT; -- Base64 sender ephemeral ECDH public key

-- 3. Extend conversations with E2EE support flag
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS is_e2ee_enabled BOOLEAN DEFAULT TRUE;

NOTIFY pgrst, 'reload schema';
