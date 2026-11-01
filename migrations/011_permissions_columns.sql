-- Migration 011: add missing columns to credential_permissions
ALTER TABLE credential_permissions
  ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Rename granted_at to match expected column (keep both for compatibility)
-- granted_at already exists, created_at is the alias used in queries
