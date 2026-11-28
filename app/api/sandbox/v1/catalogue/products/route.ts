const catalogue = {
  GB: { id: "prod_demo_001", name: "Weekender bag", market: "GB", currency: "GBP", priceMinor: 2400 },
  NG: { id: "prod_demo_002", name: "Canvas carryall", market: "NG", currency: "NGN", priceMinor: 1800000 },
};

const headers = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex",
};

export function GET(request: Request) {
  const markets = new URL(request.url).searchParams.getAll("market");
  const market = markets[0];

  if (markets.length !== 1 || (market !== "GB" && market !== "NG")) {
    return Response.json(
      { error: { code: "INVALID_MARKET", message: "Provide exactly one market: GB or NG." } },
      { status: 400, headers },
    );
  }

  return Response.json({ products: [catalogue[market]] }, { headers });
}
