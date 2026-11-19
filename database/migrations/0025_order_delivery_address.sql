-- Store the delivery address as an order snapshot. Existing orders retain NULL.
BEGIN;

ALTER TABLE commerce_orders
  ADD COLUMN delivery_address jsonb,
  ADD CONSTRAINT commerce_orders_delivery_address_object
    CHECK (delivery_address IS NULL OR jsonb_typeof(delivery_address) = 'object');

COMMIT;
