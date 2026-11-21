// The Diesel Union portal, served by the bot process itself.
// Public: home, drivers, deliveries, leaderboard, convoys. Log in with Discord: RSVP, apply, link your Trucky driver.
// Staff (Manage Server, STAFF_ROLE_ID or ADMIN_IDS): convoys, applications, settings.
// Trucky webhook: POST /trucky/webhook (set it in Trucky -> Company Settings -> API).
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { db, save, cfg } = require('./store');
const stats = require('./stats');
const trucky = require('./trucky');
const convoys = require('./convoys');
const apply = require('./apply');
const media = require('./media');
const G = require('./guild');
const X = require('./extras');
const cleanT = (s, n) => String(s ?? '').replace(/\r/g, '').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim().slice(0, n);

const ROOT = path.join(__dirname, '..');
const TTL_MS = 7 * 86400_000;
const STATIC = {
  '/': ['web/index.html', 'text/html; charset=utf-8'], '/app.js': ['web/app.js', 'text/javascript; charset=utf-8'],
  '/style.css': ['web/style.css', 'text/css; charset=utf-8'], '/premium.css': ['web/premium.css', 'text/css; charset=utf-8'],
};
const IMG = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg' };
for (const f of fs.readdirSync(path.join(ROOT, 'assets', 'img'))) { const ext = f.split('.').pop(); if (IMG[ext]) STATIC[`/img/${f}`] = [`assets/img/${f}`, IMG[ext]]; }
for (const f of fs.readdirSync(path.join(ROOT, 'assets', 'fonts'))) if (/\.woff2$/.test(f)) STATIC[`/fonts/${f}`] = [`assets/fonts/${f}`, 'font/woff2'];
const CSP = "default-src 'self'; img-src 'self' https: data:; style-src 'self'; script-src 'self'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";

