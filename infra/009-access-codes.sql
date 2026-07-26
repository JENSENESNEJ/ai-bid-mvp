CREATE TABLE IF NOT EXISTS access_codes(
  id uuid PRIMARY KEY,
  code text NOT NULL UNIQUE,
  note text NOT NULL DEFAULT '',
  is_admin boolean NOT NULL DEFAULT false,
  disabled boolean NOT NULL DEFAULT false,
  max_projects integer,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

ALTER TABLE projects ADD COLUMN IF NOT EXISTS access_code_id uuid REFERENCES access_codes(id);
CREATE INDEX IF NOT EXISTS projects_access_idx ON projects(access_code_id,created_at DESC);
