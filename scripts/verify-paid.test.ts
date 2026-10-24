// Run with: npm test   (Node 22.18+; no network, no PayPal credentials, mocked PayPal responses only)
import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyPaid } from "../lib/payments.ts";
import { fromPayPal, type PayPalOrder } from "../lib/paypal.ts";
import { priceCart } from "../lib/products.ts";

// Product 4 (Back Support Brace, £29.99) in Black / L/XL x2, plus product 5 (Cat Fountain, £44.99) in White x1 = £104.97
const items = [
  { sku: "4|Black|L/XL", quantity: "2" },
  { sku: "5|White|", quantity: "1" },
];

function order(status: string, captureStatus: string | null, value = "104.97", currency = "GBP", its = items): PayPalOrder {
  return {
    status,
    purchase_units: [{
      items: its,
      payments: captureStatus ? { captures: [{ status: captureStatus, amount: { currency_code: currency, value } }] } : undefined,
    }],
  };
}

test("catalogue total for the mocked basket is £104.97", () => {
  assert.equal(priceCart([{ id: 4, qty: 2, color: "Black", size: "L/XL" }, { id: 5, qty: 1, color: "White" }]).totalPence, 10497);
});

test("COMPLETED capture with the right amount and currency is paid", () => {
  assert.equal(verifyPaid(fromPayPal(order("COMPLETED", "COMPLETED"))), "paid");
});

test("COMPLETED capture with the wrong amount is not paid", () => {
  assert.equal(verifyPaid(fromPayPal(order("COMPLETED", "COMPLETED", "0.01"))), "failed");
  assert.equal(verifyPaid(fromPayPal(order("COMPLETED", "COMPLETED", "104.96"))), "failed");
});

test("COMPLETED capture in the wrong currency is not paid", () => {
  assert.equal(verifyPaid(fromPayPal(order("COMPLETED", "COMPLETED", "104.97", "USD"))), "failed");
});

test("PENDING capture is not paid (pending)", () => {
  assert.equal(verifyPaid(fromPayPal(order("COMPLETED", "PENDING"))), "pending");
});

test("DECLINED capture or order is not paid (failed)", () => {
  assert.equal(verifyPaid(fromPayPal(order("COMPLETED", "DECLINED"))), "failed");
  assert.equal(verifyPaid(fromPayPal(order("DECLINED", null))), "failed");
  assert.equal(verifyPaid(fromPayPal(order("VOIDED", null))), "failed");
});

test("approved-but-not-captured or created orders are not paid (pending)", () => {
  assert.equal(verifyPaid(fromPayPal(order("APPROVED", null))), "pending");
  assert.equal(verifyPaid(fromPayPal(order("CREATED", null))), "pending");
});

test("an order whose items are not real catalogue lines is not paid", () => {
  // e.g. an order made outside our server with a missing size or an unknown product
  assert.equal(verifyPaid(fromPayPal(order("COMPLETED", "COMPLETED", "59.98", "GBP", [{ sku: "4|Black|", quantity: "2" }]))), "failed");
  assert.equal(verifyPaid(fromPayPal(order("COMPLETED", "COMPLETED", "1.00", "GBP", [{ sku: "999||", quantity: "1" }]))), "failed");
  assert.equal(verifyPaid(fromPayPal(order("COMPLETED", "COMPLETED", "104.97", "GBP", []))), "failed");
});
