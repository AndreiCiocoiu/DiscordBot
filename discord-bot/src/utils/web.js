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
const announce = require('./announce');
const idcard = require('./idcard');
const familyHub = require('./familyHub');
const siteAccess = require('./siteAccess');

const ROOT = path.join(__dirname, '..', '..');
const TTL_MS = 4 * 3600_000;
const STATIC = {
  '/': ['web/index.html', 'text/html; charset=utf-8'],
  '/app.js': ['web/app.js', 'text/javascript; charset=utf-8'],
  '/style.css': ['web/style.css', 'text/css; charset=utf-8'],
  '/hub.css': ['web/hub.css', 'text/css; charset=utf-8'],
  '/hub.js': ['web/hub.js', 'text/javascript; charset=utf-8'],
  '/security.js': ['web/security.js', 'text/javascript; charset=utf-8'],
  '/img/sahara.jpg': ['assets/sahara.jpg', 'image/jpeg'],
  '/img/hub-icons.png': ['assets/hub-icons.png', 'image/png'],
};
// every web font in assets/fonts is served at /fonts/<file>
for (const f of fs.readdirSync(path.join(ROOT, 'assets', 'fonts'))) {
  if (/\.woff2$/.test(f)) STATIC[`/fonts/${f}`] = [`assets/fonts/${f}`, 'font/woff2'];
  else if (/\.ttf$/.test(f) && f.startsWith('Rye')) STATIC[`/fonts/${f}`] = [`assets/fonts/${f}`, 'font/ttf'];
}
const CSP = "default-src 'self'; img-src 'self' https://cdn.discordapp.com data:; style-src 'self'; script-src 'self'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";

