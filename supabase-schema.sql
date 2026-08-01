-- Run this in Supabase SQL Editor (SQL Editor > New query > paste > Run).
-- Safe to run multiple times. Handles both fresh setup and migration from earlier version.

create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table items add column if not exists category text not null default '';
alter table items add column if not exists units_per_case integer not null default 1;
alter table items add column if not exists cases integer not null default 0;
alter table items add column if not exists loose_units integer not null default 0;
alter table items add column if not exists min_threshold integer not null default 0;
alter table items add column if not exists archived boolean not null default false;

-- Pricing (both nullable — items without them simply show no financials).
-- case_cost  = what you pay your supplier for one case
-- unit_price = what a customer pays for one unit
alter table items add column if not exists case_cost numeric(10,2);
alter table items add column if not exists unit_price numeric(10,2);

-- Distributor SKU / UPC, as printed on the order sheet.
alter table items add column if not exists sku text not null default '';

-- Migrate legacy `quantity` column into `loose_units`, then drop it
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'items' and column_name = 'quantity'
  ) then
    update items set loose_units = greatest(loose_units, quantity);
    alter table items drop column quantity;
  end if;
end $$;

create index if not exists items_category_idx on items (category);
create index if not exists items_created_at_idx on items (created_at desc);
create index if not exists items_archived_idx on items (archived);

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

-- Events (photo slideshow)

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  event_date date,
  event_time time,
  image_url text not null,
  image_key text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table events add column if not exists event_time time;

create index if not exists events_sort_idx
  on events (sort_order asc, event_date desc nulls last, created_at desc);

drop trigger if exists events_set_updated_at on events;
create trigger events_set_updated_at
before update on events
for each row execute function set_updated_at();
