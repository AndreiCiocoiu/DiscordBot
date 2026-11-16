'use strict';
// The portal's front end. No framework: small helpers build the DOM (never innerHTML), pages are functions.

const $ = (s, r = document) => r.querySelector(s);
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

function build(el, attrs, kids) {
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.setAttribute('class', v);
    else if (k === 'text') el.textContent = v;
    else if (k === 'style') for (const [p, val] of Object.entries(v)) (p.startsWith('--') ? el.style.setProperty(p, val) : (el.style[p] = val));
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of kids.flat(Infinity)) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}
const h = (tag, attrs, ...kids) => build(document.createElement(tag), attrs, kids);
const svg = (tag, attrs, ...kids) => build(document.createElementNS('http://www.w3.org/2000/svg', tag), attrs, kids);

const ICONS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  tag: 'M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9zM7.5 7.5h.01',
  gift: 'M4 11h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM3 7h18v4H3zM12 7v14M12 7c-1.5-4-6-4-6-1.5S9 7 12 7zm0 0c1.5-4 6-4 6-1.5S15 7 12 7z',
  horn: 'M4 10v4h3l7 5V5L7 10zM18 9a4 4 0 0 1 0 6',
  heart: 'M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z',
  search: 'M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14zM20 20l-4-4',
  out: 'M8 16 16 8M9 8h7v7',
  x: 'M6 6l12 12M18 6 6 18',
  pin: 'M9 4h6l-1 6 4 4H6l4-4zM12 14v6',
  trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13',
  clock: 'M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18zM12 7v5l3 2',
  gear: 'M12 15a3 3 0 1 1 0-6 3 3 0 0 1 0 6zM19 12l2-1.500-2-3.500-2.300.900-1.700-1L14.500 4h-5L9 6.900 7.300 7.900 5 7 3 10.500 5 12l-2 1.500L5 17l2.300-.900 1.700 1 .500 2.900h5l.500-2.900 1.700-1 2.300.900 2-3.500z',
  exit: 'M10 4H5v16h5M14 8l4 4-4 4M18 12H9',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0',
  steam: 'M4 5h16v14H4zM9 5v14',
  users: 'M16 20v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M8.5 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM20 20v-2a4 4 0 0 0-3-3.9M17 2.2a4 4 0 0 1 0 7.6',
};
const icon = (name, size = 20) => svg('svg', { class: 'ico', viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': 'true' }, svg('path', { d: ICONS[name].replace(/(\d)\.(\d)00/g, '$1.$2') }));

// ---- state ----
const S = { user: null, admin: false, login: false, stores: {}, rates: {}, tags: {}, config: null, cur: 'USD', watching: new Set(), home: null, homeAt: 0, sheet: false,
  f: { sort: 'rating', max: '', cut: '', q: '', store: [], good: false, aaa: false } };
try { S.cur = localStorage.getItem('cur') || 'USD'; } catch { /* storage blocked */ }
let cleanups = [];

async function api(path, body) {
  const res = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  let data = {}; try { data = await res.json(); } catch { /* not JSON */ }
  return { ok: res.ok, status: res.status, data };
}
let toastTimer;
function toast(msg, bad) {
  const t = $('#toast'); t.textContent = msg; t.className = `toast${bad ? ' bad' : ''}`; t.hidden = false;
  t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, bad ? 5200 : 3600);
}

// prices come in USD; other currencies are approximate, from daily reference rates
const nf = (v, d = 2) => v.toLocaleString('ro-RO', { minimumFractionDigits: d, maximumFractionDigits: d });
function money(n) {
  if (!(n > 0)) return 'Gratis';
  const r = S.rates[S.cur];
  if (S.cur === 'USD' || !r) return `$${n.toFixed(2)}`;
  const v = n * r;
  return S.cur === 'EUR' ? `≈ ${nf(v)} €` : S.cur === 'GBP' ? `≈ £${v.toFixed(2)}` : `≈ ${nf(v, v >= 100 ? 0 : 2)} lei`;
}
const dateStr = (ms) => new Date(ms).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' });
const monthStr = (ms) => new Date(ms).toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' });
function ago(ms) {
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 1) return 'acum'; if (m < 60) return `acum ${m} min`; if (m < 1440) return `acum ${Math.round(m / 60)} h`;
  const d = Math.round(m / 1440); return d < 30 ? `acum ${d} ${d === 1 ? 'zi' : 'zile'}` : dateStr(ms);
}
function left(ms) {
  let s = Math.max(0, Math.floor((ms - Date.now()) / 1000));
  const d = Math.floor(s / 86400); s -= d * 86400;
  const p = (n) => String(n).padStart(2, '0');
  return `${d ? `${d}z ` : ''}${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}
const hue = (t) => [...String(t || '')].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);

// ---- game art, with fallbacks: bigger Steam art when it exists, then the store's own thumbnail, then a tinted initial ----
function artList(d, big) {
  const out = [], t = d.thumb || d.image || '';
  if (/capsule_sm_120/.test(t)) { if (big) out.push(t.replace('capsule_sm_120', 'capsule_616x353')); out.push(t.replace('capsule_sm_120', 'header')); }
  if (d.appId) { const b = `https://cdn.cloudflare.steamstatic.com/steam/apps/${d.appId}`; if (big) out.push(`${b}/capsule_616x353.jpg`); out.push(`${b}/header.jpg`); }
  if (t) out.push(t);
  return [...new Set(out)];
}
function cover(d, big, onready) {
  const list = artList(d, big);
  const ph = () => h('span', { class: 'ph', style: { '--h': hue(d.title) }, text: (String(d.title || '?').trim()[0] || '?').toUpperCase() });
  if (!list.length) return ph();
  let i = 0;
  const img = h('img', { src: list[0], alt: '', loading: big ? 'eager' : 'lazy', decoding: 'async', referrerpolicy: 'no-referrer' });
  img.addEventListener('error', () => { i++; if (i < list.length) img.src = list[i]; else img.replaceWith(ph()); });
  if (onready) img.addEventListener('load', () => onready(img.currentSrc || img.src));
  return img;
}
let amb = 0;
function ambient(url) {
  if (!url) return;
  const els = $('#ambient').children, next = els[amb ^= 1];
  next.style.backgroundImage = `url("${String(url).replace(/["\\\n]/g, '')}")`;
  next.classList.add('on'); els[amb ^ 1].classList.remove('on');
}

