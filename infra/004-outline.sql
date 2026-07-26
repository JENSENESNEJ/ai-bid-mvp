CREATE TABLE IF NOT EXISTS outlines(
  project_id uuid PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  content jsonb NOT NULL DEFAULT '{"chapters":[]}'::jsonb,
  status text NOT NULL DEFAULT 'generating',
  version integer NOT NULL DEFAULT 1,
  model text,
  error_message text,
  generated_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
