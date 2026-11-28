const catalogue = {
  GB: { id: "prod_demo_001", name: "Weekender bag", market: "GB", currency: "GBP", priceMinor: 2400 },
  NG: { id: "prod_demo_002", name: "Canvas carryall", market: "NG", currency: "NGN", priceMinor: 1800000 },
};

const exampleOrderIds = {
  GB: { id: "evt_demo_001", orderId: "ord_demo_001" },
  NG: { id: "evt_demo_002", orderId: "ord_demo_002" },
};

const headers = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex",
};

export function sandboxExampleResponse(request: Request, example: "catalogue" | "order-paid") {
  const markets = new URL(request.url).searchParams.getAll("market");
  const market = markets[0];

  if (markets.length !== 1 || (market !== "GB" && market !== "NG")) {
    return Response.json(
      { error: { code: "INVALID_MARKET", message: "Provide exactly one market: GB or NG." } },
      { status: 400, headers },
    );
  }

  const product = catalogue[market];

  if (example === "catalogue") {
    return Response.json({ products: [product] }, { headers });
  }

  const { id, orderId } = exampleOrderIds[market];
  return Response.json({
    id,
    type: "order.paid",
    data: { orderId, market, currency: product.currency, totalMinor: product.priceMinor },
  }, { headers });
}
