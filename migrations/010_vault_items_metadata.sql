-- Migration 010: add payload_metadata column to vault_items
ALTER TABLE vault_items ADD COLUMN IF NOT EXISTS payload_metadata JSONB;
