// Game discounts across stores (Steam, GOG, Epic, Humble, Fanatical...) from the CheapShark API.
// Prices are in USD. Links go through CheapShark's redirect, as their API asks.
const { getJson } = require('./fetcher');

const API = 'https://www.cheapshark.com/api/1.0';
const SITE = 'https://www.cheapshark.com';
const SORTS = { rating: 'Deal Rating', savings: 'Savings', price: 'Price', reviews: 'Reviews', metacritic: 'Metacritic', recent: 'recent', release: 'Release', title: 'Title' };
const num = (v, lo, hi) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : null; };

async function stores() {
  const { data } = await getJson(`${API}/stores`, { ttl: 12 * 3600_000 });
  const out = {};
  for (const s of Array.isArray(data) ? data : []) if (s.isActive) out[s.storeID] = { id: String(s.storeID), name: s.storeName, icon: s.images?.icon ? SITE + s.images.icon : null, logo: s.images?.logo ? SITE + s.images.logo : null };
  return out;
}

const link = (dealID) => `${SITE}/redirect?dealID=${dealID}`; // dealID arrives already URL-encoded
function shape(d) {
  return {
    id: d.dealID, gameId: String(d.gameID), title: d.title, store: String(d.storeID),
    sale: Number(d.salePrice), normal: Number(d.normalPrice), cut: Math.round(Number(d.savings) || 0),
    meta: Number(d.metacriticScore) || 0, steamPct: Number(d.steamRatingPercent) || 0, steamText: d.steamRatingText || '', steamCount: Number(d.steamRatingCount) || 0,
    appId: d.steamAppID || null, thumb: d.thumb || null, released: Number(d.releaseDate) || 0, changed: Number(d.lastChange) || 0, rating: Number(d.dealRating) || 0,
    url: link(d.dealID),
  };
}

// q: { store, sort, flip, max, min, cut, meta, steam, q, page, aaa, size }
async function list(q = {}) {
  const p = new URLSearchParams({ onSale: '1', pageSize: String(num(q.size, 1, 60) ?? 60), pageNumber: String(num(q.page, 0, 50) ?? 0) });
  const store = String(q.store || '').split(',').filter((s) => /^\d{1,3}$/.test(s)).slice(0, 12);
  if (store.length) p.set('storeID', store.join(','));
  const sort = SORTS[q.sort] || SORTS.rating;
  p.set('sortBy', sort);
  if (q.flip === '1' || q.flip === true) p.set('desc', '1'); // reverse the usual direction of the chosen sort
  const max = num(q.max, 0, 49); if (max !== null) p.set('upperPrice', String(max));
  const min = num(q.min, 0, 49); if (min) p.set('lowerPrice', String(min));
  const meta = num(q.meta, 0, 100); if (meta) p.set('metacritic', String(meta));
  const steam = num(q.steam, 0, 100); if (steam) p.set('steamRating', String(steam));
  const title = String(q.q || '').trim().slice(0, 60); if (title) p.set('title', title);
  if (q.aaa === '1' || q.aaa === true) p.set('AAA', '1');
  const { data, meta: hdr, stale } = await getJson(`${API}/deals?${p}`, { ttl: 8 * 60_000, headers: ['x-total-page-count'] });
  const raw = Array.isArray(data) ? data.length : 0;
  let items = (Array.isArray(data) ? data : []).map(shape);
  const cut = num(q.cut, 0, 100); if (cut) items = items.filter((d) => d.cut >= cut); // the API has no "minimum discount" filter
  return { items, raw, page: Number(p.get('pageNumber')), pages: Number(hdr?.['x-total-page-count']) || 0, stale };
}

// one game: every store's current price and the lowest price it ever had
async function game(id) {
  if (!/^\d{1,9}$/.test(String(id))) return null;
  const { data, stale } = await getJson(`${API}/games?id=${id}`, { ttl: 10 * 60_000 });
  if (!data?.info) return null;
  const deals = (data.deals || []).map((d) => ({ id: d.dealID, store: String(d.storeID), price: Number(d.price), retail: Number(d.retailPrice), cut: Math.round(Number(d.savings) || 0), url: link(d.dealID) })).sort((a, b) => a.price - b.price);
  return { gameId: String(id), title: data.info.title, appId: data.info.steamAppID || null, thumb: data.info.thumb || null,
    low: data.cheapestPriceEver ? { price: Number(data.cheapestPriceEver.price), at: Number(data.cheapestPriceEver.date) * 1000 } : null, deals, stale };
}

// several games at once (wishlist checks): ids -> { id: { title, best: { price, store, url } } }
async function many(ids) {
  const out = {};
  const clean = [...new Set(ids.map(String))].filter((i) => /^\d{1,9}$/.test(i));
  for (let i = 0; i < clean.length; i += 25) {
    const part = clean.slice(i, i + 25);
    try {
      const { data } = await getJson(`${API}/games?ids=${part.join(',')}`, { ttl: 20 * 60_000 });
      for (const id of part) {
        const g = data?.[id]; if (!g?.deals?.length) continue;
        const best = g.deals.reduce((a, b) => (Number(b.price) < Number(a.price) ? b : a));
        out[id] = { title: g.info?.title, thumb: g.info?.thumb, appId: g.info?.steamAppID || null, low: g.cheapestPriceEver ? Number(g.cheapestPriceEver.price) : null,
          best: { price: Number(best.price), retail: Number(best.retailPrice), store: String(best.storeID), url: link(best.dealID) } };
      }
    } catch (err) { console.warn('deals.many:', err.message); }
    if (i + 25 < clean.length) await new Promise((r) => setTimeout(r, 1200));
  }
  return out;
}

async function search(text) {
  const title = String(text || '').trim().slice(0, 60);
  if (title.length < 2) return [];
  const { data } = await getJson(`${API}/games?title=${encodeURIComponent(title)}&limit=24`, { ttl: 15 * 60_000 });
  return (Array.isArray(data) ? data : []).map((g) => ({ gameId: String(g.gameID), title: g.external, appId: g.steamAppID || null, thumb: g.thumb || null, cheapest: Number(g.cheapest), url: g.cheapestDealID ? link(g.cheapestDealID) : null }));
}

module.exports = { stores, list, game, many, search, SORTS };
