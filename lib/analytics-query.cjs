const ranges = new Set(['7d', '30d', '90d', 'all']);
const markets = new Set(['all', 'GB', 'NG']);
function parseAnalyticsQuery(input = {}) {
  const range = input.range === undefined ? 'all' : input.range;
  const market = input.market === undefined ? 'all' : input.market;
  if (!ranges.has(range) || !markets.has(market)) {
    const error = new Error('Choose a valid analytics period and market.');
    error.statusCode = 400;
    throw error;
  }
  return { range, market };
}
module.exports = { parseAnalyticsQuery };
