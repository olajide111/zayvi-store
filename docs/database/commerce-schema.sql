-- ZAYVI commerce data model (reviewable schema proposal).
-- Apply only to a dedicated ZAYVI Supabase project after environment setup.
-- Do not apply this file to Pulse or SellAM databases.

create schema if not exists commerce;

create table if not exists commerce.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  source text not null default 'storefront',
  customer_email text not null,
  customer_name text,
  shipping_address jsonb not null,
  billing_address jsonb,
  currency char(3) not null default 'GBP',
  subtotal_pence integer not null check (subtotal_pence >= 0),
  shipping_pence integer not null default 0 check (shipping_pence >= 0),
  tax_pence integer not null default 0 check (tax_pence >= 0),
  total_pence integer not null check (total_pence >= 0),
  order_status text not null default 'awaiting_payment'
    check (order_status in ('awaiting_payment','paid','processing','part_fulfilled','fulfilled','cancelled','refunded')),
  payment_status text not null default 'pending'
    check (payment_status in ('pending','authorized','captured','failed','partially_refunded','refunded')),
  payment_provider text not null default 'paypal',
  provider_order_id text unique,
  provider_capture_id text unique,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists commerce.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references commerce.orders(id) on delete restrict,
  product_id bigint not null,
  product_name text not null,
  sku text,
  selected_color text,
  selected_size text,
  quantity integer not null check (quantity > 0),
  unit_price_pence integer not null check (unit_price_pence >= 0),
  line_total_pence integer not null check (line_total_pence >= 0),
  fulfilment_source text not null default 'unassigned'
    check (fulfilment_source in ('unassigned','own_stock','supplier','dropship')),
  created_at timestamptz not null default now()
);

create table if not exists commerce.payment_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references commerce.orders(id) on delete restrict,
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create table if not exists commerce.fulfilments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references commerce.orders(id) on delete restrict,
  carrier text,
  service text,
  tracking_number text,
  tracking_url text,
  fulfilment_status text not null default 'pending'
    check (fulfilment_status in ('pending','label_created','dispatched','in_transit','delivered','exception','returned')),
  dispatched_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_created_at_idx on commerce.orders (created_at desc);
create index if not exists orders_status_idx on commerce.orders (order_status, payment_status);
create index if not exists order_items_order_id_idx on commerce.order_items (order_id);
create index if not exists payment_events_order_id_idx on commerce.payment_events (order_id);
create index if not exists fulfilments_order_id_idx on commerce.fulfilments (order_id);

alter table commerce.orders enable row level security;
alter table commerce.order_items enable row level security;
alter table commerce.payment_events enable row level security;
alter table commerce.fulfilments enable row level security;

-- Keep the schema private to server-side application access. Do not expose
-- guest order data through the public Data API.
revoke all on schema commerce from public, anon, authenticated;
revoke all on all tables in schema commerce from public, anon, authenticated;
grant usage on schema commerce to service_role;
grant all on all tables in schema commerce to service_role;
