-- Zayvi migration 0006: order idempotency and payment-attempt ledger
-- Adds replay-safe draft-order creation and the persistence layer required
-- for provider-controlled payment attempts. Payment execution remains disabled.

BEGIN;

ALTER TABLE commerce_orders
  ADD COLUMN idempotency_key text,
  ADD COLUMN request_fingerprint text;

ALTER TABLE commerce_orders
  ADD CONSTRAINT commerce_orders_idempotency_key_length
    CHECK (
      idempotency_key IS NULL
      OR char_length(idempotency_key) BETWEEN 16 AND 128
    ),
  ADD CONSTRAINT commerce_orders_request_fingerprint_length
    CHECK (
      request_fingerprint IS NULL
      OR char_length(request_fingerprint) = 64
    ),
  ADD CONSTRAINT commerce_orders_idempotency_pair
    CHECK (
      (idempotency_key IS NULL AND request_fingerprint IS NULL)
      OR
      (idempotency_key IS NOT NULL AND request_fingerprint IS NOT NULL)
    );

CREATE UNIQUE INDEX commerce_orders_tenant_idempotency_idx
  ON commerce_orders(tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE commerce_payment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  order_id uuid NOT NULL,
  provider text NOT NULL
    CHECK (provider IN ('paypal','square')),
  idempotency_key text NOT NULL
    CHECK (char_length(idempotency_key) BETWEEN 16 AND 128),
  provider_reference text,
  status text NOT NULL DEFAULT 'created'
    CHECK (
      status IN (
        'created',
        'pending',
        'authorised',
        'captured',
        'failed',
        'cancelled',
        'partially_refunded',
        'refunded'
      )
    ),
  amount numeric(20,4) NOT NULL CHECK (amount >= 0),
  currency_code char(3) NOT NULL,
  failure_code text,
  failure_message text,
  provider_payload jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(provider_payload) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, provider, idempotency_key),
  FOREIGN KEY (tenant_id, order_id)
    REFERENCES commerce_orders(tenant_id, id) ON DELETE RESTRICT,
  CHECK (currency_code = upper(currency_code))
);

CREATE INDEX commerce_payment_attempts_order_idx
  ON commerce_payment_attempts(tenant_id, order_id, created_at DESC);

CREATE UNIQUE INDEX commerce_payment_attempts_provider_reference_idx
  ON commerce_payment_attempts(tenant_id, provider, provider_reference)
  WHERE provider_reference IS NOT NULL;

ALTER TABLE commerce_payment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_payment_attempts FORCE ROW LEVEL SECURITY;

CREATE POLICY commerce_payment_attempts_isolation ON commerce_payment_attempts
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );

GRANT SELECT, INSERT, UPDATE ON
  commerce_payment_attempts
TO zayvi_app;

COMMIT;
