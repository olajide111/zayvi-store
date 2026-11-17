# Supplier Feed API

Zayvi supports machine-to-machine supplier product-feed submission through a revocable supplier API credential.

## Endpoint

```text
POST /api/vendor-feed/v1/ingest
```

## Authentication

Send the supplier API credential as a Bearer token:

```http
Authorization: Bearer <SUPPLIER_API_KEY>
Content-Type: application/json
```

Supplier API keys are generated in Admin → Supplier → Vendor portal access.

The raw key is shown once. Zayvi stores only its SHA-256 hash and a non-secret prefix.

## Scope

The initial credential scope is:

```text
feed:write
```

It permits product-feed submission only.

It does not permit:

- supplier verification
- product approval or publication
- customer-price changes
- purchase-order approval
- fulfilment actions
- access to another supplier's records

## Request body

```json
{
  "sourceReference": "ERP nightly export",
  "items": [
    {
      "externalProductId": "SUP-001",
      "supplierSku": "SKU-001",
      "name": "Example product",
      "category": "General",
      "description": "Supplier product description",
      "imageUrl": "https://example.com/product.jpg",
      "currency": "GBP",
      "unitCost": 10,
      "minimumOrderQuantity": 1,
      "leadTimeDays": 3,
      "stockStatus": "in_stock",
      "externalStockQuantity": 25
    }
  ]
}
```

The supplier's market determines the required currency:

- GB supplier → GBP
- NG supplier → NGN

A request can contain up to 100 items.

## Response

A successful submission returns the feed batch result, including accepted and rejected counts.

Accepted products enter Product Discovery in `pending_review`.

They do not become published catalogue products automatically.

Exact replay of the same supplier payload is detected by checksum and does not create a duplicate batch.

## Review flow

```text
Supplier API
  ↓
feed validation
  ↓
supplier-scoped feed batch
  ↓
Product Discovery candidate
  ↓
Admin review
  ↓
explicit customer price
  ↓
catalogue pending review
  ↓
separate publication approval
```

## Credential lifecycle

Admin can:

1. create a credential for a verified active supplier;
2. optionally set an expiry;
3. see the key prefix, scope and last-used time;
4. revoke the credential immediately.

Revoked, expired, unverified-supplier and paused-supplier credentials are rejected.

## Security notes

Do not place the supplier API key in browser code, source control, URLs or logs.

Store it as a server-side secret in the supplier's integration platform.

Rotate credentials by creating a new key, updating the supplier integration, validating the new key, and then revoking the old key.