// ---- small pieces ----
const logo = (src) => { const i = h('img', { src, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }); i.addEventListener('error', () => i.remove()); return i; };
const sticker = (cut, cls = '') => (cut > 0 ? h('span', { class: `stk ${cut >= 80 ? 'hot' : cut < 35 ? 'soft' : ''} ${cls}`.trim(), text: `-${cut}%` }) : null);
function storeChip(id) {
  const st = S.stores[id];
  return h('span', { class: 'store' }, st?.icon ? logo(st.icon) : null, st?.name || 'Magazin');
}
function rateChip(d) {
  if (!d.steamPct) return null;
  return h('span', { class: `rate ${d.steamPct >= 80 ? 'good' : d.steamPct >= 60 ? 'mid' : 'bad'}`, title: `Recenzii pe Steam: ${d.steamPct}% pozitive${d.steamCount ? `, din ${d.steamCount.toLocaleString('ro-RO')}` : ''}`, text: `${d.steamPct}% recenzii` });
}
const sectionHead = (title, sub, href, more) => h('div', { class: 'sec-head' }, h('h2', { text: title }), sub ? h('p', { text: sub }) : null, href ? h('a', { class: 'more', href, text: more || 'Vezi toate' }) : null);
const skeletons = (n) => Array.from({ length: n }, () => h('div', { class: 'sk', 'aria-hidden': 'true' }));
const empty = (title, text, action) => h('div', { class: 'empty' }, h('b', { text: title }), text, action || null);

function dealCard(d, i = 0) {
  const on = S.watching.has(d.gameId);
  return h('article', { class: 'deal rv', style: { '--i': i } },
    h('button', { class: 'art', type: 'button', tabindex: '-1', 'aria-hidden': 'true', onclick: () => openGame(d.gameId, d) }, cover(d, false), d.meta >= 85 ? h('span', { class: 'flag', text: `Metacritic ${d.meta}` }) : null),
    d.sale === 0 ? h('span', { class: 'stk free', text: 'Gratis' }) : sticker(d.cut),
    h('div', { class: 'body' },
      h('h3', null, h('button', { type: 'button', onclick: () => openGame(d.gameId, d), text: d.title })),
      h('div', { class: 'meta' }, storeChip(d.store), rateChip(d)),
      h('div', { class: 'buy' },
        h('div', { class: 'p' }, h('b', { text: money(d.sale) }), d.normal > d.sale ? h('s', { text: money(d.normal) }) : null),
        h('button', { class: `iconbtn heart${on ? ' on' : ''}`, type: 'button', 'aria-label': on ? `${d.title} e în wishlist` : `Urmărește prețul pentru ${d.title}`, onclick: () => openGame(d.gameId, d, true) }, icon('heart', 18)),
        h('a', { class: 'iconbtn go', href: d.url, target: '_blank', rel: 'noopener nofollow', 'aria-label': `Deschide oferta pentru ${d.title} în magazin` }, icon('out', 18)))));
}

function freeCard(g, soon) {
  return h('article', { class: `freec rv${soon ? ' soon' : ''}` },
    h('div', { class: 'art' }, cover(g, true), h('span', { class: `stk ${soon ? 'soft' : 'free'}`, text: soon ? 'Urmează' : 'Gratis' })),
    h('div', { class: 'body' },
      h('h3', { text: g.title }),
      g.desc ? h('p', { text: g.desc }) : null,
      h('div', { class: 'clock' }, icon('clock', 18), h('span', { text: soon ? 'Începe în ' : 'Se termină în ' }), h('span', { 'data-until': soon ? g.start : g.end, text: left(soon ? g.start : g.end) })),
      h('div', { class: 'row' }, g.worth ? h('s', { text: money(g.worth) }) : h('span', { class: 'muted', style: { marginRight: 'auto' }, text: g.store }),
        h('a', { class: `btn small ${soon ? 'ghost' : 'mint'}`, href: g.url, target: '_blank', rel: 'noopener nofollow' }, soon ? 'Vezi pe Epic' : 'Deschide pe Epic', icon('out', 16)))));
}

