// Approximate currency conversion for display (prices come in USD). Daily reference rates from Frankfurter (ECB).
const { getJson } = require('./fetcher');
async function rates() {
  try {
    const { data } = await getJson('https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR,GBP,RON', { ttl: 12 * 3600_000 });
    const r = data?.rates || {};
    const out = {};
    for (const k of ['EUR', 'GBP', 'RON']) if (Number(r[k]) > 0) out[k] = Number(r[k]);
    return out;
  } catch { return {}; }
}
module.exports = { rates };
