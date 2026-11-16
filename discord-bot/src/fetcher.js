// Cached JSON GET for the outside price sources. One request per URL at a time, answers kept for a while,
// and when a source is down or rate-limits us the last good answer is served instead of an error.
const cache = new Map();   // url -> { at, data, meta }
const inflight = new Map();
const blocked = new Map(); // host -> time until which we do not call it (after a 429)
const UA = `GamePortal/${require('../package.json').version} (Discord community deals portal)`;

async function pull(url, headersWanted) {
  const host = new URL(url).host;
  if ((blocked.get(host) || 0) > Date.now()) throw new Error(`${host} asked us to slow down`);
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(10_000) });
  if (res.status === 429) { blocked.set(host, Date.now() + 90_000); throw new Error(`${host} rate limit`); }
  if (!res.ok) throw new Error(`${host} answered ${res.status}`);
  const meta = {};
  for (const h of headersWanted || []) meta[h] = res.headers.get(h);
  return { data: await res.json(), meta };
}

// -> { data, meta, stale } ; throws only when there is nothing cached at all
async function getJson(url, { ttl = 600_000, headers } = {}) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < ttl) return { ...hit, stale: false };
  if (!inflight.has(url)) {
    inflight.set(url, pull(url, headers).then((r) => {
      cache.set(url, { at: Date.now(), ...r });
      if (cache.size > 500) cache.delete(cache.keys().next().value);
      return r;
    }).finally(() => inflight.delete(url)));
  }
  try { const r = await inflight.get(url); return { ...r, stale: false }; }
  catch (err) {
    if (hit) return { ...hit, stale: true };
    throw err;
  }
}

module.exports = { getJson };
