CREATE TABLE IF NOT EXISTS technical_parameter_items(
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  item_index integer NOT NULL,
  product_no integer,
  product_name text NOT NULL,
  parameter_no text,
  marker text NOT NULL DEFAULT '',
  requirement_text text NOT NULL,
  source_page integer,
  proof_requirement text,
  response_value text NOT NULL DEFAULT '',
  deviation_status text NOT NULL DEFAULT 'pending',
  evidence_reference text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id,item_index)
);

CREATE INDEX IF NOT EXISTS technical_parameter_items_project_idx
  ON technical_parameter_items(project_id,item_index);

CREATE INDEX IF NOT EXISTS technical_parameter_items_marker_idx
  ON technical_parameter_items(project_id,marker,item_index);