// plain text with line breaks; only http(s) addresses become links
function richText(text) {
  const out = [], re = /https?:\/\/[^\s<>"]+/g; let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const url = m[0].replace(/[.,;:!?)]+$/, '');
    out.push(h('a', { href: url, target: '_blank', rel: 'noopener nofollow', text: url }), m[0].slice(url.length));
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
function postCard(n, short) {
  const act = (path, body) => async () => { const r = await api(path, body); toast(r.data.msg || r.data.error || 'Ceva nu a mers.', !r.ok); if (r.ok) { S.homeAt = 0; render(); } };
  return h('article', { class: `post rv${n.pinned ? ' pinned' : ''}${short ? ' short' : ''}` },
    h('div', { class: 'tagrow' }, h('span', { class: `tagc ${n.tag}`, text: S.tags[n.tag] || 'Anunț' }), n.pinned ? h('span', null, icon('pin', 14), ' Fixat') : null, h('span', { text: ago(n.at) })),
    h('h3', { text: n.title }),
    !short && n.image ? h('img', { class: 'pic', src: n.image, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }) : null,
    h('div', { class: 'text' }, richText(n.body)),
    n.link ? h('p', { style: { margin: 0 } }, h('a', { class: 'btn small ghost', href: n.link, target: '_blank', rel: 'noopener nofollow' }, 'Deschide linkul', icon('out', 16))) : null,
    h('div', { class: 'by' }, n.by.avatar ? h('img', { class: 'av', src: n.by.avatar, alt: '' }) : h('span', { class: 'av', text: n.by.name[0] }), n.by.name,
      short ? h('a', { class: 'more', href: '#/anunturi', style: { marginLeft: 'auto', color: 'var(--tag)', fontWeight: 800, textDecoration: 'none' }, text: 'Citește' })
        : S.admin ? h('div', { class: 'acts' },
          h('button', { class: 'btn small ghost', type: 'button', onclick: act('/api/news/pin', { id: n.id, pinned: !n.pinned }) }, icon('pin', 16), n.pinned ? 'Scoate de sus' : 'Fixează sus'),
          h('button', { class: 'btn small danger', type: 'button', onclick: () => { if (confirm(`Ștergi anunțul „${n.title}”?`)) act('/api/news/remove', { id: n.id })(); } }, icon('trash', 16), 'Șterge')) : null));
}

// ---- spotlight: the best deals as a deck of covers that deals itself ----
function spotlight(list) {
  let idx = 0, timer = null;
  const el = h('section', { class: 'spot', 'aria-label': 'Ofertele momentului' }), copy = h('div', { class: 'spot-copy' });
  const covers = list.map((d, i) => h('button', { class: 'cover', type: 'button', 'aria-label': d.title, onclick: () => (i === idx ? openGame(d.gameId, d) : go(i)) }, cover(d, true, (src) => { d._art = src; if (i === idx) ambient(src); })));
  const deck = h('div', { class: 'deck' }, covers);
  el.append(copy, deck);
  function paint(first) {
    const d = list[idx], n = list.length;
    covers.forEach((c, i) => { const p = (i - idx + n) % n; c.dataset.p = p === 0 ? '0' : p === 1 ? '1' : p === 2 ? '2' : p === n - 1 ? '-1' : 'x'; c.tabIndex = p === 0 ? 0 : -1; });
    const cut = h('span', { class: `bigcut${d.cut >= 80 ? ' hot' : ''}`, text: `-${d.cut}%` });
    copy.replaceChildren(
      h('span', { class: 'kicker' }, h('i'), 'Oferta momentului'),
      h('h1', { text: d.title }),
      h('div', { class: 'spot-meta' }, storeChip(d.store), rateChip(d), d.meta ? h('span', { class: 'rate', text: `Metacritic ${d.meta}` }) : null),
      h('div', { class: 'spot-price' }, cut, h('div', { class: 'nowprice' }, h('b', { text: money(d.sale) }), h('s', { text: money(d.normal) }))),
      h('div', { class: 'spot-cta' },
        h('a', { class: 'btn', href: d.url, target: '_blank', rel: 'noopener nofollow' }, 'Vezi oferta', icon('out', 18)),
        h('button', { class: 'btn ghost', type: 'button', onclick: () => openGame(d.gameId, d) }, 'Compară prețurile')),
      n > 1 ? h('div', { class: 'spot-dots' }, list.map((_, i) => h('button', { type: 'button', class: i < idx ? 'done' : i === idx ? 'on' : '', 'aria-label': `Oferta ${i + 1} din ${n}`, onclick: () => go(i) }, h('i')))) : null);
    if (d._art) ambient(d._art);
    el.classList.remove('swap'); void el.offsetWidth; if (!first) el.classList.add('swap');
    if (!REDUCED) { const t0 = performance.now(); (function tick(t) { const k = Math.min(1, (t - t0) / 700); cut.textContent = `-${Math.round(d.cut * (1 - Math.pow(1 - k, 3)))}%`; if (k < 1) requestAnimationFrame(tick); })(t0); }
  }
  function go(i) { idx = (i + list.length) % list.length; paint(false); arm(); }
  function arm() { clearInterval(timer); if (!REDUCED && list.length > 1) timer = setInterval(() => { if (!document.hidden && !S.sheet) go(idx + 1); }, 7000); }
  paint(true); arm();
  cleanups.push(() => clearInterval(timer));
  return el;
}

function ticker(items) {
  if (items.length < 4) return null;
  const one = () => items.map((d) => h('button', { type: 'button', tabindex: '-1', onclick: () => openGame(d.gameId, d) }, h('b', { text: `-${d.cut}%` }), d.title, h('em', { text: money(d.sale) })));
  return h('div', { class: 'ticker', 'aria-hidden': 'true' }, h('div', { class: 'ticker-run', style: { '--t': `${items.length * 5}s` } }, one(), one()));
}

// ---- pages ----
async function loadHome() {
  if (S.home && Date.now() - S.homeAt < 180_000) return S.home;
  const r = await api('/api/home');
  if (r.ok) { S.home = r.data; S.homeAt = Date.now(); }
  return r.ok ? r.data : null;
}

async function pageHome() {
  const d = await loadHome();
  if (!d || d.down) return [empty('Prețurile nu se încarcă acum', 'Sursa de prețuri nu răspunde. De obicei revine în câteva minute.', h('button', { class: 'btn', type: 'button', onclick: () => { S.homeAt = 0; render(); } }, 'Încearcă din nou'))];
  const out = [];
  if (d.spot.length) out.push(spotlight(d.spot));
  const tk = ticker([...d.hot, ...d.fresh].slice(0, 16)); if (tk) out.push(tk);
  if (d.free.now.length || d.free.soon.length) out.push(h('section', { class: 'sec' }, sectionHead('Gratis acum', 'Le iei o dată și rămân ale tale.', '#/gratis'), h('div', { class: 'frees' }, d.free.now.map((g) => freeCard(g, false)), d.free.soon.slice(0, Math.max(0, 3 - d.free.now.length)).map((g) => freeCard(g, true)))));
  if (d.news.length) out.push(h('section', { class: 'sec' }, sectionHead('Anunțuri', null, '#/anunturi', 'Toate anunțurile'), h('div', { class: 'newsgrid' }, d.news.map((n) => postCard(n, true)))));
  const row = (title, sub, items, href) => (items.length ? h('section', { class: 'sec' }, sectionHead(title, sub, href), h('div', { class: 'grid' }, items.slice(0, 8).map(dealCard))) : null);
  out.push(row('Cele mai mari reduceri', 'Jocuri cu recenzii bune, la cel mai mare procent.', d.hot, '#/reduceri'),
    row('Sub 5 dolari și foarte bune', 'Peste 85% recenzii pozitive pe Steam.', d.cheap, '#/reduceri'),
    row('Tocmai au apărut', 'Reduceri pornite în ultimele ore.', d.fresh, '#/reduceri'));
  return out;
}

async function pageDeals() {
  const F = S.f, D = { items: new Set(), page: 0, done: false, loading: false, token: 0, streak: 0 };
  const grid = h('div', { class: 'grid' }), count = h('p', { class: 'count' }), sentinel = h('div', { style: { height: '1px' } });
  async function load(reset) {
    if (reset) { D.token++; D.items.clear(); D.page = 0; D.done = false; D.loading = false; D.streak = 0; grid.replaceChildren(...skeletons(12)); count.textContent = ''; }
    if (D.loading || D.done) return;
    D.loading = true; const tok = D.token;
    const p = new URLSearchParams({ sort: F.sort, page: String(D.page) });
    if (F.max) p.set('max', F.max); if (F.cut) p.set('cut', F.cut); if (F.q) p.set('q', F.q);
    if (F.store.length) p.set('store', F.store.join(',')); if (F.good) p.set('steam', '80'); if (F.aaa) p.set('aaa', '1');
    const r = await api(`/api/deals?${p}`).catch(() => ({ ok: false, data: {} }));
    if (tok !== D.token) return;
    D.loading = false;
    if (D.page === 0) grid.replaceChildren();
    if (!r.ok) { D.done = true; if (!D.items.size) grid.replaceChildren(empty('Reducerile nu se încarcă acum', r.data.error || 'Sursa de prețuri nu răspunde. Încearcă din nou peste un minut.')); return; }
    const fresh = r.data.items.filter((d) => !D.items.has(d.id) && D.items.add(d.id));
    const cards = fresh.map((d, i) => dealCard(d, i)); grid.append(...cards); reveal(grid);
    D.page++; D.done = (r.data.raw ?? r.data.items.length) < 60 || D.page >= 40;
    count.textContent = D.items.size ? `${D.items.size} ${D.items.size === 1 ? 'ofertă' : 'oferte'} afișate${D.done ? '' : ', mai sunt'}` : '';
    if (!D.items.size && D.done) grid.replaceChildren(empty('Nicio ofertă cu filtrele astea', 'Scoate un filtru sau ridică prețul maxim.'));
    // the discount filter is applied after the source answers, so a page can come back nearly empty: fetch on
    if (!D.done && fresh.length < 8 && D.streak++ < 5) return load(false);
    D.streak = 0;
  }
  const io = new IntersectionObserver((e) => { if (e[0].isIntersecting) load(false); }, { rootMargin: '600px' });
  io.observe(sentinel); cleanups.push(() => io.disconnect());

  const group = (key, opts) => h('div', { class: 'chips', role: 'group' }, opts.map(([val, label]) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(F[key] === val), onclick: (e) => {
    F[key] = val; for (const b of e.currentTarget.parentNode.children) b.setAttribute('aria-pressed', String(b === e.currentTarget)); load(true);
  } }, label)));
  const toggle = (key, label) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(F[key]), onclick: (e) => { F[key] = !F[key]; e.currentTarget.setAttribute('aria-pressed', String(F[key])); load(true); } }, label);
  let t;
  const q = h('input', { class: 'field', type: 'search', placeholder: 'Filtrează după nume', value: F.q, 'aria-label': 'Filtrează după nume', oninput: () => { clearTimeout(t); t = setTimeout(() => { F.q = q.value.trim(); load(true); }, 350); } });
  const sort = h('select', { class: 'field', 'aria-label': 'Ordonează', style: { flex: '0 1 230px' }, onchange: () => { F.sort = sort.value; load(true); } },
    [['rating', 'Cele mai bune oferte'], ['savings', 'Cea mai mare reducere'], ['price', 'Cel mai mic preț'], ['reviews', 'Cele mai bune recenzii'], ['metacritic', 'Scor Metacritic'], ['recent', 'Cele mai noi']].map(([v, l]) => h('option', { value: v, selected: F.sort === v }, l)));
  const storeBtn = h('button', { class: 'chip', type: 'button', 'aria-expanded': 'false' });
  const storeBox = h('div', { class: 'pop-box', hidden: true }, Object.values(S.stores).sort((a, b) => a.name.localeCompare(b.name)).map((st) => {
    const cb = h('input', { type: 'checkbox', checked: F.store.includes(st.id), onchange: () => { F.store = cb.checked ? [...F.store, st.id] : F.store.filter((x) => x !== st.id); label(); load(true); } });
    return h('label', null, cb, st.icon ? logo(st.icon) : null, st.name);
  }));
  const label = () => { storeBtn.textContent = F.store.length ? `Magazine: ${F.store.length}` : 'Toate magazinele'; storeBtn.setAttribute('aria-pressed', String(F.store.length > 0)); };
  label();
  storeBtn.addEventListener('click', () => { storeBox.hidden = !storeBox.hidden; storeBtn.setAttribute('aria-expanded', String(!storeBox.hidden)); });
  const away = (e) => { if (!e.target.closest('.pop')) { storeBox.hidden = true; storeBtn.setAttribute('aria-expanded', 'false'); } };
  document.addEventListener('click', away); cleanups.push(() => document.removeEventListener('click', away));

  load(true);
  return [
    h('div', { class: 'pagehead' }, h('h1', { text: 'Reduceri' }), h('p', { text: 'Toate ofertele de acum, din Steam și din celelalte magazine. Apasă pe un joc ca să vezi prețul în fiecare magazin și cel mai mic preț din istorie.' })),
    h('div', { class: 'filters' },
      h('div', { class: 'frow' }, q, sort, h('div', { class: 'pop' }, storeBtn, storeBox)),
      h('div', { class: 'frow' }, h('span', { class: 'lbl', text: 'Preț' }), group('max', [['', 'Orice'], ['5', 'Sub 5 $'], ['10', 'Sub 10 $'], ['20', 'Sub 20 $'], ['30', 'Sub 30 $']])),
      h('div', { class: 'frow' }, h('span', { class: 'lbl', text: 'Reducere' }), group('cut', [['', 'Orice'], ['50', 'Minimum 50%'], ['75', 'Minimum 75%'], ['90', 'Minimum 90%']]), toggle('good', 'Recenzii peste 80%'), toggle('aaa', 'Doar jocuri mari'))),
    count, grid, sentinel,
  ];
}

