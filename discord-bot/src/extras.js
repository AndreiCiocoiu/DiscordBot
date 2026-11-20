// Company life: Driver of the Month, convoy attendance, leave of absence, inactivity, partners, scheduled posts.
// Pure data work here; the bot posts and gives roles, the website shows and edits.
const crypto = require('crypto');
const { db, save } = require('./store');
const stats = require('./stats');
const media = require('./media');

const DAY = 86400_000, INACTIVE_DAYS = 30;
const clean = (s, n) => String(s ?? '').replace(/\r/g, '').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim().slice(0, n);
const okUrl = (u) => { try { const x = new URL(String(u).trim()); return /^https?:$/.test(x.protocol) ? x.href.slice(0, 300) : ''; } catch { return ''; } };
const uidOf = (driverId) => Object.keys(db.links).find((d) => db.links[d] === String(driverId)) || null;

// ---- Driver of the Month: most kilometres last month ----
function lastMonth(now = Date.now()) {
  const to = stats.startOf('month', now), from = stats.startOf('month', to - DAY);
  const by = new Map();
  for (const j of stats.done()) if (j.end >= from && j.end < to) { const r = by.get(j.driver) || { driver: j.driver, name: j.driverName, km: 0, jobs: 0 }; r.km += j.km; r.jobs++; by.set(j.driver, r); }
  const rows = [...by.values()].sort((a, b) => b.km - a.km);
  const label = new Date(from + DAY).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'Europe/Bucharest' });
  return { from, to, label, rows, winner: rows[0] || null };
}
const dotm = () => (db.dotm || []).at(-1) || null;
function crown(m) { // record the winner, returns the previous holder's Discord ID
  db.dotm = db.dotm || [];
  const prev = dotm();
  db.dotm.push({ month: m.label, from: m.from, driver: m.winner.driver, name: m.winner.name, km: m.winner.km, jobs: m.winner.jobs, uid: uidOf(m.winner.driver), at: Date.now() });
  if (db.dotm.length > 60) db.dotm.shift();
  save();
  return prev?.uid || null;
}
const dotmCount = (driverId) => (db.dotm || []).filter((x) => x.driver === String(driverId)).length;

// ---- convoy attendance ----
function setAttendance(id, uids, by) {
  const c = db.convoys.find((x) => x.id === String(id)); if (!c) return { ok: false, msg: 'That convoy no longer exists.' };
  if (c.start > Date.now() + 3600_000) return { ok: false, msg: 'Mark attendance once the convoy has started.' };
  c.attended = [...new Set((Array.isArray(uids) ? uids : []).map(String).filter((u) => /^[0-9A-Za-z_-]{1,30}$/.test(u)))].slice(0, 200);
  c.attendedBy = { name: by.name, at: Date.now() }; save();
  return { ok: true, msg: `Attendance saved: ${c.attended.length} drivers.` };
}
const attended = (uid) => (uid ? db.convoys.filter((c) => (c.attended || []).includes(uid)).length : 0);
// who could have been there: everyone who said yes or maybe, plus every linked driver
function attendanceList(id) {
  const c = db.convoys.find((x) => x.id === String(id)); if (!c) return [];
  const out = new Map();
  for (const [uid, r] of Object.entries(c.rsvp || {})) if (r.status !== 'no') out.set(uid, { uid, name: r.name, rsvp: r.status, slot: r.slot || null });
  for (const [uid, t] of Object.entries(db.links)) if (!out.has(uid) && db.members[t] && !db.members[t].left) out.set(uid, { uid, name: db.members[t].name, rsvp: null });
  return [...out.values()].map((x) => ({ ...x, here: (c.attended || []).includes(x.uid) })).sort((a, b) => (b.rsvp === 'yes') - (a.rsvp === 'yes') || a.name.localeCompare(b.name));
}

// ---- leave of absence ----
function setLoa(uid, name, days, reason) {
  db.loa = db.loa || {};
  if (!days) { const had = !!db.loa[uid]; delete db.loa[uid]; save(); return { ok: true, msg: had ? 'Welcome back. Your leave is over.' : 'You are not on leave.', ended: had }; }
  const d = Math.max(1, Math.min(90, Math.round(Number(days)) || 0));
  db.loa[uid] = { name: clean(name, 40), from: Date.now(), until: Date.now() + d * DAY, reason: clean(reason, 300) }; save();
  return { ok: true, msg: `You are on leave until <t:${Math.floor(db.loa[uid].until / 1000)}:D>. Enjoy, and see you on the road.`, item: db.loa[uid] };
}
const onLeave = (uid) => { const l = (db.loa || {})[uid]; return l && l.until > Date.now() ? l : null; };

