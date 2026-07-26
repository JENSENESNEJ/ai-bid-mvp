ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS coverage_audit jsonb NOT NULL DEFAULT '{}'::jsonb;