async function pageFree() {
  const r = await api('/api/free');
  const d = r.ok ? r.data : { now: [], soon: [], others: [], down: true };
  const out = [h('div', { class: 'pagehead' }, h('h1', { text: 'Gratis' }), h('p', { text: 'Jocuri pe care le poți lua acum fără să plătești. Le adaugi în cont și rămân ale tale.' }))];
  if (d.down && !d.others.length) out.push(h('div', { class: 'sec' }, empty('Lista nu se încarcă acum', 'Epic nu răspunde. Încearcă din nou peste câteva minute.')));
  if (d.now.length) out.push(h('section', { class: 'sec' }, sectionHead('Acum pe Epic Games', `${d.now.length} ${d.now.length === 1 ? 'joc' : 'jocuri'}`), h('div', { class: 'frees' }, d.now.map((g) => freeCard(g, false)))));
  if (d.soon.length) out.push(h('section', { class: 'sec' }, sectionHead('Urmează', 'Se deschid la data de mai jos.'), h('div', { class: 'frees' }, d.soon.map((g) => freeCard(g, true)))));
  if (d.others.length) out.push(h('section', { class: 'sec' }, sectionHead('Gratis și în alte magazine', 'Reduceri de 100%, cât țin.'), h('div', { class: 'grid' }, d.others.map(dealCard))));
  if (!d.down && !d.now.length && !d.soon.length && !d.others.length) out.push(h('div', { class: 'sec' }, empty('Niciun joc gratuit acum', 'Epic schimbă jocurile în fiecare joi. Botul anunță pe Discord când apare unul.')));
  return out;
}

