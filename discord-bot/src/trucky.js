// Trucky VTC Hub: deliveries and members.
// Two ways in: Trucky calls our webhook the moment a job finishes or a member joins/leaves (fast, exact),
// and every few minutes we also read the company's latest jobs and members from the API, so nothing is
// missed while the bot was offline. Everything is stored locally and the stats are computed from it.
const crypto = require('crypto');
const { db, save, cfg } = require('./store');
const { getJson, send } = require('./fetcher');

const API = 'https://e.truckyapp.com/api/v1';
const MAX_JOBS = 20000;
const token = () => process.env.TRUCKY_TOKEN || '';
const auth = () => (token() ? { 'x-access-token': token() } : {});
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const when = (s) => { const t = Date.parse(String(s || '').replace(' ', 'T') + (/[zZ]|[+-]\d\d:?\d\d$/.test(String(s || '')) ? '' : 'Z')); return Number.isFinite(t) ? t : 0; };
let listeners = { job: [], member: [], cancel: [] };
const on = (ev, fn) => listeners[ev].push(fn);

// lists come back as [..], {data:[..]}, {data:{data:[..]}} or {response:[..]} depending on the endpoint
function rows(x) {
  if (Array.isArray(x)) return x;
  for (const k of ['data', 'response', 'items', 'members', 'jobs', 'results']) if (x && x[k] !== undefined) { const r = rows(x[k]); if (r.length || Array.isArray(x[k])) return r; }
  return [];
}

// one delivery, from a webhook payload or an API row, in our own small shape
function normJob(d) {
  if (!d || d.id === undefined) return null;
  const mi = String(d.distance_unit || '').toLowerCase() === 'mi', k = mi ? 1.609344 : 1;
  const kmRaw = d.real_driven_distance_km ?? d.driven_distance_km ?? (d.real_driven_distance ?? d.driven_distance) * k;
  const status = String(d.status || (d.completed_at ? 'completed' : d.canceled_at ? 'canceled' : 'in_progress')).toLowerCase().replace('cancelled', 'canceled');
  const driver = d.driver || d.user || {};
  const mass = num(d.cargo_mass) || num(d.cargo_unit_count) * num(d.cargo_unit_mass);
  return {
    id: String(d.id), status,
    driver: String(driver.id ?? d.user_id ?? d.driver_id ?? ''), driverName: String(driver.name || d.driver_name || 'Driver'), avatar: driver.avatar_url || driver.avatar || null,
    steam: String(driver.steam_profile?.steam_id || driver.steam_id || d.steam_id || ''),
    game: String(d.game?.code || d.game_code || d.game || 'ETS2').toUpperCase().includes('ATS') ? 'ATS' : 'ETS2',
    from: d.source_city_name || '', fromCo: d.source_company_name || '', to: d.destination_city_name || '', toCo: d.destination_company_name || '',
    cargo: d.cargo_name || d.cargo?.name || '', mass: Math.round(mass),
    km: Math.round(num(kmRaw)), planned: Math.round(num(d.planned_distance_km ?? num(d.planned_distance) * k)),
    income: Math.round(num(d.income ?? d.revenue)), dmg: Math.round(num(d.cargo_damage) * 10) / 10,
    truck: [d.vehicle_brand_name, d.vehicle_model_name].filter(Boolean).join(' '), mp: !!(d.game_mode && d.game_mode !== 'sp'), server: d.server || null,
    late: !!d.late_delivery, special: !!d.special_job,
    start: when(d.started_at), end: when(d.completed_at || d.canceled_at || d.updated_at),
  };
}
function upsertJob(j, fromWebhook) {
  if (!j) return false;
  const i = db.jobs.findIndex((x) => x.id === j.id), isNew = i < 0;
  const was = isNew ? null : db.jobs[i];
  if (isNew) db.jobs.push(j); else db.jobs[i] = { ...was, ...j };
  if (j.driver && !db.members[j.driver]) db.members[j.driver] = { id: j.driver, name: j.driverName, avatar: j.avatar, steam: j.steam, role: '', joined: j.start || Date.now(), seen: true };
  if (db.jobs.length > MAX_JOBS) db.jobs.splice(0, db.jobs.length - MAX_JOBS);
  const done = j.status === 'completed' && (!was || was.status !== 'completed');
  if (done) for (const fn of listeners.job) try { fn(j, fromWebhook); } catch (err) { console.warn('job listener:', err.message); }
  if (j.status === 'canceled' && (!was || was.status !== 'canceled')) for (const fn of listeners.cancel) try { fn(j, fromWebhook); } catch (err) { console.warn('cancel listener:', err.message); }
  return isNew || done;
}
function removeJob(id) { const i = db.jobs.findIndex((x) => x.id === String(id)); if (i >= 0) { db.jobs.splice(i, 1); return true; } return false; }

