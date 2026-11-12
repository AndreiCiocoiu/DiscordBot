// Website for the gang (served by the bot itself, so there is nothing else to host):
// leaderboard, roster + profiles, crafting catalog/calculator, and a panel for leaders.
// Login = "Log in with Discord" (OAuth2, scopes identify + guilds.members.read), the session is a signed cookie.
//
// Railway: Settings -> Networking -> Generate Domain, then add the variable DISCORD_CLIENT_SECRET (Developer Portal ->
// OAuth2) and the redirect  https://<your-domain>/auth/callback  in Developer Portal -> OAuth2 -> Redirects.
// Optional variables: WEB_URL (public address, if auto-detection is wrong), WEB_GUILD_ID (if the bot is on several
// servers), SESSION_SECRET (otherwise derived from the bot token), WEB_DISABLED=1.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Routes } = require('discord.js');
const points = require('./points');
const craft = require('./craft');

const ROOT = path.join(__dirname, '..', '..');
const TTL_MS = 4 * 3600_000;
const STATIC = {
  '/': ['web/index.html', 'text/html; charset=utf-8'],
  '/app.js': ['web/app.js', 'text/javascript; charset=utf-8'],
  '/style.css': ['web/style.css', 'text/css; charset=utf-8'],
  '/img/sahara.jpg': ['assets/sahara.jpg', 'image/jpeg'],
  '/fonts/Rye-Regular.ttf': ['assets/fonts/Rye-Regular.ttf', 'font/ttf'],
};
const CSP = "default-src 'self'; img-src 'self' https://cdn.discordapp.com data:; style-src 'self'; script-src 'self'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";

const SECRET = crypto.createHash('sha256').update(`muie-web:${process.env.SESSION_SECRET || process.env.DISCORD_TOKEN || 'dev'}`).digest();
const b64 = (b) => Buffer.from(b).toString('base64url');
const mac = (s) => crypto.createHmac('sha256', SECRET).update(s).digest('base64url');
function sign(obj) { const p = b64(JSON.stringify(obj)); return `${p}.${mac(p)}`; }
function unsign(tok) {
  const [p, m] = String(tok || '').split('.');
  if (!p || !m) return null;
  const good = Buffer.from(mac(p)), got = Buffer.from(m);
  if (good.length !== got.length || !crypto.timingSafeEqual(good, got)) return null;
  try { const o = JSON.parse(Buffer.from(p, 'base64url').toString()); return o.exp > Date.now() ? o : null; } catch { return null; }
}
const cookies = (req) => Object.fromEntries(String(req.headers.cookie || '').split(';').map((c) => c.trim().split(/=(.*)/s).slice(0, 2)).filter(([k]) => k));
const isHttps = (req) => (process.env.WEB_URL || '').startsWith('https') || String(req.headers['x-forwarded-proto'] || '').split(',')[0] === 'https';
const setCookie = (req, name, val, maxAge) => `${name}=${val}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${isHttps(req) ? '; Secure' : ''}`;
const baseUrl = (req) => (process.env.WEB_URL || `${String(req.headers['x-forwarded-proto'] || 'http').split(',')[0]}://${req.headers.host}`).replace(/\/$/, '');