async function pageNews() {
  const r = await api('/api/news'), list = r.ok ? r.data.news : [];
  const out = [h('div', { class: 'pagehead' }, h('h1', { text: 'Anunțuri' }), h('p', { text: 'Noutăți, evenimente și giveaway-uri de la echipa serverului.' }))];
  if (S.admin) {
    const title = h('input', { class: 'field', id: 'n-title', type: 'text', maxlength: 90, placeholder: 'De exemplu: Turneu sâmbătă seara' });
    const tag = h('select', { class: 'field', id: 'n-tag' }, Object.entries(S.tags).map(([k, v]) => h('option', { value: k }, v)));
    const bodyEl = h('textarea', { class: 'field', id: 'n-body', maxlength: 2000, placeholder: 'Scrie anunțul aici. Linkurile devin apăsabile.' });
    const link = h('input', { class: 'field', id: 'n-link', type: 'url', placeholder: 'https://' }), image = h('input', { class: 'field', id: 'n-img', type: 'url', placeholder: 'https://' });
    const pin = h('input', { type: 'checkbox' }), disc = h('input', { type: 'checkbox', checked: !!S.config?.newsChannel });
    out.push(h('section', { class: 'sec card' }, h('h2', { text: 'Scrie un anunț' }),
      h('div', { class: 'two' }, h('div', null, h('label', { class: 'lab', for: 'n-title', text: 'Titlu' }), title), h('div', null, h('label', { class: 'lab', for: 'n-tag', text: 'Fel' }), tag)),
      h('label', { class: 'lab', for: 'n-body', text: 'Text' }), bodyEl,
      h('div', { class: 'two' }, h('div', null, h('label', { class: 'lab', for: 'n-link', text: 'Link, opțional' }), link), h('div', null, h('label', { class: 'lab', for: 'n-img', text: 'Adresa unei imagini, opțional' }), image)),
      h('label', { class: 'check' }, pin, 'Fixează-l sus'),
      h('label', { class: 'check' }, disc, S.config?.newsChannel ? 'Trimite-l și pe Discord' : 'Trimite-l și pe Discord (alege întâi canalul în Setări)'),
      h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: async (e) => {
        const b = e.currentTarget; b.disabled = true;
        const res = await api('/api/news', { title: title.value, tag: tag.value, body: bodyEl.value, link: link.value, image: image.value, pinned: pin.checked, discord: disc.checked });
        b.disabled = false; toast(res.data.msg || res.data.error || 'Ceva nu a mers.', !res.ok);
        if (res.ok) { S.homeAt = 0; burst(innerWidth / 2, innerHeight / 2); render(); }
      } }, icon('horn', 18), 'Publică anunțul'))));
  }
  out.push(h('section', { class: 'sec feed' }, list.length ? list.map((n) => postCard(n, false)) : empty('Niciun anunț încă', S.admin ? 'Scrie primul anunț în formularul de mai sus.' : 'Când apare ceva nou, îl găsești aici.')));
  return out;
}

async function pageWatch() {
  const head = h('div', { class: 'pagehead' }, h('h1', { text: 'Wishlist' }), h('p', { text: 'Alegi un joc și prețul la care l-ai lua. Când ajunge acolo, botul îți scrie pe Discord.' }));
  if (!S.user) return [head, h('div', { class: 'sec' }, empty('Intră ca să ai wishlist', 'Lista se leagă de contul tău de Discord, ca botul să știe cui să scrie.', S.login ? h('a', { class: 'btn', href: '/auth/login' }, 'Intră cu Discord') : null))];
  const r = await api('/api/watch'), list = r.ok ? r.data.list : [];
  S.watching = new Set(list.map((e) => e.gameId));
  if (!list.length) return [head, h('div', { class: 'sec' }, empty('Lista ta e goală', 'Deschide un joc și apasă „Urmărește”, sau caută unul după nume.', h('button', { class: 'btn', type: 'button', onclick: openSearch }, icon('search', 18), 'Caută un joc')))];
  const rows = list.map((e) => {
    const hit = e.price !== null && e.price <= e.target, k = e.price ? Math.min(1, e.target / e.price) : 0;
    return h('div', { class: `wrow rv${hit ? ' hit' : ''}` },
      h('button', { class: 'art', type: 'button', 'aria-label': `Detalii pentru ${e.title}`, onclick: () => openGame(e.gameId, e) }, cover(e, false)),
      h('div', null, h('h3', { text: e.title }),
        h('div', { class: 'bar' }, h('i', { style: { width: `${Math.round(k * 100)}%` } })),
        h('div', { class: 'small muted', text: e.price === null ? `Ținta ta: ${money(e.target)}. Încă nu am un preț.` : hit ? `A ajuns la ${money(e.price)}. Ținta ta era ${money(e.target)}.` : `Acum ${money(e.price)} la ${S.stores[e.store]?.name || 'magazin'}. Ținta ta: ${money(e.target)}.` })),
      h('div', { class: 'side' },
        e.url ? h('a', { class: `btn small${hit ? ' mint' : ' ghost'}`, href: e.url, target: '_blank', rel: 'noopener nofollow' }, hit ? 'Cumpără acum' : 'Vezi oferta', icon('out', 16)) : null,
        h('button', { class: 'iconbtn', type: 'button', 'aria-label': `Scoate ${e.title} din listă`, onclick: async () => { const x = await api('/api/watch/remove', { gameId: e.gameId }); toast(x.data.msg || x.data.error, !x.ok); if (x.ok) render(); } }, icon('trash', 18))));
  });
  return [head, h('p', { class: 'count sec', text: `${list.length} din ${r.data.max} jocuri urmărite. Prețurile se verifică la fiecare jumătate de oră.` }), h('div', { class: 'wl' }, rows)];
}

