// The portal website, served by the bot process itself (nothing else to host).
// Anyone can browse deals, free games and announcements. "Log in with Discord" (OAuth2, scope identify) is only
// needed for the wishlist; people with Manage Server on the bot's server can also post announcements and change settings.
//
// Railway: Settings -> Networking -> Generate Domain, add the variable DISCORD_CLIENT_SECRET (Developer Portal -> OAuth2)
// and the redirect  https://<your-domain>/auth/callback  in Developer Portal -> OAuth2 -> Redirects.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { db, save, cfg } = require('./store');
const deals = require('./deals');
const free = require('./free');
const news = require('./news');
const watch = require('./watch');
const { rates } = require('./rates');

const ROOT = path.join(__dirname, '..');
const NAME = String(process.env.SITE_NAME || 'DROPZONE').slice(0, 24);
const TTL_MS = 7 * 86400_000;
const STATIC = {
  '/': ['web/index.html', 'text/html; charset=utf-8'],
  '/app.js': ['web/app.js', 'text/javascript; charset=utf-8'],
  '/style.css': ['web/style.css', 'text/css; charset=utf-8'],
  '/favicon.svg': ['web/favicon.svg', 'image/svg+xml'],
};
for (const f of fs.readdirSync(path.join(ROOT, 'assets', 'fonts'))) if (/\.woff2$/.test(f)) STATIC[`/fonts/${f}`] = [`assets/fonts/${f}`, 'font/woff2'];
// game art comes from many store CDNs, so images are allowed from any https host; scripts, styles and fonts only from here
const CSP = "default-src 'self'; img-src 'self' https: data:; style-src 'self'; script-src 'self'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";

const SECRET = crypto.createHash('sha256').update(`portal-web:${process.env.SESSION_SECRET || process.env.DISCORD_TOKEN || 'dev'}`).digest();
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
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const send = (res, code, body, headers = {}) => { res.writeHead(code, { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'Content-Security-Policy': CSP, ...headers }); res.end(body); };
const json = (res, code, obj) => send(res, code, JSON.stringify(obj), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
const page = (res, code, title, text) => send(res, code, `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><link rel="stylesheet" href="/style.css"><body class="plain"><main class="notice"><h1>${esc(title)}</h1><p>${esc(text)}</p><p><a class="btn" href="/">Înapoi la portal</a></p></main>`, { 'Content-Type': 'text/html; charset=utf-8' });

// a small per-address limit, so one visitor cannot make the bot hammer the price sources
const hits = new Map();
function limited(req, max = 150) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const now = Date.now(), e = hits.get(ip) || { n: 0, t: now };
  if (now - e.t > 60_000) { e.n = 0; e.t = now; }
  e.n++; hits.set(ip, e);
  if (hits.size > 5000) hits.clear();
  return e.n > max;
}

const uniq = (items, n) => { const seen = new Set(); return items.filter((d) => !seen.has(d.gameId) && seen.add(d.gameId)).slice(0, n); };
async function home() {
  const [spot, hot, fresh, cheap, fr] = await Promise.allSettled([
    deals.list({ sort: 'rating', steam: 80 }), deals.list({ sort: 'savings', steam: 75 }),
    deals.list({ sort: 'recent' }), deals.list({ sort: 'reviews', max: 5, steam: 85 }), free.epic(),
  ]);
  const v = (r) => (r.status === 'fulfilled' ? r.value : null);
  const all = [v(spot), v(hot), v(fresh), v(cheap)].flatMap((r) => r?.items || []);
  return {
    spot: uniq((v(spot)?.items || []).filter((d) => d.appId && d.cut >= 50 && d.steamCount >= 500), 6),
    hot: uniq((v(hot)?.items || []).filter((d) => d.steamCount >= 300), 12),
    fresh: uniq((v(fresh)?.items || []).filter((d) => d.cut >= 40), 12),
    cheap: uniq((v(cheap)?.items || []).filter((d) => d.steamCount >= 300), 12),
    free: v(fr) ? { now: v(fr).now, soon: v(fr).soon } : { now: [], soon: [] },
    news: news.list().slice(0, 3),
    stats: { deals: (v(spot)?.pages || 0) * 60, top: all.reduce((m, d) => Math.max(m, d.cut), 0) },
    down: !v(spot) && !v(hot),
  };
}