const send = (res, code, body, headers = {}) => { res.writeHead(code, { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'Content-Security-Policy': CSP, ...headers }); res.end(body); };
const json = (res, code, obj) => send(res, code, JSON.stringify(obj), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
const page = (res, code, title, text) => send(res, code, `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><link rel="stylesheet" href="/style.css"><body class="plain"><main class="notice"><h1>${title}</h1><p>${text}</p><p><a class="btn" href="/">Înapoi</a></p></main>`, { 'Content-Type': 'text/html; charset=utf-8' });

// Starts listening right away (Railway wants an answer on $PORT quickly); the bot client is attached later with setClient().
function start(initial) {
  let client = initial;
  if (process.env.WEB_DISABLED === '1') return { setClient() {} };
  const port = Number(process.env.PORT) || 3000;
  const pickGuild = () => !client ? undefined : (process.env.WEB_GUILD_ID ? client.guilds.cache.get(process.env.WEB_GUILD_ID)
    : [...client.guilds.cache.values()].find((g) => points._db.guilds[g.id]) || client.guilds.cache.first());
  const clientId = () => process.env.DISCORD_CLIENT_ID || client?.application?.id || client?.user?.id;

  // ---- login ----
  async function login(req, res) {
    if (!process.env.DISCORD_CLIENT_SECRET) return page(res, 503, 'Login neconfigurat', 'Adminul trebuie să adauge variabila <b>DISCORD_CLIENT_SECRET</b> în Railway (Discord Developer Portal, OAuth2).');
    const state = crypto.randomBytes(16).toString('hex');
    const q = new URLSearchParams({ client_id: clientId(), response_type: 'code', scope: 'identify guilds.members.read', redirect_uri: `${baseUrl(req)}/auth/callback`, state, prompt: 'none' });
    send(res, 302, '', { Location: `https://discord.com/oauth2/authorize?${q}`, 'Set-Cookie': setCookie(req, 'st', state, 600) });
  }

  async function callback(req, res, url) {
    const state = url.searchParams.get('state'), code = url.searchParams.get('code');
    if (!code || !state || cookies(req).st !== state) return page(res, 400, 'Login eșuat', 'Sesiunea de login a expirat. Încearcă din nou.');
    try {
      const tok = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: clientId(), client_secret: process.env.DISCORD_CLIENT_SECRET, grant_type: 'authorization_code', code, redirect_uri: `${baseUrl(req)}/auth/callback` }),
      }).then((r) => r.json());
      if (!tok.access_token) return page(res, 400, 'Login eșuat', 'Discord a refuzat codul. Verifică în Developer Portal că redirect-ul <b>/auth/callback</b> e adăugat și că DISCORD_CLIENT_SECRET e corect.');
      const auth = { Authorization: `Bearer ${tok.access_token}` };
      const guild = pickGuild();
      if (!guild) return page(res, 503, 'Botul nu e pe server', 'Botul nu e încă pe niciun server.');
      const [me, mem] = await Promise.all([
        fetch('https://discord.com/api/users/@me', { headers: auth }).then((r) => r.json()),
        fetch(`https://discord.com/api/users/@me/guilds/${guild.id}/member`, { headers: auth }).then((r) => (r.ok ? r.json() : null)),
      ]);
      if (!me?.id || !mem) return page(res, 403, 'Acces interzis', `Contul tău Discord nu e pe serverul ${guild.name}.`);
      const d = points.G(guild.id);
      const { admin, leader } = await points.rolesInfo(guild, d, me.id, mem.roles || []);
      const avatar = me.avatar ? `https://cdn.discordapp.com/avatars/${me.id}/${me.avatar}.png?size=64` : null;
      const session = { id: me.id, name: mem.nick || me.global_name || me.username, avatar, roles: mem.roles || [], leader, admin, exp: Date.now() + TTL_MS };
      send(res, 302, '', { Location: '/', 'Set-Cookie': [setCookie(req, 'sc', sign(session), TTL_MS / 1000), setCookie(req, 'st', '', 0)] });
    } catch (err) {
      console.error('web login error:', err);
      page(res, 500, 'Login eșuat', 'Ceva nu a mers la Discord. Încearcă din nou.');
    }
  }

  // roles can change while a session lives: when the bot can see the member, trust the live roles
  async function liveAuth(session, guild, d) {
    const gm = guild.members.cache.get(session.id);
    if (!gm) return session;
    const info = await points.rolesInfo(guild, d, session.id, [...gm.roles.cache.keys()]);
    return { ...session, ...info };
  }

  // ---- API ----
  async function body(req) {
    const chunks = []; let n = 0;
    for await (const c of req) { n += c.length; if (n > 50_000) throw new Error('too big'); chunks.push(c); }
    return chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
  }

  async function memberSearch(guild, q) {
    q = String(q || '').trim().slice(0, 32);
    if (q.length < 2) return { members: [] };
    try {
      const list = await client.rest.get(Routes.guildMembersSearch(guild.id), { query: new URLSearchParams({ query: q, limit: '10' }) });
      return { members: list.filter((m) => !m.user.bot).map((m) => ({ id: m.user.id, name: m.nick || m.user.global_name || m.user.username, avatar: m.user.avatar ? `https://cdn.discordapp.com/avatars/${m.user.id}/${m.user.avatar}.png?size=64` : null })) };
    } catch { return { members: [], note: 'Căutarea nu merge (Server Members Intent oprit). Lipește ID-ul Discord al persoanei.' }; }
  }

  async function api(req, res, url, session) {
    const guild = pickGuild();
    if (!guild) return json(res, 503, { error: client ? 'Botul nu e pe server.' : 'Botul pornește, încearcă din nou în câteva secunde.' });
    const d = points.G(guild.id);
    const route = url.pathname;
    session = await liveAuth(session, guild, d);

    if (req.method === 'GET') {
      if (route === '/api/state') {
        await points.refreshProfiles(client, d);
        points.flush();
        return json(res, 200, { ...points.snapshot(d, session.id), guild: { name: guild.name }, me: { id: session.id, name: session.name, avatar: session.avatar, leader: session.leader, admin: session.admin } });
      }
      if (route === '/api/week') {
        const v = points.weekView(d, url.searchParams.get('no'));
        return v ? json(res, 200, v) : json(res, 404, { error: 'Săptămâna nu e în arhivă.' });
      }
      if (route === '/api/craft') return json(res, 200, craft.catalogJson());
      if (route === '/api/members') return session.leader ? json(res, 200, await memberSearch(guild, url.searchParams.get('q'))) : json(res, 403, { error: 'Doar lideri.' });
      return json(res, 404, { error: 'Nu există.' });
    }

    if (req.method !== 'POST') return json(res, 405, { error: 'Metodă nepermisă.' });
    const origin = req.headers.origin;
    if (origin && new URL(origin).host !== req.headers.host) return json(res, 403, { error: 'Origine nepermisă.' });
    if (!String(req.headers['content-type'] || '').startsWith('application/json')) return json(res, 415, { error: 'JSON necesar.' });
    let b;
    try { b = await body(req); } catch { return json(res, 400, { error: 'Cerere invalidă.' }); }

    if (route === '/api/craft') return json(res, 200, craft.calcJson(b.items));

    const needAdmin = route === '/api/config';
    if (!session.leader || (needAdmin && !session.admin)) return json(res, 403, { error: needAdmin ? 'Doar adminii.' : 'Doar Liderul, Co-Liderul sau adminii.' });
    const ctx = { client, guild, actorId: session.id, admin: session.admin, plain: true };
    let r;
    try {
      if (route === '/api/add') {
        const u = points.isId(b.userId) ? await client.users.fetch(b.userId).catch(() => null) : null;
        r = !u ? { ok: false, msg: 'Nu găsesc utilizatorul. Verifică ID-ul Discord.' } : u.bot ? { ok: false, msg: 'Nu poți adăuga un bot.' } : await points.actAdd(ctx, d, { rank: b.rank, userId: u.id, info: points.userInfo(u) });
      } else if (route === '/api/give') r = await points.actGive(ctx, d, { type: b.type, qty: b.qty ?? 1, note: b.note, userIds: Array.isArray(b.userIds) ? b.userIds.map(String) : [] });
      else if (route === '/api/undo') r = await points.actUndo(ctx, d, b.id);
      else if (route === '/api/rank') r = await points.actRank(ctx, d, { userId: String(b.userId), rank: b.rank, force: !!b.force });
      else if (route === '/api/remove') r = await points.actRemove(ctx, d, String(b.userId));
      else if (route === '/api/leave') r = await points.actLeave(ctx, d, { userId: String(b.userId), zile: b.zile });
      else if (route === '/api/config') r = points.actConfig(ctx, d, b);
      else return json(res, 404, { error: 'Nu există.' });
    } catch (err) { console.error('web api error:', err); return json(res, 500, { error: 'Ceva nu a mers.' }); }
    points.flush();
    return json(res, r.ok ? 200 : 422, r);
  }

  // ---- server ----
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x');
      if (url.pathname === '/auth/login') return login(req, res);
      if (url.pathname === '/auth/callback') return callback(req, res, url);
      if (url.pathname === '/auth/logout') return send(res, 302, '', { Location: '/', 'Set-Cookie': setCookie(req, 'sc', '', 0) });
      if (url.pathname.startsWith('/api/')) {
        const session = unsign(cookies(req).sc);
        if (!session) return json(res, 401, { error: 'Nu ești logat.' });
        return await api(req, res, url, session);
      }
      const s = req.method === 'GET' || req.method === 'HEAD' ? STATIC[url.pathname] : null;
      if (!s) return page(res, 404, 'Nu există', 'Pagina nu a fost găsită.');
      const file = path.join(ROOT, s[0]);
      fs.readFile(file, (err, data) => (err ? page(res, 404, 'Nu există', 'Fișierul lipsește.') : send(res, 200, data, { 'Content-Type': s[1], 'Cache-Control': url.pathname === '/' ? 'no-cache' : 'public, max-age=300' })));
    } catch (err) { console.error('web error:', err); if (!res.headersSent) json(res, 500, { error: 'Eroare.' }); }
  });
  server.on('error', (err) => console.error('web server error:', err.message));
  server.listen(port, () => console.log(`Website listening on port ${port} (PORT env: ${process.env.PORT || 'not set'})`));
  return { setClient(c) { client = c; } };
}

module.exports = { start, sign, unsign };
