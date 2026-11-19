// Leaderboards and totals, computed from the stored deliveries (cached until the data changes).
const { db, cfg, rev } = require('./store');

const TZ = 'Europe/Bucharest';
// start of the current week (Monday 00:00) and month in Romanian time, as epoch ms
function startOf(period, now = Date.now()) {
  if (period === 'all') return 0;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(now)).map((p) => [p.type, p.value]));
  const local = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute);
  const offset = local - Math.floor(now / 60000) * 60000; // how far Bucharest is ahead of UTC right now
  let day = Date.UTC(+parts.year, +parts.month - 1, +parts.day);
  if (period === 'month') day = Date.UTC(+parts.year, +parts.month - 1, 1);
  if (period === 'week') { const wd = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(parts.weekday); day -= wd * 86400000; }
  return day - offset;
}
// completed deliveries, oldest first (jobs arrive out of order from the webhook and the API)
let doneMemo = { rev: -1, list: [] };
function done() {
  if (doneMemo.rev !== rev()) doneMemo = { rev: rev(), list: db.jobs.filter((j) => j.status === 'completed' && j.km >= (cfg().minJobKm || 0)).sort((a, b) => a.end - b.end) };
  return doneMemo.list;
}

function rankFor(km) {
  const list = [...cfg().ranks].sort((a, b) => a.km - b.km);
  let i = 0; for (let k = 0; k < list.length; k++) if (km >= list[k].km) i = k;
  const next = list[i + 1] || null;
  return { name: list[i]?.name || '', index: i, of: list.length, next: next ? { name: next.name, km: next.km } : null, from: list[i]?.km || 0 };
}

let memo = { rev: -1 };
function all() {
  if (memo.rev === rev() && Date.now() - memo.at < 60_000) return memo;
  const jobs = done(), w = startOf('week'), m = startOf('month');
  const per = {}, tot = { week: z(), month: z(), all: z() };
  function z() { return { jobs: 0, km: 0, income: 0, mass: 0, dmg: 0, drivers: new Set() }; }
  const add = (o, j) => { o.jobs++; o.km += j.km; o.income += j.income; o.mass += j.mass; o.dmg += j.dmg; o.drivers?.add(j.driver); };
  for (const j of jobs) {
    const p = (per[j.driver] ||= { all: z(), month: z(), week: z(), last: 0, games: { ETS2: 0, ATS: 0 }, cities: {} });
    add(p.all, j); add(tot.all, j); p.last = Math.max(p.last, j.end); p.games[j.game]++;
    if (j.to) p.cities[j.to] = (p.cities[j.to] || 0) + 1;
    if (j.end >= m) { add(p.month, j); add(tot.month, j); }
    if (j.end >= w) { add(p.week, j); add(tot.week, j); }
  }
  for (const k of Object.keys(tot)) tot[k].drivers = tot[k].drivers.size;
  memo = { rev: rev(), at: Date.now(), per, tot };
  return memo;
}

function driverCard(id) {
  const m = db.members[id]; if (!m) return null;
  const s = all().per[id];
  const km = s?.all.km || 0;
  return { id, name: m.name, avatar: m.avatar, role: m.role, joined: m.joined, left: m.left || null, steam: m.steam || null, discord: Object.keys(db.links).find((d) => db.links[d] === id) || null,
    rank: rankFor(km), km, jobs: s?.all.jobs || 0, income: s?.all.income || 0, monthKm: s?.month.km || 0, weekKm: s?.week.km || 0, last: s?.last || 0 };
}
function roster() { return Object.values(db.members).filter((m) => !m.left).map((m) => driverCard(m.id)).sort((a, b) => b.km - a.km); }

function board(period = 'month', metric = 'km') {
  const p = ['week', 'month', 'all'].includes(period) ? period : 'month', k = ['km', 'income', 'jobs'].includes(metric) ? metric : 'km';
  const per = all().per;
  return Object.entries(per).map(([id, s]) => ({ ...driverCard(id) ?? { id, name: 'Former driver' }, v: s[p][k], jobsP: s[p].jobs, kmP: s[p].km, incomeP: s[p].income }))
    .filter((r) => r.v > 0).sort((a, b) => b.v - a.v).slice(0, 100);
}

function profile(id) {
  const c = driverCard(id); if (!c) return null;
  const s = all().per[id];
  const jobs = done().filter((j) => j.driver === id);
  // the last six months, kilometres per month
  const months = []; const now = new Date();
  for (let i = 5; i >= 0; i--) { const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)); months.push({ key: `${d.getUTCFullYear()}-${d.getUTCMonth()}`, label: d.toLocaleDateString('en-GB', { month: 'short' }), km: 0 }); }
  for (const j of jobs) { const d = new Date(j.end); const mo = months.find((x) => x.key === `${d.getUTCFullYear()}-${d.getUTCMonth()}`); if (mo) mo.km += j.km; }
  const fav = Object.entries(s?.cities || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const longest = jobs.reduce((a, j) => (j.km > (a?.km || 0) ? j : a), null);
  return { ...c, month: s?.month || null, week: s?.week || null, games: s?.games || { ETS2: 0, ATS: 0 }, avgDmg: s?.all.jobs ? Math.round((s.all.dmg / s.all.jobs) * 10) / 10 : 0,
    fav, longest, months: months.map(({ label, km }) => ({ label, km })), recent: jobs.slice(-12).reverse() };
}

module.exports = { all, board, roster, profile, driverCard, rankFor, startOf, done };