// Starts listening right away (Railway wants an answer on $PORT quickly); the bot is attached later with setBot().
function start() {
  let bot = null;
  if (process.env.WEB_DISABLED === '1') return { setBot() {} };
  const port = Number(process.env.PORT) || 3000;
  const clientId = () => process.env.DISCORD_CLIENT_ID || bot?.client.application?.id || bot?.client.user?.id;
  const isAdmin = async (s) => !!(s && bot && await bot.isAdmin(s.id));

  async function login(req, res) {
    if (!process.env.DISCORD_CLIENT_SECRET) return page(res, 503, 'Login neconfigurat', 'Adminul trebuie să adauge variabila DISCORD_CLIENT_SECRET în Railway (Discord Developer Portal, OAuth2).');
    if (!clientId()) return page(res, 503, 'Botul pornește', 'Botul încă pornește. Încearcă din nou peste câteva secunde.');
    const state = crypto.randomBytes(16).toString('hex');
    const q = new URLSearchParams({ client_id: clientId(), response_type: 'code', scope: 'identify', redirect_uri: `${baseUrl(req)}/auth/callback`, state, prompt: 'none' });
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
      if (!tok.access_token) return page(res, 400, 'Login eșuat', 'Discord a refuzat codul. Verifică în Developer Portal că redirect-ul /auth/callback e adăugat și că DISCORD_CLIENT_SECRET e corect.');
      const me = await fetch('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${tok.access_token}` } }).then((r) => r.json());
      if (!me?.id) return page(res, 400, 'Login eșuat', 'Discord nu a trimis contul. Încearcă din nou.');
      const session = { id: me.id, name: String(me.global_name || me.username || 'Jucător').slice(0, 40), avatar: me.avatar ? `https://cdn.discordapp.com/avatars/${me.id}/${me.avatar}.png?size=64` : null, exp: Date.now() + TTL_MS };
      send(res, 302, '', { Location: '/', 'Set-Cookie': [setCookie(req, 'sc', sign(session), TTL_MS / 1000), setCookie(req, 'st', '', 0)] });
    } catch (err) {
      console.error('web login error:', err);
      page(res, 500, 'Login eșuat', 'Ceva nu a mers la Discord. Încearcă din nou.');
    }
  }

  async function body(req) {
    const chunks = []; let n = 0;
    for await (const c of req) { n += c.length; if (n > 20_000) throw new Error('too big'); chunks.push(c); }
    return JSON.parse(Buffer.concat(chunks).toString() || '{}');
  }

  async function api(req, res, url, session) {
    const route = url.pathname, q = Object.fromEntries(url.searchParams);
    if (req.method === 'GET') {
      if (route === '/api/me') {
        const [st, rt, admin] = await Promise.all([deals.stores().catch(() => ({})), rates(), isAdmin(session)]);
        return json(res, 200, { user: session ? { id: session.id, name: session.name, avatar: session.avatar } : null, admin, site: { name: NAME }, stores: st, rates: rt, tags: news.TAGS,
          watching: session ? watch.mine(session.id).map((e) => e.gameId) : [], config: admin ? cfg() : undefined, login: !!process.env.DISCORD_CLIENT_SECRET });
      }
      if (route === '/api/home') return json(res, 200, await home());
      if (route === '/api/deals') return json(res, 200, await deals.list(q));
      if (route === '/api/free') {
        const [e, z] = await Promise.allSettled([free.epic(), deals.list({ max: 0, sort: 'reviews' })]);
        return json(res, 200, { now: e.value?.now || [], soon: e.value?.soon || [], others: (z.value?.items || []).filter((d) => d.sale === 0).slice(0, 24), down: e.status !== 'fulfilled' });
      }
      if (route === '/api/game') { const g = await deals.game(q.id); return g ? json(res, 200, g) : json(res, 404, { error: 'Nu am găsit jocul.' }); }
      if (route === '/api/search') { if (limited(req, 40)) return json(res, 429, { error: 'Prea multe căutări. Așteaptă un minut.' }); return json(res, 200, { games: await deals.search(q.q) }); }
      if (route === '/api/news') return json(res, 200, { news: news.list() });
      if (route === '/api/watch') return session ? json(res, 200, { list: watch.mine(session.id), max: watch.MAX }) : json(res, 401, { error: 'Intră cu Discord ca să ai wishlist.' });
      if (route === '/api/channels') return (await isAdmin(session)) ? json(res, 200, { channels: bot.channels() }) : json(res, 403, { error: 'Doar adminii.' });
      return json(res, 404, { error: 'Nu există.' });
    }
    if (req.method !== 'POST') return json(res, 405, { error: 'Metodă nepermisă.' });
    const origin = req.headers.origin;
    if (origin && origin !== baseUrl(req)) return json(res, 403, { error: 'Origine nepermisă.' });
    if (!String(req.headers['content-type'] || '').startsWith('application/json')) return json(res, 415, { error: 'Trimite JSON.' });
    if (!session) return json(res, 401, { error: 'Intră cu Discord mai întâi.' });
    let b; try { b = await body(req); } catch { return json(res, 400, { error: 'Cerere invalidă.' }); }

    let r;
    if (route === '/api/watch') r = await watch.add(session.id, b);
    else if (route === '/api/watch/remove') r = watch.remove(session.id, b.gameId);
    else {
      if (!(await isAdmin(session))) return json(res, 403, { error: 'Doar adminii serverului pot face asta.' });
      if (route === '/api/news') {
        r = news.add(session, b);
        if (r.ok && b.discord) { const d = await bot.postNews(r.item); r.msg += ` ${d.msg}`; }
      }
      else if (route === '/api/news/remove') r = news.remove(b.id);
      else if (route === '/api/news/pin') r = news.pin(b.id, b.pinned);
      else if (route === '/api/digest') r = await bot.digest(true).catch(() => ({ ok: false, msg: 'Nu am putut trimite reducerile acum.' }));
      else if (route === '/api/config') {
        const ids = new Set(bot.channels().map((c) => c.id)), patch = {};
        for (const k of ['dealsChannel', 'newsChannel']) if (k in b) patch[k] = b[k] && ids.has(String(b[k])) ? String(b[k]) : null;
        if ('hour' in b) patch.hour = Math.min(23, Math.max(0, Math.round(Number(b.hour)) || 0));
        if ('minCut' in b) patch.minCut = Math.min(95, Math.max(0, Math.round(Number(b.minCut)) || 0));
        for (const k of ['digest', 'freeAlerts']) if (k in b) patch[k] = !!b[k];
        Object.assign(db.config, patch); save();
        r = { ok: true, msg: 'Setările au fost salvate.', config: cfg() };
      }
      else return json(res, 404, { error: 'Nu există.' });
    }
    return json(res, r.ok ? 200 : 422, r);
  }

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x');
      const stat = STATIC[url.pathname];
      if (req.method === 'GET' && stat) {
        let data = fs.readFileSync(path.join(ROOT, stat[0]));
        if (url.pathname === '/') data = data.toString().replaceAll('{{NAME}}', esc(NAME));
        return send(res, 200, data, { 'Content-Type': stat[1], 'Cache-Control': url.pathname.startsWith('/fonts/') ? 'public, max-age=31536000, immutable' : 'no-cache' });
      }
      if (url.pathname === '/auth/login') return login(req, res);
      if (url.pathname === '/auth/callback') return callback(req, res, url);
      if (url.pathname === '/auth/logout') return send(res, 302, '', { Location: '/', 'Set-Cookie': setCookie(req, 'sc', '', 0) });
      if (url.pathname.startsWith('/api/')) {
        if (limited(req)) return json(res, 429, { error: 'Prea multe cereri. Așteaptă un minut.' });
        // remember the public address once, so the bot can link to the site from Discord
        if (!process.env.WEB_URL && isHttps(req) && db.config.siteUrl !== baseUrl(req)) { db.config.siteUrl = baseUrl(req); save(); }
        return await api(req, res, url, unsign(cookies(req).sc));
      }
      return page(res, 404, 'Pagina nu există', 'Adresa asta nu duce nicăieri.');
    } catch (err) {
      console.error('web error:', err.message);
      if (!res.headersSent) json(res, 502, { error: 'Sursa de prețuri nu răspunde acum. Încearcă din nou peste un minut.' });
    }
  });
  server.listen(port, () => console.log(`Website listening on port ${port} (PORT env: ${process.env.PORT || 'not set'})`));
  return { setBot(b) { bot = b; }, server };
}

module.exports = { start, sign };
