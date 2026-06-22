-- Run this in your Supabase project: SQL Editor > New query > paste > Run

create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  quantity integer not null default 0,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists items_created_at_idx on items (created_at desc);

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists items_set_updated_at on items;
create trigger items_set_updated_at
before update on items
for each row execute function set_updated_at();
