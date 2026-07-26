CREATE TABLE IF NOT EXISTS document_artifacts(
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'generating',
  svg_path text,
  png_path text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id,kind)
);

CREATE INDEX IF NOT EXISTS idx_document_artifacts_project
  ON document_artifacts(project_id,status,kind);