function normMember(m) {
  const u = m.user || m;
  const id = String(u.id ?? m.user_id ?? m.id ?? '');
  if (!id) return null;
  return { id, name: String(u.name || m.name || 'Driver'), avatar: u.avatar_url || m.avatar_url || null, steam: String(u.steam_profile?.steam_id || u.steam_id || m.steam_id || ''),
    role: String(m.role?.name || u.role?.name || m.role_name || ''), joined: when(m.joined_at || m.created_at || u.joined_at) || null };
}
function upsertMember(m, event) {
  const n = normMember(m); if (!n) return;
  const cur = db.members[n.id] || {};
  db.members[n.id] = { ...cur, ...Object.fromEntries(Object.entries(n).filter(([, v]) => v !== '' && v !== null)), joined: n.joined || cur.joined || Date.now(), left: null, seen: true };
  for (const fn of listeners.member) try { fn(event || 'update', db.members[n.id]); } catch { /* ignore */ }
}
function memberLeft(m, event) {
  const n = normMember(m); if (!n || !db.members[n.id]) return;
  db.members[n.id].left = Date.now();
  for (const fn of listeners.member) try { fn(event, db.members[n.id]); } catch { /* ignore */ }
}

// ---- webhook ----
function verify(raw, sig) {
  const secret = process.env.TRUCKY_WEBHOOK_SECRET;
  if (!secret) return true; // Trucky makes the secret optional; set it to reject forged calls
  const good = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  const got = String(sig || '').trim().toLowerCase();
  return got.length === good.length && crypto.timingSafeEqual(Buffer.from(good), Buffer.from(got));
}
function webhook(body) {
  const ev = String(body?.event || ''), d = body?.data || {};
  db.sync.lastHook = { at: Date.now(), event: ev };
  if (/^job_(completed|canceled|cancelled|created)$/.test(ev)) upsertJob(normJob(d), true);
  else if (ev === 'job_deleted') removeJob(d.id);
  else if (ev === 'user_joined_company' || ev === 'member_role_assigned' || ev === 'application_accepted') upsertMember(d.user || d.member || d, ev);
  else if (ev === 'member_left' || ev === 'member_kicked') memberLeft(d.user || d.member || d, ev);
  save();
  return ev;
}

// ---- polling ----
async function pollJobs(pages = 2) {
  const id = cfg().truckyId; if (!id) return { ok: false, msg: 'The Trucky company ID is missing.' };
  let added = 0;
  for (let p = 1; p <= pages; p++) {
    const data = await getJson(`${API}/company/${encodeURIComponent(id)}/jobs?page=${p}&perPage=50&sortingField=updated_at&sortingDirection=desc`, { ttl: 60_000, headers: auth() });
    const list = rows(data);
    for (const r of list) if (upsertJob(normJob(r), false)) added++;
    if (list.length < 20) break;
  }
  db.sync.jobs = { at: Date.now(), ok: true, added };
  save();
  return { ok: true, added };
}
async function pollMembers() {
  const id = cfg().truckyId; if (!id) return { ok: false };
  const data = await getJson(`${API}/company/${encodeURIComponent(id)}/members?perPage=500`, { ttl: 60_000, headers: auth() });
  const list = rows(data);
  if (!list.length) { db.sync.members = { at: Date.now(), ok: false }; return { ok: false }; }
  const seen = new Set();
  for (const m of list) { const n = normMember(m); if (n) { seen.add(n.id); upsertMember(m); } }
  // anyone we had who is no longer in the list has left
  for (const m of Object.values(db.members)) if (!seen.has(m.id) && !m.left) m.left = Date.now();
  db.sync.members = { at: Date.now(), ok: true, count: seen.size };
  save();
  return { ok: true, count: seen.size };
}
async function company() {
  const id = cfg().truckyId; if (!id) return null;
  try { const d = await getJson(`${API}/company/${encodeURIComponent(id)}`, { ttl: 3600_000, headers: auth() }); return d?.data || d?.response || d; } catch { return null; }
}

// add an accepted applicant to the company on Trucky (needs their Steam ID)
async function addDriver(steamId, name) {
  if (!token()) return { ok: false, msg: 'No Trucky token: add them in Trucky by hand.' };
  const r = await send('POST', `${API}/drivershub/members`, { steam_id: String(steamId), name: String(name || '').slice(0, 60) }, auth()).catch(() => ({ ok: false, data: null }));
  return r.ok ? { ok: true, msg: 'Also added on Trucky.' } : { ok: false, msg: `Trucky did not add them${r.data?.message ? `: ${r.data.message}` : ''}. They may still be in another company and have to leave it themselves.` };
}

module.exports = { normJob, upsertJob, normMember, verify, webhook, pollJobs, pollMembers, company, addDriver, on, rows };
