CREATE TABLE IF NOT EXISTS document_exports(
  project_id uuid PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued',
  file_name text,
  stored_path text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
