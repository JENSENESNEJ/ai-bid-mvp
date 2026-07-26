ALTER TABLE requirements
  ADD COLUMN IF NOT EXISTS ai_review_status text NOT NULL DEFAULT 'unreviewed',
  ADD COLUMN IF NOT EXISTS ai_review_reason text,
  ADD COLUMN IF NOT EXISTS ai_review_suggestion text,
  ADD COLUMN IF NOT EXISTS ai_review_confidence numeric(5,4),
  ADD COLUMN IF NOT EXISTS ai_reviewed_at timestamptz;

ALTER TABLE ai_runs
  ADD COLUMN IF NOT EXISTS run_type text NOT NULL DEFAULT 'extraction';

CREATE INDEX IF NOT EXISTS requirements_ai_review_idx
  ON requirements(project_id, ai_review_status, created_at);