async function pageAdmin() {
  if (!S.admin) return [empty('Doar pentru admini', 'Pagina asta e pentru cei care administrează serverul de Discord.')];
  const [ch] = await Promise.all([api('/api/channels')]);
  const chans = ch.ok ? ch.data.channels : [], c = S.config || {};
  const pick = (id, cur) => {
    const groups = new Map(); for (const x of chans) { if (!groups.has(x.group)) groups.set(x.group, []); groups.get(x.group).push(x); }
    return h('select', { class: 'field', id }, h('option', { value: '' }, 'Niciunul'), [...groups].map(([g, xs]) => { const o = xs.map((x) => h('option', { value: x.id, selected: x.id === cur }, `# ${x.name}`)); return g ? h('optgroup', { label: g }, o) : o; }));
  };
  const dealsCh = pick('c-deals', c.dealsChannel), newsCh = pick('c-news', c.newsChannel);
  const hour = h('input', { class: 'field', id: 'c-hour', type: 'number', min: 0, max: 23, value: c.hour }), minCut = h('input', { class: 'field', id: 'c-cut', type: 'number', min: 0, max: 95, value: c.minCut });
  const digest = h('input', { type: 'checkbox', checked: c.digest }), freeA = h('input', { type: 'checkbox', checked: c.freeAlerts });
  const savebtn = async () => {
    const r = await api('/api/config', { dealsChannel: dealsCh.value, newsChannel: newsCh.value, hour: hour.value, minCut: minCut.value, digest: digest.checked, freeAlerts: freeA.checked });
    toast(r.data.msg || r.data.error || 'Ceva nu a mers.', !r.ok); if (r.ok) S.config = r.data.config;
  };
  return [
    h('div', { class: 'pagehead' }, h('h1', { text: 'Setări' }), h('p', { text: 'Ce trimite botul pe Discord și unde.' })),
    h('section', { class: 'sec card' }, h('h2', { text: 'Reduceri pe Discord' }), h('p', { class: 'muted', text: 'În fiecare zi, botul trimite cele mai bune zece oferte în canalul ales. Tot acolo anunță jocurile gratuite noi.' }),
      !chans.length ? h('p', { class: 'muted', text: 'Nu văd niciun canal în care botul poate scrie. Are nevoie de View Channel, Send Messages și Embed Links.' }) : null,
      h('div', { class: 'two' }, h('div', null, h('label', { class: 'lab', for: 'c-deals', text: 'Canal pentru reduceri' }), dealsCh), h('div', null, h('label', { class: 'lab', for: 'c-hour', text: 'Ora (0 până la 23, ora României)' }), hour), h('div', null, h('label', { class: 'lab', for: 'c-cut', text: 'Reducere minimă, în procente' }), minCut)),
      h('label', { class: 'check' }, digest, 'Trimite reducerile zilnic'), h('label', { class: 'check' }, freeA, 'Anunță jocurile gratuite noi'),
      h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: savebtn }, 'Salvează setările'),
        h('button', { class: 'btn ghost', type: 'button', onclick: async () => { await savebtn(); const r = await api('/api/digest', {}); toast(r.data.msg || r.data.error || 'Ceva nu a mers.', !r.ok); } }, 'Trimite reducerile acum'))),
    h('section', { class: 'sec card' }, h('h2', { text: 'Anunțuri pe Discord' }), h('p', { class: 'muted', text: 'Când publici un anunț pe site și bifezi „Trimite-l și pe Discord”, ajunge în canalul ăsta.' }),
      h('label', { class: 'lab', for: 'c-news', text: 'Canal pentru anunțuri' }), newsCh,
      h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: savebtn }, 'Salvează setările'))),
  ];
}

