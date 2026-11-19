function reviewSupplierImage(candidate, input) {
  if (!candidate.image_url || input?.imageDecision === "omit" || input?.imageDecision === undefined) {
    return { image: "", imageRights: null };
  }

  if (input.expectedImageUrl !== candidate.image_url) {
    throw Object.assign(new Error("The supplier image changed. Reload the candidate before approving it."), { statusCode: 409 });
  }

  let source;
  try {
    source = new URL(candidate.image_url);
  } catch {
    source = null;
  }
  if (source?.protocol !== "https:" || source.username || source.password) {
    throw Object.assign(new Error("Use an HTTPS supplier image or approve without the image."), { statusCode: 400 });
  }
  const evidence = typeof input.imageEvidence === "string" ? input.imageEvidence.trim() : "";
  if (input.imageDecision !== "licensed" || evidence.length < 10 || evidence.length > 1000 || evidence.includes("\u0000")) {
    throw Object.assign(new Error("Record the supplier's storefront image permission or approve without the image."), { statusCode: 400 });
  }

  return {
    image: candidate.image_url,
    imageRights: {
      supplierId: candidate.supplier_id,
      sourceUrl: candidate.image_url,
      marketCode: candidate.market_code,
      scope: "storefront",
      evidence,
      reviewedAt: new Date().toISOString()
    }
  };
}

function storefrontImage(attributes, marketCode) {
  const image = attributes.image || "";
  if (attributes.discoverySource !== "supplier_feed") return image;
  const rights = attributes.imageRights;
  return rights?.scope === "storefront" && rights.marketCode === marketCode && rights.sourceUrl === image ? image : "";
}

module.exports = { reviewSupplierImage, storefrontImage };
