// Wishlist with a target price per game. Every half hour the current best price of every watched game is
// looked up; when it reaches the target, the owner gets a Discord message (once per price level).
const { db, save } = require('./store');
const deals = require('./deals');

const MAX = 40;
const mine = (uid) => (db.watch[uid] ||= []);

async function add(uid, b) {
  const target = Math.round(Number(b.target) * 100) / 100;
  if (!(target >= 0) || target > 500) return { ok: false, msg: 'Scrie un preț țintă între 0 și 500 de dolari.' };
  const g = await deals.game(b.gameId).catch(() => null);
  if (!g) return { ok: false, msg: 'Nu am găsit jocul. Încearcă din nou peste un minut.' };
  const list = mine(uid), best = g.deals[0] || null;
  let e = list.find((x) => x.gameId === g.gameId);
  if (!e) {
    if (list.length >= MAX) return { ok: false, msg: `Poți urmări cel mult ${MAX} de jocuri. Scoate unul din listă.` };
    e = { gameId: g.gameId, addedAt: Date.now() }; list.unshift(e);
  }
  Object.assign(e, { title: g.title, thumb: g.thumb, appId: g.appId, target, low: g.low?.price ?? null,
    price: best?.price ?? null, store: best?.store ?? null, url: best?.url ?? null, checkedAt: Date.now(), notified: null });
  save();
  return { ok: true, msg: best && best.price <= target ? `${g.title} e deja la prețul dorit.` : `Urmăresc ${g.title}. Te anunț pe Discord când scade la ${target.toFixed(2)} $.`, hit: !!best && best.price <= target };
}
function remove(uid, gameId) {
  const list = mine(uid), i = list.findIndex((x) => x.gameId === String(gameId));
  if (i < 0) return { ok: false, msg: 'Jocul nu e în lista ta.' };
  list.splice(i, 1); save();
  return { ok: true, msg: 'Am scos jocul din listă.' };
}

// refresh prices; notify(uid, entry) is called for every entry that just reached its target
async function check(notify) {
  const ids = Object.values(db.watch).flat().map((e) => e.gameId);
  if (!ids.length) return 0;
  const now = await deals.many(ids);
  let sent = 0;
  for (const [uid, list] of Object.entries(db.watch)) {
    for (const e of list) {
      const g = now[e.gameId]; if (!g) continue;
      Object.assign(e, { price: g.best.price, store: g.best.store, url: g.best.url, low: g.low ?? e.low, checkedAt: Date.now() });
      if (g.best.price <= e.target && (e.notified === null || e.notified === undefined || g.best.price < e.notified)) {
        e.notified = g.best.price; sent++;
        try { await notify(uid, e); } catch (err) { console.warn('watch notify:', err.message); }
      } else if (g.best.price > e.target) e.notified = null; // went back up: a later drop notifies again
    }
  }
  save();
  return sent;
}

module.exports = { mine, add, remove, check, MAX };