// ---- game sheet: every store's price, the lowest price ever, and the wishlist form ----
function closeSheet() { $('#sheet').hidden = true; $('#palette').hidden = true; $('#scrim').hidden = true; document.body.classList.remove('lock'); S.sheet = false; }
async function openGame(gameId, seed = {}, focusWatch) {
  const sheet = $('#sheet');
  $('#palette').hidden = true; S.sheet = true;
  const draw = (g, loading) => {
    const best = g.deals?.[0], cur = best ? best.price : seed.sale, retail = best ? best.retail : seed.normal, cut = best ? best.cut : seed.cut || 0;
    const record = !!(g.low && best && best.price <= g.low.price + 0.005), on = S.watching.has(String(gameId));
    const target = h('input', { class: 'field', type: 'number', min: 0, max: 500, step: '0.01', inputmode: 'decimal', 'aria-label': 'Prețul țintă, în dolari',
      value: cur ? Math.max(0, Math.min(cur * 0.8, g.low ? Math.max(g.low.price, cur * 0.5) : cur * 0.8)).toFixed(2) : '' });
    const watch = !S.user ? (S.login ? h('a', { class: 'btn ghost', href: '/auth/login' }, icon('bell', 18), 'Intră cu Discord ca să primești alerta') : h('p', { class: 'muted', text: 'Alertele de preț au nevoie de login cu Discord, care nu e configurat încă.' }))
      : h('div', { class: 'watchform' }, target,
        h('button', { class: `btn${on ? ' ghost on' : ''}`, type: 'button', onclick: async (e) => {
          const r = await api('/api/watch', { gameId, target: target.value });
          toast(r.data.msg || r.data.error || 'Ceva nu a mers.', !r.ok);
          if (r.ok) { S.watching.add(String(gameId)); const b = e.currentTarget.getBoundingClientRect(); burst(b.left + b.width / 2, b.top); draw(g, false); }
        } }, icon('heart', 18), on ? 'Schimbă ținta' : 'Urmărește'),
        on ? h('button', { class: 'btn danger', type: 'button', onclick: async () => { const r = await api('/api/watch/remove', { gameId }); toast(r.data.msg || r.data.error, !r.ok); if (r.ok) { S.watching.delete(String(gameId)); draw(g, false); } } }, 'Nu mai urmări') : null);
    sheet.replaceChildren(
      h('div', { class: 'hero' }, cover({ ...seed, ...g }, true), h('button', { class: 'iconbtn x', type: 'button', 'aria-label': 'Închide', onclick: closeSheet }, icon('x', 18))),
      h('div', { class: 'in' },
        h('h2', { text: g.title || seed.title || 'Joc' }),
        cur !== undefined ? h('div', { class: 'best' }, cut ? h('span', { class: `bigcut${cut >= 80 ? ' hot' : ''}`, style: { fontSize: '34px', boxShadow: '4px 4px 0 #000' }, text: `-${cut}%` }) : null,
          h('div', { class: 'nowprice' }, h('b', { text: money(cur) }), retail > cur ? h('s', { text: money(retail) }) : null),
          (best || seed.url) ? h('a', { class: 'btn', href: best?.url || seed.url, target: '_blank', rel: 'noopener nofollow' }, `Cumpără de la ${S.stores[best?.store || seed.store]?.name || 'magazin'}`, icon('out', 18)) : null) : null,
        g.low ? h('div', { class: `lowbox${record ? ' rec' : ''}` }, record ? h('b', { text: 'Acum e cel mai mic preț din istorie. ' }) : null, 'Cel mai mic preț din istorie: ', h('b', { text: money(g.low.price) }), `, în ${monthStr(g.low.at)}.`) : null,
        h('h3', { text: 'Prețul în fiecare magazin' }),
        loading ? h('div', { class: 'shops' }, skeletons(3).map((s) => { s.style.minHeight = '46px'; return s; }))
          : g.deals?.length ? h('div', { class: 'shops' }, g.deals.map((d) => h('a', { class: 'shop', href: d.url, target: '_blank', rel: 'noopener nofollow' },
            h('span', { class: 'lg' }, S.stores[d.store]?.icon ? logo(S.stores[d.store].icon) : null), h('span', { text: S.stores[d.store]?.name || 'Magazin' }), h('span', { class: 'c', text: d.cut ? `-${d.cut}%` : 'preț întreg' }), h('b', { text: money(d.price) }))))
            : h('p', { class: 'muted', text: 'Nu am găsit prețuri pentru jocul ăsta acum.' }),
        !loading && g.priceHistory?.length ? hubPriceGraph(g.priceHistory) : null,
        h('h3', { id: 'watch-h', text: on ? 'Îl urmărești. Poți schimba prețul țintă (în dolari).' : 'Anunță-mă pe Discord când scade la (în dolari)' }), watch,
        (g.appId || seed.appId) ? h('p', { style: { marginTop: '24px' } }, h('a', { class: 'btn small ghost', href: `https://store.steampowered.com/app/${g.appId || seed.appId}/`, target: '_blank', rel: 'noopener nofollow' }, 'Pagina de pe Steam', icon('out', 16))) : null));
    if (focusWatch && !loading) { focusWatch = false; setTimeout(() => { $('#watch-h')?.scrollIntoView({ block: 'center', behavior: REDUCED ? 'auto' : 'smooth' }); target.focus?.(); }, 250); }
  };
  draw({ title: seed.title, appId: seed.appId, thumb: seed.thumb }, true);
  sheet.hidden = false; $('#scrim').hidden = false; document.body.classList.add('lock'); sheet.scrollTop = 0;
  const r = await api(`/api/game?id=${encodeURIComponent(gameId)}`).catch(() => ({ ok: false, data: {} }));
  if (sheet.hidden) return;
  draw(r.ok ? r.data : { title: seed.title, appId: seed.appId, thumb: seed.thumb, deals: seed.url ? [{ store: seed.store, price: seed.sale, retail: seed.normal, cut: seed.cut, url: seed.url }] : [] }, false);
}

