create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

create table tenants (id uuid primary key default gen_random_uuid(), name text, slug text unique);
insert into tenants(name, slug) values ('Demo', 'demo') on conflict do nothing;

create table products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  sku text not null,
  name text,
  attributes jsonb default '{}'::jsonb,
  unique(tenant_id, sku)
);

create table stock_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  product_id uuid references products(id),
  location_code text,
  on_hand int not null default 0,
  reserved int not null default 0,
  unique(tenant_id, product_id, location_code)
);

create table inventory_movements (
  id bigserial primary key,
  tenant_id uuid not null,
  product_id uuid not null,
  from_loc text,
  to_loc text,
  qty int not null check (qty>0),
  reason text not null,
  note text,
  idempotency_key text,
  at timestamptz default now()
);

create table outbox (
  id bigserial primary key,
  topic text,
  payload jsonb,
  created_at timestamptz default now(),
  delivered boolean default false
);

-- functions (simplified)
create or replace function adjust_inventory(tid uuid, sku text, loc text, delta int, reason text, note text)
returns table(on_hand int, reserved int, available int) language plpgsql as $$
declare pid uuid;
begin
  select id into pid from products where tenant_id=tid and products.sku=sku;
  if pid is null then
    insert into products(tenant_id, sku, name) values (tid, sku, sku) returning id into pid;
  end if;
  insert into inventory_movements(tenant_id, product_id, to_loc, qty, reason, note)
    values (tid, pid, loc, abs(delta), reason, note);
  insert into stock_items(tenant_id, product_id, location_code, on_hand, reserved)
    values (tid, pid, loc, delta, 0)
    on conflict (tenant_id, product_id, location_code)
    do update set on_hand = stock_items.on_hand + excluded.on_hand;
  insert into outbox(topic, payload) values('stock.updated', jsonb_build_object('tenant', tid, 'sku', sku, 'loc', loc));
  return query
    select on_hand, reserved, (on_hand - reserved) as available
    from stock_items where tenant_id=tid and product_id=pid and location_code=loc;
end $$;

-- demo data
do $$
declare tid uuid;
begin
  select id into tid from tenants where slug='demo';
  insert into products(tenant_id, sku, name) values (tid, 'ABC-123', 'Demo Product') on conflict do nothing;
  perform adjust_inventory(tid, 'ABC-123', 'WH1', 50, 'seed', 'initial');
end $$;