const SECRET = crypto.createHash('sha256').update(`sahara-website:${process.env.SESSION_SECRET || process.env.DISCORD_TOKEN || 'dev'}`).digest();
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
      const session = { id: me.id, name: mem.nick || me.global_name || me.username, avatar, exp: Date.now() + TTL_MS };
      const request = siteAccess.register(guild.id, session);
      if (request.created && !siteAccess.owner(guild, session.id)) {
        const master = process.env.WEB_OWNER_IDS?.split(/[\s,;]+/).filter(Boolean)[0] || process.env.WEB_OWNER_ID || guild.ownerId;
        if (master && master !== session.id && client) {
          client.users.fetch(master).then((u) => u.send({ content: `🔐 **Sahara Cartel — cerere nouă de acces**\n**${session.name}** (${session.id}) a intrat cu Discord. Verifică secțiunea Securitate din website pentru a aproba sau respinge accesul.`, allowedMentions: { parse: [] } })).catch(() => {});
        }
      }
      send(res, 302, '', { Location: '/', 'Set-Cookie': [setCookie(req, 'sc', sign(session), TTL_MS / 1000), setCookie(req, 'st', '', 0)] });
    } catch (err) {
      console.error('web login error:', err);
      page(res, 500, 'Login eșuat', 'Ceva nu a mers la Discord. Încearcă din nou.');
    }
  }

  // Never trust permissions in the signed cookie: read the persistent approval store
  // and check real Discord server membership on every authenticated API request.
  // A user blocked via the website is rejected on their very next request.
  async function verifiedSession(session, guild, d) {
    const member = await guild.members.fetch({ user: session.id, force: true }).catch(() => null);
    if (!member) return null;
    const roles = await points.rolesInfo(guild, d, session.id, [...member.roles.cache.keys()]);
    return { ...session, ...roles, guildMember: true };
  }

  const limiter = new Map();
  function limited(req, action, ceiling, interval = 60000) {
    const ip = String(req.socket.remoteAddress || 'unknown');
    const key = `${ip}/${action}`;
    const now = Date.now();
    const prior = limiter.get(key);
    if (!prior || now - prior.start > interval) { limiter.set(key, { start: now, count: 1 }); return false; }
    if (prior.count++ >= ceiling) return true;
    if (limiter.size > 1000) for (const [k,v] of limiter) if (now - v.start > interval) limiter.delete(k);
    return false;
  }

  // Outbox is persisted with the website notifications; DM failures do not undo website writes.
  let dmInterval = null;
  async function sendDms() {
    if (!client?.isReady?.()) return;
    const guild = pickGuild();
    if (!guild) return;
    const d = points.G(guild.id);
    await familyHub.drainDm(guild.id, async (id, n) => {
      const target = ['war','contracts','dossiers','treasury','orders','events','polls','feed','notices'].includes(n.target) ? n.target : 'notices';
      const link = process.env.WEB_URL ? `\n${process.env.WEB_URL.replace(/\/$/,'')}/#/cartier/${target}` : '';
      const user = await client.users.fetch(id);
      await user.send({ content: `**SAHARA CARTEL — ${n.title}**\n${n.text}${link}`.slice(0, 1900), allowedMentions: { parse: [] } });
    }, async (id, job) => {
      const rec = siteAccess.record(guild.id, id);
      if (!rec || rec.dm === false) return false;
      const member = await guild.members.fetch({ user: id, force: true }).catch(() => null);
      if (!member) return false;
      // A refusal/revocation is a simple personal account-status message, never private Hub data.
      if (job.accessNotice) return true;
      if (!d.members[id] || !siteAccess.approved(guild, id, !!d.members[id])) return false;
      const key = `hub.${job.target}.view`;
      return siteAccess.can(guild, id, 'hub.notices.view', true) && (siteAccess.ALL.includes(key) ? siteAccess.can(guild, id, key, true) : true);
    }, 8);
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
    session = await verifiedSession(session, guild, d);
    if (!session) return json(res, 403, { code: 'not_in_server', error: 'Contul nu mai este membru al serverului Discord.' });
    const inFamily = !!d.members[session.id];
    const access = siteAccess.state(guild, session.id, inFamily);
    const allowed = (permission) => access.permissions[permission] === true;
    const check = (permission) => allowed(permission) ? null : json(res, 403, { code: 'no_permission', error: 'Nu ai permisiune pentru această funcție.' });

    if (req.method === 'GET' && route === '/api/access/me') return json(res, 200, access);
    if (route === '/api/access' && req.method === 'GET') {
      if (!access.owner) return json(res, 403, { error: 'Doar proprietarul poate administra accesul.' });
      const list = siteAccess.list(guild);
      return json(res, 200, { ...list, users: list.users.map((u) => ({ ...u, inFamily: !!d.members[u.id] })) });
    }
    if (!siteAccess.approved(guild, session.id, inFamily)) return json(res, 403, {
      code: access.status === 'denied' ? 'access_denied' : !access.inFamily ? 'not_in_family' : 'access_pending',
      error: access.status === 'denied' ? 'Accesul a fost refuzat sau retras.' : !access.inFamily ? 'Nu ești înregistrat în Familia Sahara.' : 'Cererea ta așteaptă aprobarea proprietarului.',
    });

    if (req.method === 'GET') {
      if (route === '/api/state') {
        await points.refreshProfiles(client, d);
        points.flush();
        const snap = points.snapshot(d, session.id);
        if (!(allowed('board.view') || allowed('roster.view') || allowed('hub.dossiers.view') || allowed('members.manage') || allowed('points.manage'))) snap.members = [];
        if (!(allowed('board.view') || allowed('points.manage'))) { snap.archive = []; snap.entries = []; }
        return json(res, 200, { ...snap, guild: { name: guild.name }, me: {
          id: session.id, name: session.name, avatar: session.avatar,
          leader: ['points.manage','members.manage','announcements.manage','config.manage'].some(allowed),
          admin: allowed('announcements.manage') || allowed('config.manage'),
          permissions: access.permissions, owner: access.owner, dm: access.dm,
        } });
      }
      if (route === '/api/week') {
        if (!allowed('board.view')) return check('board.view');
        const v = points.weekView(d, url.searchParams.get('no'));
        return v ? json(res, 200, v) : json(res, 404, { error: 'Săptămâna nu e în arhivă.' });
      }
      if (route === '/api/craft') return allowed('craft.use') ? json(res, 200, craft.catalogJson()) : check('craft.use');
      if (route === '/api/hub') {
        const result = familyHub.handle({ guildId: guild.id, session, permissions: access.permissions, members: d.members, request: null });
        return json(res, result.status, result.body);
      }
      if (route === '/api/members') return allowed('members.manage') ? json(res, 200, await memberSearch(guild, url.searchParams.get('q'))) : check('members.manage');
      if (route === '/api/idcard') {
        if (!allowed('idcard.manage')) return check('idcard.manage');
        const uid = String(url.searchParams.get('u') || ''), m = d.members[uid];
        const f = m?.idCard ? idcard.read(guild.id, uid, m.idCard.ext) : null;
        return f ? send(res, 200, f.data, { 'Content-Type': f.type, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }) : json(res, 404, { error: 'Nu are carte de identitate.' });
      }
      if (route === '/api/channels') return allowed('announcements.manage') ? json(res, 200, { channels: announce.channels(guild) }) : check('announcements.manage');
      return json(res, 404, { error: 'Nu există.' });
    }

    if (req.method !== 'POST') return json(res, 405, { error: 'Metodă nepermisă.' });
    const origin = req.headers.origin;
    let trustedOrigin = false;
    try { if (origin) trustedOrigin = new URL(origin).origin === new URL(baseUrl(req)).origin; }
    catch { trustedOrigin = false; }
    // Browsers send Origin for same-origin POST; reject missing origin to prevent CSRF.
    if (!trustedOrigin) return json(res, 403, { error: 'Origine nepermisă (protecție CSRF).' });
    if (limited(req, 'write', 90)) return json(res, 429, { error: 'Prea multe cereri. Încearcă puțin mai târziu.' });
    // the identity card arrives as the raw image, not JSON
    if (route === '/api/idcard') {
      if (!allowed('idcard.manage')) return check('idcard.manage');
      const uid = String(url.searchParams.get('u') || ''), m = d.members[uid];
      if (!m) return json(res, 422, { ok: false, msg: 'Persoana nu e în bandă.' });
      const chunks = []; let n = 0;
      try { for await (const c of req) { n += c.length; if (n > idcard.MAX) throw new Error('too big'); chunks.push(c); } }
      catch { return json(res, 413, { ok: false, msg: 'Poza e prea mare (maximum 4 MB).' }); }
      let r;
      try { r = idcard.save(guild.id, uid, Buffer.concat(chunks)); } catch (err) { console.error('idcard save:', err); return json(res, 500, { ok: false, msg: 'Nu am putut salva poza.' }); }
      if (!r.ok) return json(res, 422, r);
      m.idCard = { ext: r.ext, at: Date.now(), by: session.id, byName: session.name };
      points.touch(); points.flush();
      return json(res, 200, { ok: true, msg: `Cartea de identitate a fost salvată pentru ${m.name || uid}.` });
    }
    if (!String(req.headers['content-type'] || '').startsWith('application/json')) return json(res, 415, { error: 'JSON necesar.' });
    let b;
    try { b = await body(req); } catch { return json(res, 400, { error: 'Cerere invalidă.' }); }

    if (route === '/api/craft') return allowed('craft.use') ? json(res, 200, craft.calcJson(b.items)) : check('craft.use');
    if (route === '/api/access/dm') {
      if (typeof b.enabled !== 'boolean') return json(res, 422, { error: 'Alege activate / dezactivate.' });
      siteAccess.setDm(guild.id, session.id, b.enabled);
      return json(res, 200, { ok: true, dm: b.enabled });
    }
    if (route === '/api/access') {
      if (!access.owner) return json(res, 403, { error: 'Doar proprietarul poate administra accesul.' });
      try {
        const userId = String(b.userId);
        const before = siteAccess.record(guild.id, userId)?.status;
        siteAccess.update(guild, session.id, userId, b.status, b.permissions);
        if (before !== b.status && (b.status === 'approved' || b.status === 'denied')) {
          familyHub.notifyAccess(guild.id, userId, b.status === 'approved');
          sendDms().catch((error) => console.warn('Access DM:', error.message));
        }
        return json(res, 200, { ok: true, ...siteAccess.list(guild) });
      } catch (e) { return json(res, 422, { error: e.message }); }
    }
    if (route === '/api/hub') {
      const catalog = craft.catalogJson();
      const result = familyHub.handle({ guildId: guild.id, session, permissions: access.permissions, members: d.members, request: b, craftNames: catalog.weapons.map((w) => w.name) });
      if (result.status === 200) sendDms().catch((err) => console.error('Hub DM delivery:', err));
      return json(res, result.status, result.body);
    }

    const permsForRoutes = {
      '/api/add': 'members.manage', '/api/remove': 'members.manage', '/api/rank': 'members.manage', '/api/leave': 'members.manage',
      '/api/give': 'points.manage', '/api/undo': 'points.manage', '/api/config': 'config.manage',
      '/api/announce': 'announcements.manage', '/api/idcard/remove': 'idcard.manage',
    };
    if (!permsForRoutes[route]) return json(res, 404, { error: 'Nu există.' });
    if (!allowed(permsForRoutes[route])) return check(permsForRoutes[route]);
    const ctx = { client, guild, actorId: session.id, admin: allowed('config.manage'), plain: true };
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
      else if (route === '/api/idcard/remove') {
        const m = d.members[String(b.userId)];
        if (!m?.idCard) r = { ok: false, msg: 'Nu are carte de identitate.' };
        else { idcard.drop(guild.id, String(b.userId)); delete m.idCard; points.touch(); r = { ok: true, msg: 'Cartea de identitate a fost ștearsă.' }; }
      }
      else if (route === '/api/announce') r = await announce.post(client, guild, { channelId: b.channelId, title: b.title, text: b.text, ping: !!b.ping, author: session.name, actorId: session.id });
      else return json(res, 404, { error: 'Nu există.' });
    } catch (err) { console.error('web api error:', err); return json(res, 500, { error: 'Ceva nu a mers.' }); }
    points.flush();
    return json(res, r.ok ? 200 : 422, r);
  }

  // ---- server ----
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x');
      if (url.pathname === '/auth/login') return limited(req, 'login', 12) ? page(res, 429, 'Prea multe încercări', 'Încearcă mai târziu.') : login(req, res);
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
  dmInterval = setInterval(() => sendDms().catch((e) => console.warn('DM queue:', e.message)), 18000);
  dmInterval.unref?.();
  return { setClient(c) { client = c; } };
}

module.exports = { start, sign, unsign };
