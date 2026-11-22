create table if not exists workspaces (
  owner_id uuid primary key,
  version integer not null default 0 check (version >= 0),
  entries jsonb not null default '[]'::jsonb check (jsonb_typeof(entries) = 'array'),
  updated_at timestamptz not null default now()
);
