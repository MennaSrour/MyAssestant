create table if not exists public.workspaces (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  version integer not null default 0 check (version >= 0),
  entries jsonb not null default '[]'::jsonb check (jsonb_typeof(entries) = 'array'),
  updated_at timestamptz not null default now()
);
alter table public.workspaces enable row level security;
revoke all on public.workspaces from anon;
grant select, insert, update, delete on public.workspaces to authenticated;
drop policy if exists "Workspace owner" on public.workspaces;
create policy "Workspace owner" on public.workspaces for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
