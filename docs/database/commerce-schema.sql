-- ZAYVI commerce data model (reviewable schema proposal).
-- Apply only to a dedicated ZAYVI Supabase project after environment setup.
-- Do not apply this file to Pulse or SellAM databases.

create schema if not exists commerce;

create table if not exists commerce.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  source text not null default 'storefront',
  store_ref text,
  customer_email text not null,
  customer_name text,
  shipping_address jsonb not null,
  billing_address jsonb,
  country_code char(2),
  currency char(3) not null default 'GBP',
  subtotal_minor bigint not null check (subtotal_minor >= 0),
  shipping_minor bigint not null default 0 check (shipping_minor >= 0),
  tax_minor bigint not null default 0 check (tax_minor >= 0),
  total_minor bigint not null check (total_minor >= 0),
  order_status text not null default 'awaiting_payment'
    check (order_status in ('awaiting_payment','paid','processing','part_fulfilled','fulfilled','cancelled','refunded')),
  payment_status text not null default 'pending'
    check (payment_status in ('pending','authorized','paid','failed','held','partially_refunded','refunded','cancelled')),
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
  unit_price_minor bigint not null check (unit_price_minor >= 0),
  line_total_minor bigint not null check (line_total_minor >= 0),
  fulfilment_source text not null default 'unassigned'
    check (fulfilment_source in ('unassigned','own_stock','supplier','dropship')),
  created_at timestamptz not null default now()
);

create table if not exists commerce.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references commerce.orders(id) on delete restrict,
  platform text not null check (platform in ('kredal','square','paypal')),
  external_payment_id text,
  external_reference text,
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null,
  status text not null default 'pending'
    check (status in ('pending','authorized','paid','failed','held','partially_refunded','refunded','cancelled')),
  idempotency_key text,
  checkout_url text,
  metadata jsonb not null default '{}'::jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, external_payment_id),
  unique (platform, external_reference)
);

create table if not exists commerce.payment_connections (
  id uuid primary key default gen_random_uuid(),
  store_ref text not null,
  platform text not null check (platform in ('kredal','square','paypal')),
  external_connection_id text not null,
  status text not null default 'pending'
    check (status in ('pending','active','revoked')),
  metadata jsonb not null default '{}'::jsonb,
  connected_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, store_ref),
  unique (platform, external_connection_id)
);

create table if not exists commerce.payment_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references commerce.orders(id) on delete restrict,
  payment_id uuid references commerce.payments(id) on delete restrict,
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
create index if not exists orders_store_ref_idx on commerce.orders (store_ref);
create index if not exists order_items_order_id_idx on commerce.order_items (order_id);
create index if not exists payments_order_id_idx on commerce.payments (order_id);
create index if not exists payments_status_idx on commerce.payments (platform, status);
create index if not exists payment_connections_store_idx on commerce.payment_connections (store_ref, platform);
create index if not exists payment_events_order_id_idx on commerce.payment_events (order_id);
create index if not exists payment_events_payment_id_idx on commerce.payment_events (payment_id);
create index if not exists fulfilments_order_id_idx on commerce.fulfilments (order_id);

alter table commerce.orders enable row level security;
alter table commerce.order_items enable row level security;
alter table commerce.payments enable row level security;
alter table commerce.payment_connections enable row level security;
alter table commerce.payment_events enable row level security;
alter table commerce.fulfilments enable row level security;

-- Keep the schema private to server-side application access. Do not expose
-- guest order data through the public Data API.
revoke all on schema commerce from public, anon, authenticated;
revoke all on all tables in schema commerce from public, anon, authenticated;
grant usage on schema commerce to service_role;
grant all on all tables in schema commerce to service_role;
