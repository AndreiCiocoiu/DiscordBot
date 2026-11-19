// Convoys: created by staff on the site, plus the VTC's events on TruckersMP. Drivers answer "vin / poate / nu vin".
const crypto = require('crypto');
const { db, save, cfg } = require('./store');
const { getJson } = require('./fetcher');

const clean = (s, n) => String(s ?? '').replace(/\r/g, '').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim().slice(0, n);
const okUrl = (u) => { try { const x = new URL(String(u)); return /^https?:$/.test(x.protocol) ? x.href.slice(0, 400) : ''; } catch { return ''; } };

function add(by, b) {
  const title = clean(b.title, 80), start = Number(b.start);
  if (title.length < 3) return { ok: false, msg: 'Scrie un titlu pentru convoi.' };
  if (!(start > Date.now() - 3600_000)) return { ok: false, msg: 'Alege data și ora convoiului.' };
  const c = { id: crypto.randomBytes(5).toString('hex'), title, start, game: b.game === 'ATS' ? 'ATS' : 'ETS2', server: clean(b.server, 40), from: clean(b.from, 60), to: clean(b.to, 60),
    meet: clean(b.meet, 80), dlc: clean(b.dlc, 120), desc: clean(b.desc, 1500), image: okUrl(b.image), link: okUrl(b.link), rsvp: {}, by: { id: by.id, name: by.name }, at: Date.now(), reminded: false };
  db.convoys.push(c); save();
  return { ok: true, msg: 'Convoiul a fost adăugat.', item: c };
}
function remove(id) { const i = db.convoys.findIndex((c) => c.id === String(id)); if (i < 0) return { ok: false, msg: 'Convoiul nu mai există.' }; db.convoys.splice(i, 1); save(); return { ok: true, msg: 'Convoiul a fost șters.' }; }
function rsvp(id, user, status) {
  const c = db.convoys.find((x) => x.id === String(id)); if (!c) return { ok: false, msg: 'Convoiul nu mai există.' };
  if (!['yes', 'maybe', 'no'].includes(status)) return { ok: false, msg: 'Alege un răspuns.' };
  c.rsvp[user.id] = { name: user.name, avatar: user.avatar || null, status, at: Date.now() }; save();
  return { ok: true, msg: status === 'yes' ? 'Te-am trecut la convoi. Ne vedem pe drum.' : status === 'maybe' ? 'Te-am trecut la „poate”.' : 'Am notat că nu vii.' };
}
const pub = (c, uid) => {
  const r = Object.values(c.rsvp || {});
  return { ...c, rsvp: undefined, yes: r.filter((x) => x.status === 'yes').map(({ name, avatar }) => ({ name, avatar })), maybe: r.filter((x) => x.status === 'maybe').length, mine: uid ? c.rsvp?.[uid]?.status || null : null };
};
const list = (uid) => db.convoys.slice().sort((a, b) => a.start - b.start).map((c) => pub(c, uid));

// the VTC's events on TruckersMP (hosted and attending), read-only
async function tmpEvents() {
  const id = String(cfg().tmpId || '').match(/\d+/)?.[0];
  if (!id) return [];
  const pick = async (path) => { try { const d = await getJson(`https://api.truckersmp.com/v2/vtc/${id}/${path}`, { ttl: 15 * 60_000 }); const r = d?.response; return Array.isArray(r) ? r : Array.isArray(r?.events) ? r.events : []; } catch { return []; } };
  const [own, going] = await Promise.all([pick('events'), pick('events/attending')]);
  const seen = new Set(), out = [];
  for (const [e, kind] of [...own.map((e) => [e, 'host']), ...going.map((e) => [e, 'attend'])]) {
    if (!e?.id || seen.has(e.id)) continue; seen.add(e.id);
    const start = Date.parse(String(e.start_at || '').replace(' ', 'T') + 'Z');
    if (!(start > Date.now() - 6 * 3600_000)) continue;
    out.push({ id: `tmp-${e.id}`, tmp: true, kind, title: String(e.name || 'Eveniment').slice(0, 100), start, game: e.game === 'ATS' ? 'ATS' : 'ETS2', server: e.server?.name || '',
      from: [e.departure?.city, e.departure?.location].filter(Boolean).join(', '), to: [e.arrive?.city, e.arrive?.location].filter(Boolean).join(', '),
      image: /^https:\/\//.test(e.banner || '') ? e.banner : null, link: `https://truckersmp.com${e.url || `/events/${e.id}`}`, attending: e.attendances?.confirmed ?? null });
  }
  return out.sort((a, b) => a.start - b.start).slice(0, 12);
}

module.exports = { add, remove, rsvp, list, pub, tmpEvents };
