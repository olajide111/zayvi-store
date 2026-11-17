# Supplier Inventory Sync API

Zayvi supports machine-to-machine supplier stock synchronization through a revocable supplier API credential with the `inventory:write` scope.

## Endpoint

```text
POST /api/vendor-inventory/v1/sync
```

## Authentication

Send the supplier API credential as a Bearer token:

```http
Authorization: Bearer <SUPPLIER_API_KEY>
Content-Type: application/json
```

The credential must include:

```text
inventory:write
```

A `feed:write`-only credential cannot call this endpoint.

## Request body

```json
{
  "sourceReference": "ERP stock export",
  "items": [
    {
      "supplierSku": "SKU-001",
      "stockStatus": "in_stock",
      "externalStockQuantity": 25,
      "observedAt": "2026-11-17T07:30:00Z"
    }
  ]
}
```

Supported stock states:

- `unknown`
- `in_stock`
- `limited`
- `out_of_stock`
- `preorder`

A request can contain up to 500 items.

## Matching rule

Inventory sync matches supplier offers by exact:

```text
supplier_id + supplier_sku
```

Zayvi does not fuzzy-match inventory updates.

If no active supplier offer has the submitted SKU, the row is recorded as `unmatched` and no offer is changed.

## Stale update protection

Each stock item can include `observedAt`.

If the submitted observation is older than or equal to the supplier offer's existing `source_updated_at`, the snapshot is recorded as:

```text
stale_ignored
```

and the newer supplier-offer state is preserved.

## Applied updates

For an exact, newer match, Zayvi updates only:

- supplier offer stock status
- supplier-reported external stock quantity
- supplier offer source-updated timestamp

It does not update:

- Zayvi-owned inventory
- reserved inventory
- customer-facing availability
- product publication
- customer price
- supplier verification
- purchase orders
- fulfilment state

## Response

A successful request returns:

```json
{
  "syncRunId": "uuid",
  "status": "processed",
  "itemCount": 1,
  "matchedCount": 1,
  "unmatchedCount": 0,
  "staleCount": 0,
  "outcomes": [
    {
      "supplierSku": "SKU-001",
      "outcome": "applied"
    }
  ],
  "ownedInventoryChanged": false,
  "publicationChanged": false
}
```

Possible row outcomes:

- `applied`
- `unmatched`
- `stale_ignored`

## Operational guidance

Use the supplier system's own last-updated timestamp as `observedAt` whenever possible.

Keep supplier SKUs stable across feeds and inventory synchronization.

If a SKU changes, update the supplier offer mapping before sending stock for the new SKU.
