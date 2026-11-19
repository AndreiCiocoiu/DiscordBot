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

const ROOT = path.join(__dirname, '..');
const TTL_MS = 7 * 86400_000;
const STATIC = {
  '/': ['web/index.html', 'text/html; charset=utf-8'], '/app.js': ['web/app.js', 'text/javascript; charset=utf-8'],
  '/style.css': ['web/style.css', 'text/css; charset=utf-8'],
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
  tmpUrl: c.tmpId ? `https://truckersmp.com/vtc/${c.tmpId}` : '', trucky: !!c.truckyId }; };
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
      send(res, 302, '', { Location: '/', 'Set-Cookie': [setCookie(req, 'sc', sign(s), TTL_MS / 1000), setCookie(req, 'st', '', 0)] });
    } catch (err) { console.error('login:', err); page(res, 500, 'Login failed', 'Something went wrong on Discord. Try again.'); }
  }

  async function api(req, res, url, s) {
    const route = url.pathname, q = Object.fromEntries(url.searchParams);
    if (req.method === 'GET') {
      if (PRIVATE.has(route) && !(await memberOf(s))) return json(res, s ? 403 : 401, { error: s ? 'Drivers only.' : 'Log in with Discord.', private: true });
      if (route === '/api/me') {
        const role = await roleOf(s);
        return json(res, 200, { user: s ? { id: s.id, name: s.name, avatar: s.avatar } : null, role, member: await memberOf(s), cfg: publicCfg(), login: !!process.env.DISCORD_CLIENT_SECRET, driver: s && db.links[s.id] ? stats.driverCard(db.links[s.id]) : null });
      }
      if (route === '/api/home') {
        const a = stats.all(), next = convoys.list(s?.id).filter((c) => c.start > Date.now() - 1800_000).slice(0, 2);
        const mem = await memberOf(s);
        return json(res, 200, { tot: a.tot, drivers: stats.roster().length, next, recent: mem ? recent(8) : undefined, top: mem ? stats.board('month', 'km').slice(0, 3) : undefined, synced: db.sync.jobs?.at || db.sync.lastHook?.at || null });
      }
      if (route === '/api/drivers') return json(res, 200, { drivers: stats.roster() });
      if (route === '/api/driver') { const p = stats.profile(String(q.id || '')); return p ? json(res, 200, p) : json(res, 404, { error: 'Driver not found.' }); }
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
    let b; try { b = JSON.parse((await raw(req, 30_000)).toString() || '{}'); } catch { return json(res, 400, { error: 'Invalid request.' }); }
    let r;
    if (route === '/api/rsvp') r = convoys.rsvp(b.id, s, b.status);
    else if (route === '/api/apply') { r = apply.submit(s, b); if (r.ok) bot?.applied(r.item); }
    else if (route === '/api/link') {
      const steam = apply.steamOf(b.steam), m = steam && Object.values(db.members).find((x) => x.steam === steam && !x.left);
      if (!steam) r = { ok: false, msg: 'Add your Steam profile link (with the SteamID64 that starts with 7656119).' };
      else if (!m) r = { ok: false, msg: 'We cannot find that Steam account in the company on Trucky. If you just joined, wait a few minutes.' };
      else if (Object.entries(db.links).some(([d, t]) => t === m.id && d !== s.id)) r = { ok: false, msg: 'That driver is already linked to another Discord account. Talk to staff.' };
      else { db.links[s.id] = m.id; save(); r = { ok: true, msg: `Your account is linked to ${m.name}.` }; }
    }
    else if (route === '/api/unlink') { delete db.links[s.id]; save(); r = { ok: true, msg: 'Account unlinked.' }; }
    else {
      const role = await roleOf(s); if (!role) return json(res, 403, { error: 'Only staff can do that.' });
      if (route === '/api/convoys') { r = convoys.add(s, b); if (r.ok && b.announce) bot?.convoyAdded(r.item); }
      else if (route === '/api/convoys/remove') r = convoys.remove(b.id);
      else if (route === '/api/apply/decide') {
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
        if (url.pathname === '/') data = data.toString().replaceAll('{{NAME}}', esc(cfg().name));
        return send(res, 200, data, { 'Content-Type': stat[1], 'Cache-Control': url.pathname.startsWith('/fonts/') ? 'public, max-age=31536000, immutable' : url.pathname.startsWith('/img/') ? 'public, max-age=86400' : 'no-cache' });
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