// ---- inactivity: linked drivers with no delivery for 30 days who are not on leave ----
function inactive(now = Date.now()) {
  const last = new Map();
  for (const j of stats.done()) last.set(j.driver, j.end);
  const out = [];
  for (const [uid, t] of Object.entries(db.links)) {
    const m = db.members[t]; if (!m || m.left) continue;
    const lj = last.get(t) || 0, since = Math.max(lj, m.joined || 0, db.applications.find((a) => a.discord === uid && a.onboarded)?.onboarded || 0);
    const days = Math.floor((now - since) / DAY);
    if (days >= INACTIVE_DAYS) out.push({ uid, driver: t, name: m.name, lastJob: lj || null, days, loa: onLeave(uid), warned: (db.warned || {})[uid] || null });
  }
  return out.sort((a, b) => b.days - a.days);
}
function toWarn(now = Date.now()) { return inactive(now).filter((x) => !x.loa && (!x.warned || now - x.warned > INACTIVE_DAYS * DAY)); }
function markWarned(uid) { db.warned = db.warned || {}; db.warned[uid] = Date.now(); save(); }

// ---- partners ----
function savePartner(b) {
  db.partners = db.partners || [];
  const name = clean(b.name, 60); if (name.length < 2) return { ok: false, msg: 'Give the partner a name.' };
  const p = { name, url: okUrl(b.url), tmp: okUrl(b.tmp), logo: media.image(b.logo), desc: clean(b.desc, 400) };
  if (b.id) { const x = db.partners.find((q) => q.id === String(b.id)); if (!x) return { ok: false, msg: 'That partner is gone.' }; Object.assign(x, p); save(); return { ok: true, msg: 'Partner saved.', item: x }; }
  if (db.partners.length >= 10) return { ok: false, msg: 'Ten partners at most (one Discord message holds ten).' };
  const x = { id: crypto.randomBytes(4).toString('hex'), ...p, at: Date.now() }; db.partners.push(x); save();
  return { ok: true, msg: 'Partner added.', item: x };
}
function removePartner(id) { const i = (db.partners || []).findIndex((q) => q.id === String(id)); if (i < 0) return { ok: false, msg: 'That partner is gone.' }; db.partners.splice(i, 1); save(); return { ok: true, msg: 'Partner removed.' }; }
function movePartner(id, dir) { const l = db.partners || [], i = l.findIndex((q) => q.id === String(id)), j = i + (dir < 0 ? -1 : 1); if (i < 0 || j < 0 || j >= l.length) return { ok: true, msg: 'Order saved.' }; [l[i], l[j]] = [l[j], l[i]]; save(); return { ok: true, msg: 'Order saved.' }; }
const partners = () => (db.partners || []).map(({ id, name, url, tmp, logo, desc }) => ({ id, name, url, tmp, logo, desc }));

// ---- scheduled posts ----
function schedule(p, by, at) {
  db.scheduled = db.scheduled || [];
  if (!(at > Date.now() + 60_000)) return { ok: false, msg: 'Pick a time at least a minute from now.' };
  if (at > Date.now() + 90 * DAY) return { ok: false, msg: 'Pick a time within the next 90 days.' };
  const x = { id: crypto.randomBytes(5).toString('hex'), p, by, at, created: Date.now() }; db.scheduled.push(x); save();
  return { ok: true, msg: `Scheduled for ${new Date(at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/London' })} (UK time).`, item: x };
}
const due = (now = Date.now()) => (db.scheduled || []).filter((x) => x.at <= now);
function unschedule(id) { const i = (db.scheduled || []).findIndex((x) => x.id === String(id)); if (i < 0) return null; const [x] = db.scheduled.splice(i, 1); save(); return x; }

module.exports = { lastMonth, dotm, crown, dotmCount, setAttendance, attended, attendanceList, setLoa, onLeave, inactive, toWarn, markWarned, savePartner, removePartner, movePartner, partners, schedule, due, unschedule, uidOf, INACTIVE_DAYS };