const SECRET = crypto.createHash('sha256').update(`diesel-web:${process.env.SESSION_SECRET || process.env.DISCORD_TOKEN || 'dev'}`).digest();
const mac = (s) => crypto.createHmac('sha256', SECRET).update(s).digest('base64url');
function sign(o) { const p = Buffer.from(JSON.stringify(o)).toString('base64url'); return `${p}.${mac(p)}`; }
function unsign(t) {
  const [p, m] = String(t || '').split('.'); if (!p || !m) return null;
  const a = Buffer.from(mac(p)), b = Buffer.from(m);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try { const o = JSON.parse(Buffer.from(p, 'base64url').toString()); return o.exp > Date.now() ? o : null; } catch { return null; }
}
const cookies = (req) => Object.fromEntries(String(req.headers.cookie || '').split(';').map((c) => c.trim().split(/=(.*)/s).slice(0, 2)).filter(([k]) => k));
const isHttps = (req) => (process.env.WEB_URL || '').startsWith('https') || String(req.headers['x-forwarded-proto'] || '').split(',')[0] === 'https';
const setCookie = (req, n, v, age) => `${n}=${v}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${isHttps(req) ? '; Secure' : ''}`;
const baseUrl = (req) => (process.env.WEB_URL || `${String(req.headers['x-forwarded-proto'] || 'http').split(',')[0]}://${req.headers.host}`).replace(/\/$/, '');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const send = (res, code, body, h = {}) => { res.writeHead(code, { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'Content-Security-Policy': CSP, ...h }); res.end(body); };
const json = (res, code, o) => send(res, code, JSON.stringify(o), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
const page = (res, code, title, text) => send(res, code, `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><link rel="stylesheet" href="/style.css"><body class="plain"><main class="notice"><h1>${esc(title)}</h1><p>${esc(text)}</p><p><a class="btn" href="/">Back to the portal</a></p></main>`, { 'Content-Type': 'text/html; charset=utf-8' });

const hits = new Map();
function limited(req, max = 240) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim(), now = Date.now(), e = hits.get(ip) || { n: 0, t: now };
  if (now - e.t > 60_000) { e.n = 0; e.t = now; } e.n++; hits.set(ip, e); if (hits.size > 5000) hits.clear();
  return e.n > max;
}
async function raw(req, max = 2_000_000) { const c = []; let n = 0; for await (const x of req) { n += x.length; if (n > max) throw new Error('too big'); c.push(x); } return Buffer.concat(c); }
const publicCfg = () => { const c = cfg(); return { name: c.name, tag: c.tag, tagline: c.tagline, recruitOpen: c.recruitOpen, ranks: c.ranks, about: c.about, requirements: c.requirements, discordInvite: c.discordInvite,
  tmpUrl: c.tmpId ? `https://truckersmp.com/vtc/${c.tmpId}` : '', truckyUrl: /^https:\/\//.test(c.truckyUrl || '') ? c.truckyUrl : '', trucky: !!c.truckyId }; };
const PANEL = new Set(['/api/admin/link', '/api/admin/unlink', '/api/admin/mod', '/api/upload', '/api/post', '/api/post/delete', '/api/convoys', '/api/convoys/publish', '/api/convoys/remove', '/api/scheduled/cancel', '/api/panel/attendance', '/api/partners/save', '/api/partners/remove', '/api/partners/move', '/api/admin/grant', '/api/admin/revoke', '/api/admin/warn', '/api/admin/run']);
const PRIVATE = new Set(['/api/drivers', '/api/driver', '/api/jobs', '/api/board']);
const recent = (n) => stats.done().slice(-n).reverse();

function start() {
  let bot = null;
  if (process.env.WEB_DISABLED === '1') return { setBot() {} };
  const port = Number(process.env.PORT) || 3000;
  const clientId = () => process.env.DISCORD_CLIENT_ID || bot?.client.application?.id || bot?.client.user?.id;
  const roleOf = async (s) => (s && bot ? bot.role(s.id) : null);
  // who sees the drivers, deliveries and leaderboard: staff, anyone linked to an active Trucky driver, or anyone with the member role
  const memberOf = async (s) => {
    if (!s) return false;
    const t = db.links[s.id]; if (t && db.members[t] && !db.members[t].left) return true;
    if (await roleOf(s)) return true;
    return !!(bot && await bot.isMember(s.id));
  };

  // ---- the team panel: CEO / Co-CEO post anywhere, Media Manager in the media channels, Event Team plans convoys ----
  const access = async (s) => { if (!s || !bot?.access) return null; const a = await bot.access(s.id); return a.caps.post || a.caps.media || a.caps.events ? a : null; };
  const pingsFor = () => convoys.PINGS;
  async function panel(route, b, s, acc) {
    const by = { id: s.id, name: s.name };
    if (route === '/api/upload') return media.store(b.data);
    if (route === '/api/post') {
      if (!acc.caps.media) return null;
      const allowed = acc.caps.post ? new Set(bot.channels().map((c) => c.id)) : new Set(bot.mediaChannels());
      if (!allowed.has(String(b.channel))) return { ok: false, msg: 'Pick a channel you can post in.' };
      const ping = convoys.pingOf(b.ping);
      const color = /^#[0-9a-f]{6}$/i.test(b.color || '') ? parseInt(b.color.slice(1), 16) : undefined;
      const link = /^https?:\/\/\S+$/.test(String(b.link || '').trim()) ? String(b.link).trim().slice(0, 400) : '';
      const p = { channel: String(b.channel), title: cleanT(b.title, 250), text: String(b.text ?? '').replace(/\r/g, '').slice(0, 4000), color, image: media.image(b.image), link, linkLabel: cleanT(b.linkLabel, 80) || 'Open link', ping, plain: !!b.plain };
      if (!p.title && !p.text.trim() && !p.image) return { ok: false, msg: 'Write a title or a message, or add a picture.' };
      if (b.at) return X.schedule(p, by, Number(b.at));
      const out = await bot.publish(p); if (!out.ok) return out;
      db.posts.push({ id: crypto.randomBytes(5).toString('hex'), ref: out.ref, channel: out.channelName, title: p.title || p.text.slice(0, 60), image: p.image, ping, by, at: Date.now() });
      if (db.posts.length > 300) db.posts.splice(0, db.posts.length - 300);
      save();
      return { ok: true, msg: `Posted in #${out.channelName}.` };
    }
    if (route === '/api/post/delete') {
      const i = db.posts.findIndex((p) => p.id === String(b.id)); if (i < 0) return { ok: false, msg: 'That post is gone already.' };
      if (!acc.caps.post && db.posts[i].by.id !== s.id) return null;
      await bot.unpost(db.posts[i].ref); db.posts.splice(i, 1); save();
      return { ok: true, msg: 'Deleted from Discord.' };
    }
    if (route === '/api/scheduled/cancel') {
      const x = (db.scheduled || []).find((q) => q.id === String(b.id)); if (!x) return { ok: false, msg: 'That post has already gone out.' };
      if (!acc.caps.post && x.by.id !== s.id) return null;
      X.unschedule(x.id); return { ok: true, msg: 'Scheduled post cancelled.' };
    }
    if (route.startsWith('/api/partners/')) {
      if (!acc.caps.post) return null;
      const r = route === '/api/partners/save' ? X.savePartner(b) : route === '/api/partners/remove' ? X.removePartner(b.id) : X.movePartner(b.id, Number(b.dir));
      if (r.ok) bot.refreshPanels?.();
      return r;
    }
    if (route.startsWith('/api/admin/')) {
      if (!acc.caps.manage) return null;
      const uid = String(b.uid || '');
      if (route === '/api/admin/grant') return /^\d{5,25}$/.test(uid) ? bot.grant(uid) : { ok: false, msg: 'Missing member.' };
      if (route === '/api/admin/revoke') return /^\d{5,25}$/.test(uid) ? bot.revoke(uid) : { ok: false, msg: 'Missing member.' };
      if (route === '/api/admin/link') {
        let who = String(b.who || '').trim().replace(/^<@!?(\d+)>$/, '$1');
        if (!/^\d{15,25}$/.test(who)) { const found = await bot.findMembers(who); const exact = found.filter((m) => m.tag.toLowerCase() === who.toLowerCase().replace(/^@/, '') || m.name.toLowerCase() === who.toLowerCase()); const pick = exact.length === 1 ? exact[0] : found.length === 1 ? found[0] : null; if (!pick) return { ok: false, msg: found.length ? 'More than one member matches. Use their Discord user ID.' : 'Nobody on the Discord server matches that.' }; who = pick.uid; }
        return bot.link(who, String(b.driver || ''), s.name);
      }
      if (route === '/api/admin/unlink') return /^\d{5,25}$/.test(uid) ? bot.unlink(uid, s.name) : { ok: false, msg: 'Missing member.' };
      if (route === '/api/admin/mod') {
        const action = String(b.action);
        if ((action === 'ban' || action === 'unban') && !acc.caps.ban) return { ok: false, msg: 'Only CEO, Co-CEO and Management can ban.' };
        if (!/^\d{5,25}$/.test(uid)) return { ok: false, msg: 'Pick a member first.' };
        return bot.moderate(action, uid, { reason: b.reason, minutes: b.minutes, days: b.days, name: cleanT(b.name, 40) }, { id: s.id, name: s.name, role: acc.role });
      }
      if (route === '/api/admin/warn') return /^\d{5,25}$/.test(uid) ? bot.warn(uid) : { ok: false, msg: 'Missing member.' };
      if (route === '/api/admin/run') {
        if (!acc.caps.post) return null;
        const w = String(b.what);
        if (w === 'dotm') return bot.driverOfMonth(true);
        if (w === 'potw') return bot.photoOfWeek(true);
        if (w === 'weekly') return bot.weekly();
        if (w === 'inactivity') return bot.inactivity(true);
        if (w === 'panels') { await bot.refreshPanels?.(); return { ok: true, msg: 'Discord panels refreshed.' }; }
        if (w === 'repair') return acc.role === 'admin' ? bot.repair() : { ok: false, msg: 'Only server admins can repair the server.' };
        if (w === 'sync') { const j = await trucky.pollJobs(5).catch((err) => ({ ok: false, msg: err.message })); await trucky.pollMembers().catch(() => {}); return j.ok ? { ok: true, msg: `Synced with Trucky: ${j.added} new jobs.` } : { ok: false, msg: j.msg }; }
        return { ok: false, msg: 'Unknown action.' };
      }
    }
    if (!acc.caps.events) return null;
    if (route === '/api/panel/attendance') return X.setAttendance(b.id, b.uids, by);
    if (route === '/api/convoys') {
      const r = convoys.add(by, b); if (!r.ok) return r;
      if (!r.item.draft && (b.announce || r.item.post)) { const ref = await bot.convoyPost(r.item, b.ping); if (!ref) r.msg += ' (Could not post on Discord: check the convoys channel.)'; else if (!r.updated) r.msg = 'Convoy added and announced on Discord.'; else r.msg = 'Convoy saved and the Discord post updated.'; }
      return { ok: true, msg: r.msg, id: r.item.id };
    }
    if (route === '/api/convoys/publish') {
      const c = db.convoys.find((x) => x.id === String(b.id)); if (!c) return { ok: false, msg: 'That convoy no longer exists.' };
      c.draft = false; if (b.ping !== undefined) c.ping = convoys.pingOf(b.ping); save();
      const ref = await bot.convoyPost(c, c.ping);
      return ref ? { ok: true, msg: 'Published and announced on Discord.' } : { ok: true, msg: 'Published on the website. The bot could not post on Discord.' };
    }
    if (route === '/api/convoys/remove') {
      const r = convoys.remove(b.id); if (r.ok && r.item.post) await bot.unpost(r.item.post);
      return r;
    }
    return null;
  }

  async function login(req, res) {
    if (!process.env.DISCORD_CLIENT_SECRET) return page(res, 503, 'Login not set up', 'An admin needs to add the DISCORD_CLIENT_SECRET variable on Railway.');
    if (!clientId()) return page(res, 503, 'The bot is starting', 'Try again in a few seconds.');
    const state = crypto.randomBytes(16).toString('hex');
    const q = new URLSearchParams({ client_id: clientId(), response_type: 'code', scope: 'identify', redirect_uri: `${baseUrl(req)}/auth/callback`, state, prompt: 'none' });
    send(res, 302, '', { Location: `https://discord.com/oauth2/authorize?${q}`, 'Set-Cookie': setCookie(req, 'st', state, 600) });
  }
  async function callback(req, res, url) {
    const state = url.searchParams.get('state'), code = url.searchParams.get('code');
    if (!code || !state || cookies(req).st !== state) return page(res, 400, 'Login failed', 'The login session expired. Try again.');
    try {
      const tok = await fetch('https://discord.com/api/oauth2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: clientId(), client_secret: process.env.DISCORD_CLIENT_SECRET, grant_type: 'authorization_code', code, redirect_uri: `${baseUrl(req)}/auth/callback` }) }).then((r) => r.json());
      if (!tok.access_token) return page(res, 400, 'Login failed', 'Discord refused the code. Check the /auth/callback redirect in the Developer Portal and DISCORD_CLIENT_SECRET.');
      const me = await fetch('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${tok.access_token}` } }).then((r) => r.json());
      if (!me?.id) return page(res, 400, 'Login failed', 'Discord did not send the account. Try again.');
      const s = { id: me.id, name: String(me.global_name || me.username || 'Driver').slice(0, 40), avatar: me.avatar ? `https://cdn.discordapp.com/avatars/${me.id}/${me.avatar}.png?size=96` : null, exp: Date.now() + TTL_MS };
      db.web[s.id] = Date.now(); save(); // onboarding step: logged in on the website
      if (bot?.onboard) bot.onboard(s.id).catch(() => {});
      send(res, 302, '', { Location: '/', 'Set-Cookie': [setCookie(req, 'sc', sign(s), TTL_MS / 1000), setCookie(req, 'st', '', 0)] });
    } catch (err) { console.error('login:', err); page(res, 500, 'Login failed', 'Something went wrong on Discord. Try again.'); }
  }

  async function api(req, res, url, s) {
    const route = url.pathname, q = Object.fromEntries(url.searchParams);
    if (req.method === 'GET') {
      if (PRIVATE.has(route) && !(await memberOf(s))) return json(res, s ? 403 : 401, { error: s ? 'Drivers only.' : 'Log in with Discord.', private: true });
      if (route === '/api/me') {
        const role = await roleOf(s), acc = s && bot?.access ? await bot.access(s.id) : null;
        return json(res, 200, { user: s ? { id: s.id, name: s.name, avatar: s.avatar } : null, role, caps: acc?.caps || {}, teams: acc?.teams || [], member: await memberOf(s), cfg: publicCfg(), login: !!process.env.DISCORD_CLIENT_SECRET, driver: s && db.links[s.id] ? stats.driverCard(db.links[s.id]) : null });
      }
      if (route === '/api/home') {
        const a = stats.all(), next = convoys.list(s?.id).filter((c) => c.start > Date.now() - 1800_000).slice(0, 2);
        const mem = await memberOf(s);
        return json(res, 200, { tot: a.tot, drivers: stats.roster().length, next, partners: X.partners(), dotm: mem ? X.dotm() : undefined, recent: mem ? recent(8) : undefined, top: mem ? stats.board('month', 'km').slice(0, 3) : undefined, synced: db.sync.jobs?.at || db.sync.lastHook?.at || null });
      }
      if (route === '/api/drivers') return json(res, 200, { drivers: stats.roster() });
      if (route === '/api/driver') { const p = stats.profile(String(q.id || '')); return p ? json(res, 200, { ...p, convoys: X.attended(X.uidOf(p.id)), dotm: X.dotmCount(p.id) }) : json(res, 404, { error: 'Driver not found.' }); }
      if (route === '/api/jobs') {
        let list = stats.done();
        if (q.driver) list = list.filter((j) => j.driver === String(q.driver));
        if (q.game === 'ETS2' || q.game === 'ATS') list = list.filter((j) => j.game === q.game);
        if (q.period && q.period !== 'all') { const from = stats.startOf(q.period); list = list.filter((j) => j.end >= from); }
        if (q.q) { const t = String(q.q).toLowerCase().slice(0, 40); list = list.filter((j) => `${j.from} ${j.to} ${j.cargo} ${j.driverName}`.toLowerCase().includes(t)); }
        const page_ = Math.max(0, Math.min(1000, Number(q.page) || 0)), size = 40, out = list.slice().reverse();
        return json(res, 200, { jobs: out.slice(page_ * size, page_ * size + size), total: out.length, km: list.reduce((x, j) => x + j.km, 0), page: page_, pages: Math.ceil(out.length / size) });
      }
      if (route === '/api/board') return json(res, 200, { rows: stats.board(q.period, q.metric), from: stats.startOf(['week', 'month', 'all'].includes(q.period) ? q.period : 'month') });
      if (route === '/api/convoys') return json(res, 200, { convoys: convoys.list(s?.id), tmp: await convoys.tmpEvents() });
      if (route === '/api/partners') return json(res, 200, { partners: X.partners() });
      if (route.startsWith('/api/panel/')) {
        const acc = await access(s); if (!acc) return json(res, s ? 403 : 401, { error: 'This page is for the team.' });
        if (route === '/api/panel/attendance') { if (!acc.caps.events) return json(res, 403, { error: 'Event Team only.' }); return json(res, 200, { people: X.attendanceList(q.id) }); }
        if (!acc.caps.manage) return json(res, 403, { error: 'Staff only.' });
        if (route === '/api/panel/overview') {
          const waiting = db.applications.filter((a) => a.status === 'accepted' && !a.onboarded && Date.now() - a.decided < 60 * 86400_000).slice(-25);
          const onboarding = [];
          for (const a of waiting) { const p = await G.progress(a.discord); onboarding.push({ uid: a.discord, name: a.name, decided: a.decided, trucky: !!p.driver, tmp: p.tmp, web: p.web }); }
          return json(res, 200, { pending: db.applications.filter((a) => a.status === 'pending').length, onboarding, inactive: X.inactive().slice(0, 50),
            loa: Object.entries(db.loa || {}).filter(([, l]) => l.until > Date.now()).map(([uid, l]) => ({ uid, ...l })).sort((a, b) => a.until - b.until),
            drivers: Object.keys(db.links).length, upcoming: db.convoys.filter((c) => !c.draft && c.start > Date.now()).length, drafts: db.convoys.filter((c) => c.draft).length,
            scheduled: (db.scheduled || []).length, dotm: X.dotm(), lastMonth: (() => { const m = X.lastMonth(); return { label: m.label, top: m.rows.slice(0, 3) }; })(),
            sync: { jobs: db.sync.jobs?.at || null, members: db.sync.members?.at || null, hook: db.sync.lastHook?.at || null } });
        }
        if (route === '/api/panel/mod') return json(res, 200, { members: await bot.findMembers(q.q), canBan: !!acc.caps.ban });
        if (route === '/api/panel/bans') return json(res, 200, { bans: acc.caps.ban ? await bot.bans() : [], log: (db.modlog || []).slice(-60).reverse(), canBan: !!acc.caps.ban });
        if (route === '/api/panel/drivers') {
          const last = new Map(); for (const j of stats.done()) last.set(j.driver, j.end);
          const uids = Object.keys(db.links), where = await bot.inGuild(uids);
          const rows = uids.map((uid) => { const t = db.links[uid], c = stats.driverCard(t), m = db.members[t] || {};
            return { uid, driver: t, name: c?.name || m.name || t, avatar: c?.avatar || m.avatar || null, rank: c?.rank?.name || '', km: c?.km || 0, lastJob: last.get(t) || null, convoys: X.attended(uid), dotm: X.dotmCount(t), loa: X.onLeave(uid), left: !!m.left, discord: where[uid] }; });
          const linkedIds = new Set(Object.values(db.links));
          const unlinked = Object.values(db.members).filter((m) => !m.left && !linkedIds.has(m.id)).map((m) => ({ driver: m.id, name: m.name, avatar: m.avatar || null, km: stats.driverCard(m.id)?.km || 0 })).sort((a, b) => b.km - a.km);
          return json(res, 200, { rows: rows.sort((a, b) => b.km - a.km), unlinked });
        }
        return json(res, 404, { error: 'Not found.' });
      }
      if (route === '/api/panel') {
        const acc = await access(s); if (!acc) return json(res, s ? 403 : 401, { error: 'This page is for the team.' });
        const all = bot.channels(), mediaIds = new Set(bot.mediaChannels());
        return json(res, 200, { caps: acc.caps, teams: acc.teams, channels: acc.caps.post ? all : all.filter((c) => mediaIds.has(c.id)), pings: pingsFor(acc), memberRole: !!G.roleId('member'),
          posts: db.posts.slice(-60).reverse().filter((p) => acc.caps.post || p.by.id === s.id || mediaIds.has(p.ref.c)),
          convoys: acc.caps.events ? convoys.list(s.id, true) : [], slots: convoys.SLOTS,
          scheduled: (db.scheduled || []).filter((x) => acc.caps.post || x.by.id === s.id).map((x) => ({ id: x.id, at: x.at, by: x.by, title: x.p.title || String(x.p.text || '').slice(0, 60), channel: bot.channels().find((c) => c.id === x.p.channel)?.name || '?', image: x.p.image, ping: x.p.ping })),
          partners: acc.caps.post ? X.partners() : [] });
      }
      if (route === '/api/apply') return s ? json(res, 200, { app: apply.mine(s.id), open: cfg().recruitOpen }) : json(res, 401, { error: 'Log in with Discord.' });
      if (route === '/api/staff') {
        const role = await roleOf(s); if (!role) return json(res, 403, { error: 'Staff only.' });
        return json(res, 200, { role, apps: db.applications.slice().sort((a, b) => (a.status === 'pending' ? -1 : 0) - (b.status === 'pending' ? -1 : 0) || b.at - a.at).slice(0, 200),
          sync: { ...db.sync, token: !!process.env.TRUCKY_TOKEN, secret: !!process.env.TRUCKY_WEBHOOK_SECRET, webhook: `${baseUrl(req)}/trucky/webhook`, jobs: db.sync.jobs, stored: db.jobs.length },
          cfg: role === 'admin' ? cfg() : undefined, channels: role === 'admin' ? bot.channels() : undefined,
          links: Object.entries(db.links).map(([d, t]) => ({ discord: d, driver: t, name: db.members[t]?.name || t })) });
      }
      return json(res, 404, { error: 'Not found.' });
    }
    if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });
    const origin = req.headers.origin;
    if (origin && origin !== baseUrl(req)) return json(res, 403, { error: 'Origin not allowed.' });
    if (!String(req.headers['content-type'] || '').startsWith('application/json')) return json(res, 415, { error: 'Send JSON.' });
    if (!s) return json(res, 401, { error: 'Log in with Discord first.' });
    let b; try { b = JSON.parse((await raw(req, route === '/api/upload' ? 9_000_000 : 30_000)).toString() || '{}'); } catch { return json(res, 400, { error: 'Invalid request (a picture may be too big).' }); }
    let r;
    if (route === '/api/rsvp') { r = convoys.rsvp(b.id, s, b.status, b.slot); if (r.changed) { bot?.convoyRefresh?.(r.changed); delete r.changed; } }
    else if (route === '/api/apply') { b.steam = (await apply.resolveSteam(b.steam)) || b.steam; r = apply.submit(s, b); if (r.ok) { r.item.src = 'web'; save(); bot?.applied(r.item); } }
    else if (route === '/api/link') {
      const steam = await apply.resolveSteam(b.steam), m = steam && Object.values(db.members).find((x) => x.steam === steam && !x.left);
      if (!steam) r = { ok: false, msg: 'We could not find that Steam profile. Paste your profile link (steamcommunity.com/id/… or /profiles/…).' };
      else if (!m) r = { ok: false, msg: 'We cannot find that Steam account in the company on Trucky. If you just joined, wait a few minutes.' };
      else if (Object.entries(db.links).some(([d, t]) => t === m.id && d !== s.id)) r = { ok: false, msg: 'That driver is already linked to another Discord account. Talk to staff.' };
      else { db.links[s.id] = m.id; save(); r = { ok: true, msg: `Your account is linked to ${m.name}.` }; bot?.onboard?.(s.id).catch(() => {}); }
    }
    else if (route === '/api/unlink') { delete db.links[s.id]; save(); r = { ok: true, msg: 'Account unlinked.' }; }
    else if (PANEL.has(route)) { const acc = await access(s); if (!acc) return json(res, 403, { error: 'Only the team can do that.' }); r = await panel(route, b, s, acc); if (!r) return json(res, 403, { error: 'Your role cannot do that.' }); }
    else {
      const role = await roleOf(s); if (!role) return json(res, 403, { error: 'Only staff can do that.' });
      if (route === '/api/apply/decide') {
        r = apply.decide(b.id, s, !!b.accept, b.note);
        if (r.ok) { if (r.item.status === 'accepted' && b.trucky) { const t = await require('./trucky').addDriver(r.item.steam, r.item.name); r.msg += ` ${t.msg}`; } bot?.decided(r.item); }
      }
      else if (route === '/api/staff/unlink') { delete db.links[String(b.discord)]; save(); r = { ok: true, msg: 'Link removed.' }; }
      else if (route === '/api/sync') {
        try { const j = await trucky.pollJobs(5); const m = await trucky.pollMembers().catch(() => ({ ok: false })); r = j.ok ? { ok: true, msg: `Synced with Trucky: ${j.added} new jobs${m.ok ? `, ${m.count} members` : ''}.` } : { ok: false, msg: j.msg }; }
        catch (err) { r = { ok: false, msg: `Trucky is not answering: ${err.message}. Check the company ID and the token.` }; }
      }
      else if (role !== 'admin') return json(res, 403, { error: 'Admins only.' });
      else if (route === '/api/config') {
        const ids = new Set(bot.channels().map((c) => c.id)), p = {};
        for (const k of ['jobsChannel', 'convoyChannel', 'staffChannel']) if (k in b) p[k] = b[k] && ids.has(String(b[k])) ? String(b[k]) : null;
        for (const [k, n] of [['name', 40], ['tag', 8], ['tagline', 90], ['about', 1500]]) if (typeof b[k] === 'string' && b[k].trim()) p[k] = b[k].trim().slice(0, n);
        if ('discordInvite' in b) p.discordInvite = /^https:\/\/(discord\.gg|discord\.com\/invite)\/[\w-]+$/.test(String(b.discordInvite).trim()) ? String(b.discordInvite).trim() : '';
        if ('truckyUrl' in b) p.truckyUrl = /^https:\/\/[\w.-]*truckyapp\.com\/\S*$/.test(String(b.truckyUrl).trim()) ? String(b.truckyUrl).trim().slice(0, 200) : '';
        if (Array.isArray(b.discordRules)) p.discordRules = b.discordRules.map((x) => String(x).trim().slice(0, 300)).filter(Boolean).slice(0, 20);
        if (b.standards && typeof b.standards === 'object') {
          p.standards = {};
          for (const k of ['tag', 'truck', 'trailer']) {
            const x = b.standards[k] || {}, col = String(x.color || '').trim(), img = String(x.image || '').trim();
            p.standards[k] = { text: String(x.text || '').trim().slice(0, 3000), color: /^#?[0-9a-f]{6}$/i.test(col) ? `#${col.replace('#', '').toLowerCase()}` : '', image: /^https:\/\/\S+$/.test(img) ? img.slice(0, 400) : '' };
          }
        }
        if ('autoRemove' in b) p.autoRemove = !!b.autoRemove;
        if (Array.isArray(b.requirements)) p.requirements = b.requirements.map((x) => String(x).trim().slice(0, 120)).filter(Boolean).slice(0, 12);
        if ('truckyId' in b) p.truckyId = String(b.truckyId || '').replace(/\D/g, '').slice(0, 12);
        if ('tmpId' in b) p.tmpId = String(b.tmpId || '').match(/\d+/)?.[0] || '';
        if ('recruitOpen' in b) p.recruitOpen = !!b.recruitOpen;
        if ('minJobKm' in b) p.minJobKm = Math.max(0, Math.min(2000, Math.round(Number(b.minJobKm)) || 0));
        if (Array.isArray(b.ranks)) {
          const ranks = b.ranks.map((x) => ({ name: String(x.name || '').trim().slice(0, 30), km: Math.max(0, Math.round(Number(x.km)) || 0) })).filter((x) => x.name).slice(0, 12).sort((a, c) => a.km - c.km);
          if (ranks.length) { ranks[0].km = 0; p.ranks = ranks; }
        }
        Object.assign(db.config, p); save();
        bot?.refreshPanels?.();
        r = { ok: true, msg: 'Settings saved.', cfg: cfg() };
      }
      else if (route === '/api/test') r = (await bot.test(String(b.channel))) ? { ok: true, msg: 'Test message sent.' } : { ok: false, msg: 'Could not post in that channel.' };
      else return json(res, 404, { error: 'Not found.' });
    }
    return json(res, r.ok ? 200 : 422, r);
  }

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x');
      const stat = STATIC[url.pathname];
      if (req.method === 'GET' && stat) {
        let data = fs.readFileSync(path.join(ROOT, stat[0]));
        if (url.pathname === '/') data = data.toString().replaceAll('{{NAME}}', esc(cfg().name)).replaceAll('{{URL}}', esc(baseUrl(req)));
        return send(res, 200, data, { 'Content-Type': stat[1], 'Cache-Control': url.pathname.startsWith('/fonts/') ? 'public, max-age=31536000, immutable' : url.pathname.startsWith('/img/') ? 'public, max-age=86400' : 'no-cache' });
      }
      if (req.method === 'GET' && url.pathname === '/robots.txt') {
        return send(res, 200, `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /auth/\nSitemap: ${baseUrl(req)}/sitemap.xml\n`, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
      }
      if (req.method === 'GET' && url.pathname === '/sitemap.xml') {
        return send(res, 200, `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${esc(baseUrl(req))}/</loc><changefreq>weekly</changefreq></url></urlset>`, { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
      }
      if (req.method === 'GET' && url.pathname.startsWith('/u/')) {
        const f = media.file(url.pathname); if (!f) return page(res, 404, 'Picture not found', 'This picture was removed.');
        return send(res, 200, fs.readFileSync(f), { 'Content-Type': media.type(f), 'Cache-Control': 'public, max-age=31536000, immutable' });
      }
      if (url.pathname === '/trucky/webhook') {
        if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
        let body; try { body = await raw(req); } catch { return json(res, 413, { error: 'too big' }); }
        if (!trucky.verify(body, req.headers['x-signature-sha256'])) return json(res, 401, { error: 'bad signature' });
        let d; try { d = JSON.parse(body.toString()); } catch { return json(res, 400, { error: 'bad json' }); }
        const ev = trucky.webhook(d);
        return json(res, 200, { ok: true, event: ev });
      }
      if (url.pathname === '/auth/login') return login(req, res);
      if (url.pathname === '/auth/callback') return callback(req, res, url);
      if (url.pathname === '/auth/logout') return send(res, 302, '', { Location: '/', 'Set-Cookie': setCookie(req, 'sc', '', 0) });
      if (url.pathname.startsWith('/api/')) {
        if (limited(req)) return json(res, 429, { error: 'Too many requests. Wait a minute.' });
        if (!process.env.WEB_URL && isHttps(req) && db.config.siteUrl !== baseUrl(req)) { db.config.siteUrl = baseUrl(req); save(); }
        return await api(req, res, url, unsign(cookies(req).sc));
      }
      return page(res, 404, 'Page not found', 'This address does not lead anywhere.');
    } catch (err) { console.error('web:', err); if (!res.headersSent) json(res, 500, { error: 'Something went wrong. Try again.' }); }
  });
  server.listen(port, () => console.log(`Website listening on port ${port} (PORT env: ${process.env.PORT || 'not set'})`));
  return { setBot(b) { bot = b; }, server };
}
module.exports = { start, sign };
