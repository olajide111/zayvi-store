const deliveryQuotes = {
  GB: { currency: "GBP", shippingMinor: 395 },
  NG: { currency: "NGN", shippingMinor: 250000 }
};

const deliveryMigration = "0025_order_delivery_address.sql";

function checkoutError(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

function previewDeliveryQuote(marketCode) {
  if (!Object.hasOwn(deliveryQuotes, marketCode)) {
    throw checkoutError("Unsupported delivery market.");
  }

  return { marketCode, ...deliveryQuotes[marketCode] };
}

function normalizeDeliveryAddress(address, marketCode) {
  if (!address || typeof address !== "object" || Array.isArray(address)) {
    throw checkoutError("Enter a delivery address.");
  }

  function text(key, label, required = false) {
    const value = typeof address[key] === "string" ? address[key].trim() : "";
    if (required && !value) throw checkoutError(`Enter ${label}.`);
    if (value.length > 120 || /[\u0000-\u001f\u007f]/.test(value)) {
      throw checkoutError(`Check ${label}.`);
    }
    return value;
  }

  const line1 = text("line1", "the street address", true);
  const line2 = text("line2", "the second address line");
  const city = text("city", "the town or city", true);
  const region = text("region", marketCode === "NG" ? "the state or FCT" : "the county", marketCode === "NG");
  const rawPostcode = text("postcode", "the postcode", marketCode === "GB");
  let postcode = rawPostcode;
  if (marketCode === "GB") {
    const compact = rawPostcode.toUpperCase().replace(/\s+/g, "");
    if (!/^(?:GIR0AA|[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2})$/.test(compact)) {
      throw checkoutError("Enter a valid UK postcode.");
    }
    postcode = compact.slice(0, -3) + " " + compact.slice(-3);
  } else if (postcode && !/^\d{6}$/.test(postcode)) {
    throw checkoutError("Enter a six-digit Nigerian postcode or leave it blank.");
  }

  return { countryCode: marketCode, line1, line2, city, region, postcode };
}

module.exports = { checkoutError, deliveryMigration, normalizeDeliveryAddress, previewDeliveryQuote };