// ---- search: any game by name, not only the ones on sale ----
function openSearch() {
  const pal = $('#palette'); let t, tok = 0;
  const list = h('ul'), hint = h('div', { class: 'hint', text: 'Scrie numele unui joc. Găsești și jocuri care nu sunt la reducere acum.' });
  const input = h('input', { type: 'search', placeholder: 'Caută un joc', 'aria-label': 'Caută un joc', autocomplete: 'off', oninput: () => {
    clearTimeout(t); const v = input.value.trim(), my = ++tok;
    if (v.length < 2) { list.replaceChildren(); hint.hidden = false; hint.textContent = 'Scrie cel puțin două litere.'; return; }
    t = setTimeout(async () => {
      hint.hidden = false; hint.textContent = 'Caut…';
      const r = await api(`/api/search?q=${encodeURIComponent(v)}`).catch(() => ({ ok: false, data: {} }));
      if (my !== tok) return;
      const games = r.ok ? r.data.games : [];
      hint.hidden = games.length > 0; hint.textContent = r.ok ? 'Niciun joc cu numele ăsta.' : (r.data.error || 'Căutarea nu merge acum.');
      list.replaceChildren(...games.map((g) => h('li', null, h('button', { type: 'button', onclick: () => { pal.hidden = true; openGame(g.gameId, { title: g.title, thumb: g.thumb, appId: g.appId, sale: g.cheapest, url: g.url }); } },
        h('span', { class: 'art' }, cover(g, false)), h('span', { text: g.title }), h('b', { text: `de la ${money(g.cheapest)}` })))));
    }, 320);
  } });
  pal.replaceChildren(h('div', { class: 'q' }, icon('search', 20), input, h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Închide căutarea', onclick: closeSheet }, icon('x', 18))), list, hint);
  $('#sheet').hidden = true; pal.hidden = false; $('#scrim').hidden = false; document.body.classList.add('lock'); S.sheet = true;
  input.focus();
}

// ---- shell ----
const TABS = [['', 'Acasă', 'home'], ['reduceri', 'Reduceri', 'tag'], ['gratis', 'Gratis', 'gift'], ['anunturi', 'Anunțuri', 'horn'], ['wishlist', 'Wishlist', 'heart'], ['comunitate', 'Hub', 'users']];
const PAGES = { '': pageHome, reduceri: pageDeals, gratis: pageFree, anunturi: pageNews, wishlist: pageWatch, setari: pageAdmin, ...hubPages };
const route = () => { const r = location.hash.replace(/^#\/?/, '').split('?')[0]; return r in PAGES ? r : ''; };

function shell() {
  const r = route(), freeN = S.home?.free?.now?.length || 0;
  const links = (short) => TABS.map(([k, label, ic]) => h('a', { href: `#/${k}`, 'aria-current': (k === r || (k === 'comunitate' && r in hubPages)) ? 'page' : null }, icon(ic, short ? 22 : 18), h('span', { text: label }), !short && k === 'gratis' && freeN ? h('span', { class: 'n', text: freeN }) : null));
  $('#nav').replaceChildren(...links(false)); $('#tabbar').replaceChildren(...links(true));
  const me = $('#me');
  if (S.user) {
    const menu = h('div', { class: 'menu', hidden: true },
      h('a', { href: '#/wishlist' }, icon('heart', 18), 'Wishlist'), h('a',{href:'#/profil'},icon('users',18),'Profil & notificări'), S.admin ? h('a', { href: '#/setari' }, icon('gear', 18), 'Setări') : null, h('a', { href: '/auth/logout' }, icon('exit', 18), 'Ieși din cont'));
    const btn = h('button', { class: 'who', type: 'button', 'aria-expanded': 'false', 'aria-label': `Cont: ${S.user.name}`, onclick: (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; btn.setAttribute('aria-expanded', String(!menu.hidden)); } },
      S.user.avatar ? h('img', { src: S.user.avatar, alt: '' }) : h('span', { class: 'av', text: S.user.name[0] }), h('span', { text: S.user.name }));
    me.replaceChildren(btn, menu);
  } else me.replaceChildren(S.login ? h('a', { class: 'btn small', href: '/auth/login' }, 'Intră cu Discord') : '');
}
document.addEventListener('click', () => { const m = $('#me .menu'); if (m) m.hidden = true; });

let renderTok = 0;
async function render() {
  const my = ++renderTok, r = route(), view = $('#view');
  for (const c of cleanups.splice(0)) c();
  shell();
  view.replaceChildren(h('div', { class: 'grid', style: { marginTop: '10px' } }, skeletons(8)));
  let nodes;
  try { nodes = await PAGES[r](); } catch (err) { console.error(err); nodes = [empty('Ceva nu a mers', 'Pagina nu s-a putut încărca. Reîncarc-o peste un minut.')]; }
  if (my !== renderTok) return;
  view.replaceChildren(...nodes.flat(Infinity).filter(Boolean));
  shell(); reveal(view);
  document.title = `${r ? `${TABS.find((t) => t[0] === r)?.[1] || 'Setări'} · ` : ''}${document.title.split(' · ').pop()}`;
}
addEventListener('hashchange', () => { closeSheet(); scrollTo(0, 0); render(); });

let revealer = null;
function reveal(root) {
  const els = root.querySelectorAll('.rv:not(.in)');
  if (REDUCED || !('IntersectionObserver' in window)) { for (const el of els) el.classList.add('in'); return; }
  revealer ||= new IntersectionObserver((list) => {
    let k = 0;
    for (const e of list) if (e.isIntersecting) { e.target.style.setProperty('--d', `${Math.min(k++, 10) * 60}ms`); e.target.classList.add('in'); revealer.unobserve(e.target); }
  }, { rootMargin: '0px 0px -4% 0px' });
  for (const el of els) revealer.observe(el);
}

// ---- effects: card tilt under the pointer, a confetti burst when something good happens, live countdowns ----
function startTilt() {
  if (REDUCED || !matchMedia('(pointer: fine)').matches) return;
  let last = null;
  addEventListener('pointermove', (e) => {
    const el = e.target.closest?.('.deal, .deck .cover[data-p="0"]');
    if (last && last !== el) { last.style.removeProperty('--rx'); last.style.removeProperty('--ry'); last = null; }
    if (!el) return;
    const b = el.getBoundingClientRect(), px = (e.clientX - b.left) / b.width - 0.5, py = (e.clientY - b.top) / b.height - 0.5;
    el.style.setProperty('--ry', `${(px * 10).toFixed(1)}deg`); el.style.setProperty('--rx', `${(-py * 8).toFixed(1)}deg`); last = el;
  }, { passive: true });
}
let burst = () => {};
function startFx() {
  const cv = $('#fx'); if (REDUCED || !cv) return;
  const ctx = cv.getContext('2d'), parts = [], colors = ['#ffd400', '#ff4d6d', '#3df2b0', '#ffffff', '#7c5cff'];
  let W = 0, H = 0, run = false, last = 0;
  const size = () => { const dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
  size(); addEventListener('resize', size);
  function frame(t) {
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    ctx.clearRect(0, 0, W, H);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.life += dt;
      if (p.life > p.max || p.y > H + 30) { parts.splice(i, 1); continue; }
      p.vy += 900 * dt; p.vx *= 0.99; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.globalAlpha = Math.min(1, (p.max - p.life) * 2); ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
    }
    if (parts.length) requestAnimationFrame(frame); else { run = false; ctx.clearRect(0, 0, W, H); }
  }
  burst = (x, y) => {
    for (let i = 0; i < 46; i++) { const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4, v = 260 + Math.random() * 520; parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: Math.random() * 6, vr: (Math.random() - 0.5) * 14, w: 6 + Math.random() * 8, h: 4 + Math.random() * 6, c: colors[i % colors.length], life: 0, max: 1.3 + Math.random() * 0.8 }); }
    if (!run) { run = true; last = performance.now(); requestAnimationFrame(frame); }
  };
}
setInterval(() => { for (const el of document.querySelectorAll('[data-until]')) el.textContent = left(Number(el.dataset.until)); }, 1000);

// ---- start ----
$('#find').append(icon('search', 18), h('span', { text: 'Caută un joc' }), h('kbd', { text: '/' }));
$('#find').addEventListener('click', openSearch);
$('#scrim').addEventListener('click', closeSheet);
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeSheet();
  else if ((e.key === '/' || (e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey))) && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '')) { e.preventDefault(); openSearch(); }
});
const cur = $('#cur');
function fillCur() {
  const opts = [['USD', '$ USD'], ['EUR', '€ EUR'], ['GBP', '£ GBP'], ['RON', 'lei RON']].filter(([k]) => k === 'USD' || S.rates[k]);
  if (!opts.some(([k]) => k === S.cur)) S.cur = 'USD';
  cur.replaceChildren(...opts.map(([k, l]) => h('option', { value: k, selected: k === S.cur }, l)));
  cur.hidden = opts.length < 2;
}
cur.addEventListener('change', () => { S.cur = cur.value; try { localStorage.setItem('cur', S.cur); } catch { /* storage blocked */ } render(); });

(async function boot() {
  startTilt(); startFx(); shell();
  const me = await api('/api/me').catch(() => null);
  if (me?.ok) { Object.assign(S, { user: me.data.user, admin: me.data.admin, login: me.data.login, stores: me.data.stores || {}, rates: me.data.rates || {}, tags: me.data.tags || {}, config: me.data.config || null }); S.watching = new Set(me.data.watching || []); }
  fillCur();
  render();
})();
