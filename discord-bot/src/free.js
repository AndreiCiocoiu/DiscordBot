// Free games: the Epic Games Store weekly giveaways (now and coming up), from Epic's public promotions feed.
const { getJson } = require('./fetcher');
const URL_ = 'https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=en-US&country=US&allowCountries=US';

const img = (e) => {
  const pick = (t) => e.keyImages?.find((k) => k.type === t && /^https:\/\//.test(k.url))?.url;
  return pick('OfferImageWide') || pick('DieselStoreFrontWide') || pick('featuredMedia') || pick('Thumbnail') || e.keyImages?.find((k) => /^https:\/\//.test(k.url))?.url || null;
};
const slug = (e) => e.catalogNs?.mappings?.find((m) => m.pageType === 'productHome')?.pageSlug || e.offerMappings?.[0]?.pageSlug || e.catalogNs?.mappings?.[0]?.pageSlug || e.productSlug || e.urlSlug;
// a promotion that makes the game free is a discount "to 0 percent of the price"
const freeOffer = (groups) => (groups || []).flatMap((g) => g.promotionalOffers || []).find((o) => o.discountSetting?.discountPercentage === 0);

async function epic() {
  const { data, stale } = await getJson(URL_, { ttl: 30 * 60_000 });
  const els = data?.data?.Catalog?.searchStore?.elements || [];
  const now = [], soon = [], t = Date.now();
  for (const e of els) {
    const cur = freeOffer(e.promotions?.promotionalOffers), next = freeOffer(e.promotions?.upcomingPromotionalOffers);
    const s = slug(e);
    const base = { id: e.id, title: e.title, desc: String(e.description || '').slice(0, 220), image: img(e), store: 'Epic Games',
      url: s && !/^[0-9a-f]{32}$/.test(s) ? `https://store.epicgames.com/p/${s}` : 'https://store.epicgames.com/free-games',
      worth: (e.price?.totalPrice?.originalPrice || 0) / 100 };
    if (cur && Date.parse(cur.startDate) <= t && Date.parse(cur.endDate) > t) now.push({ ...base, start: Date.parse(cur.startDate), end: Date.parse(cur.endDate) });
    else if (next && Date.parse(next.startDate) > t) soon.push({ ...base, start: Date.parse(next.startDate), end: Date.parse(next.endDate) });
  }
  now.sort((a, b) => a.end - b.end); soon.sort((a, b) => a.start - b.start);
  return { now, soon, stale };
}

module.exports = { epic };
