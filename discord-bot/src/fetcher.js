// Cached JSON GET for outside APIs (Trucky, TruckersMP). One request per URL at a time; when a source fails,
// the last good answer is served.
const cache = new Map(), inflight = new Map(), blocked = new Map();
const UA = `DieselUnionPortal/${require('../package.json').version}`; // Trucky refuses empty or default user agents

async function pull(url, headers) {
  const host = new URL(url).host;
  if ((blocked.get(host) || 0) > Date.now()) throw new Error(`${host} asked us to slow down`);
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json', 'Content-Type': 'application/json', ...headers }, signal: AbortSignal.timeout(15_000) });
  if (res.status === 429) { blocked.set(host, Date.now() + 120_000); throw new Error(`${host} rate limit`); }
  if (!res.ok) { const e = new Error(`${host} answered ${res.status}`); e.status = res.status; throw e; }
  return res.json();
}
async function getJson(url, { ttl = 300_000, headers } = {}) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < ttl) return hit.data;
  if (!inflight.has(url)) inflight.set(url, pull(url, headers).then((data) => { cache.set(url, { at: Date.now(), data }); if (cache.size > 300) cache.delete(cache.keys().next().value); return data; }).finally(() => inflight.delete(url)));
  try { return await inflight.get(url); } catch (err) { if (hit) return hit.data; throw err; }
}
async function send(method, url, body, headers) {
  const res = await fetch(url, { method, headers: { 'User-Agent': UA, Accept: 'application/json', 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(15_000) });
  let data = null; try { data = await res.json(); } catch { /* no body */ }
  return { ok: res.ok, status: res.status, data };
}
module.exports = { getJson, send, UA };
