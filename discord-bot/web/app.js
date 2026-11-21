'use strict';
// Diesel Union portal. No framework: small helpers build the DOM (never innerHTML).

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
const h = (t, a, ...k) => build(document.createElement(t), a, k);
const svg = (t, a, ...k) => build(document.createElementNS('http://www.w3.org/2000/svg', t), a, k);

const ICONS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1M16 3.5a4 4 0 0 1 0 7.5M22 21v-1a6 6 0 0 0-4-5.6',
  truck: 'M2 6h11v10H2zM13 9h4l4 4v3h-8zM6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  trophy: 'M7 4h10v4a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 13v4M8 21h8M9 17h6v4H9z',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  pen: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  x: 'M6 6l12 12M18 6 6 18',
  clock: 'M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18zM12 7v5l3 2',
  pin: 'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 12a2.500 2.500 0 1 0 0-5 2.500 2.500 0 0 0 0 5z',
  server: 'M4 4h16v6H4zM4 14h16v6H4zM8 7h.01M8 17h.01',
  gear: 'M12 15a3 3 0 1 1 0-6 3 3 0 0 1 0 6zM19.4 15a1.700 1.700 0 0 0 .3 1.800l.1.100a2 2 0 1 1-2.800 2.800l-.1-.1a1.700 1.700 0 0 0-1.800-.3 1.700 1.700 0 0 0-1 1.500V21a2 2 0 1 1-4 0v-.1a1.700 1.700 0 0 0-1.100-1.500 1.700 1.700 0 0 0-1.800.3l-.1.1a2 2 0 1 1-2.800-2.800l.1-.1a1.700 1.700 0 0 0 .3-1.800 1.700 1.700 0 0 0-1.500-1H3a2 2 0 1 1 0-4h.1a1.700 1.700 0 0 0 1.500-1.100 1.700 1.700 0 0 0-.3-1.800l-.1-.1a2 2 0 1 1 2.800-2.800l.1.1a1.700 1.700 0 0 0 1.800.3H9a1.700 1.700 0 0 0 1-1.500V3a2 2 0 1 1 4 0v.1a1.700 1.700 0 0 0 1 1.500 1.700 1.700 0 0 0 1.800-.3l.1-.1a2 2 0 1 1 2.800 2.800l-.1.1a1.700 1.700 0 0 0-.3 1.800V9a1.700 1.700 0 0 0 1.500 1H21a2 2 0 1 1 0 4h-.1a1.700 1.700 0 0 0-1.500 1z',
  exit: 'M10 4H5v16h5M14 8l4 4-4 4M18 12H9',
  link: 'M10 14a4 4 0 0 0 5.700 0l3-3a4 4 0 0 0-5.700-5.700l-1 1M14 10a4 4 0 0 0-5.700 0l-3 3a4 4 0 0 0 5.700 5.700l1-1',
  out: 'M8 16 16 8M9 8h7v7',
  refresh: 'M20 11a8 8 0 1 0-2.300 5.700M20 4v7h-7',
  lock: 'M6 11h12v10H6zM8 11V8a4 4 0 0 1 8 0v3',
  check: 'M5 12.500 10 17 19 7',
  route: 'M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6 15V9a3 3 0 0 1 3-3h3M18 9v6a3 3 0 0 1-3 3h-3',
  chev: 'M6 9l6 6 6-6',
  img: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01',
  send: 'M4 12 20 4l-6 16-3-7zM11 13l9-9',
  discord: 'M8 7c-2 .500-3 1-3 1-1.500 3-2 6-1.500 9 1.500 1.300 3 2 4.500 2l1-1.700M16 7c2 .500 3 1 3 1 1.500 3 2 6 1.500 9-1.500 1.300-3 2-4.500 2l-1-1.700M7.500 16c3 1.500 6 1.500 9 0M9.500 13h.01M14.500 13h.01M9 6.500c2-.500 4-.500 6 0',
};
const icon = (n, s = 20) => svg('svg', { class: 'ico', viewBox: '0 0 24 24', width: s, height: s, 'aria-hidden': 'true' }, svg('path', { d: ICONS[n].replace(/(\d)\.(\d)00/g, '$1.$2') }));

const S = { user: null, role: null, caps: {}, teams: [], member: false, cfg: { name: 'Diesel Union', ranks: [], requirements: [] }, login: false, driver: null, anim: true };
let cleanups = [];
async function api(path, body) {
  const res = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  let data = {}; try { data = await res.json(); } catch { /* not JSON */ }
  return { ok: res.ok, status: res.status, data };
}
let tt;
function toast(msg, bad) { const t = $('#toast'); t.textContent = msg; t.className = `toast${bad ? ' bad' : ''}`; t.hidden = false; t.style.animation = 'none'; void t.offsetWidth; t.style.animation = ''; clearTimeout(tt); tt = setTimeout(() => { t.hidden = true; }, bad ? 5200 : 3600); }
async function act(path, body, after) { const r = await api(path, body); toast(r.data.msg || r.data.error || 'Something went wrong.', !r.ok); if (r.ok && after) await after(r.data); return r.ok; }

const n0 = (v) => Math.round(v || 0).toLocaleString('en-GB');
const kmS = (v) => `${n0(v)} km`;
const cash = (v, game) => `${n0(v)} ${game === 'ATS' ? '$' : '€'}`;
const dateL = (ms) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
const timeL = (ms) => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
function ago(ms) { if (!ms) return ''; const m = Math.round((Date.now() - ms) / 60000); if (m < 1) return 'just now'; if (m < 60) return `${m} min ago`; if (m < 1440) return `${Math.round(m / 60)} h ago`; const d = Math.round(m / 1440); return d < 30 ? `${d} ${d === 1 ? 'day' : 'days'} ago` : dateL(ms); }
function until(ms) { let s = Math.max(0, Math.floor((ms - Date.now()) / 1000)); const d = Math.floor(s / 86400); s -= d * 86400; const p = (x) => String(x).padStart(2, '0'); return `${d ? `${d}d ` : ''}${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`; }
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function av(src, name, cls = 'av') {
  const ph = () => h('span', { class: cls, text: (String(name || '?').trim()[0] || '?').toUpperCase() });
  if (!src) return ph();
  const i = h('img', { class: cls, src, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' });
  i.addEventListener('error', () => i.replaceWith(ph()));
  return i;
}
// rank shown as stripes, one per rank level
function chevrons(rank) {
  const total = rank?.of || S.cfg.ranks?.length || 6; // one to six chevrons, spread over however many ranks there are
  const n = Math.max(1, Math.min(6, 1 + Math.floor(((rank?.index ?? 0) * 6) / total)));
  return h('span', { class: 'chev', title: rank?.name || '' }, svg('svg', { width: 12 + (n - 1) * 7, height: 14, viewBox: `0 0 ${12 + (n - 1) * 7} 14`, 'aria-hidden': 'true' },
    Array.from({ length: n }, (_, i) => svg('path', { d: `M${i * 7} 2 l6 5 -6 5`, fill: 'none', stroke: 'currentColor', 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }))));
}
const skel = (n, hgt = 120) => Array.from({ length: n }, () => h('div', { class: 'sk', style: { minHeight: `${hgt}px` }, 'aria-hidden': 'true' }));
const empty = (title, text, action) => h('div', { class: 'empty' }, h('b', { text: title }), h('p', { class: 'msg', text }), action || null);
const head = (title, sub, href, more) => h('div', { class: 'sec-head' }, h('h2', { text: title }), sub ? h('p', { text: sub }) : null, href ? h('a', { class: 'more', href, text: more || 'See all' }) : null);
const loginBtn = (txt) => (S.login ? h('a', { class: 'btn', href: '/auth/login' }, txt || 'Log in with Discord') : h('p', { class: 'muted', text: 'Discord login is not set up yet.' }));

// ---- the cover, alive: routes run across the map, lights glow on the truck, sparks rise ----
// coordinates are pixels of the 1920x350 cover; the overlay uses the same box, so they stay on target when it is cropped
const MAPDOTS = [[1689, 111], [1829, 139], [1622, 136], [1758, 156], [1650, 108], [1814, 76], [1872, 103], [1734, 67], [1664, 164], [1772, 65], [1867, 183], [1703, 171], [1739, 126], [1846, 54]];
const ROUTES = [[2, 0], [0, 12], [12, 3], [3, 1], [7, 9], [9, 5], [5, 6], [6, 1], [4, 8], [8, 11], [11, 3], [1, 10], [13, 5]];
const ROOF = [[549, 157], [572, 161], [596, 164], [619, 167]], HEADS = [[521, 287], [651, 299]];
function coverHero() {
  const g = (cx, cy, r, cls, i) => svg('circle', { cx, cy, r, class: cls, style: { '--i': i } });
  const routes = ROUTES.map(([a, b], i) => {
    const [x1, y1] = MAPDOTS[a], [x2, y2] = MAPDOTS[b], mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - Math.hypot(x2 - x1, y2 - y1) * 0.35;
    return svg('path', { d: `M${x1} ${y1}Q${mx} ${my} ${x2} ${y2}`, class: 'run', pathLength: 100, style: { '--i': i } });
  });
  const over = svg('svg', { class: 'cover-fx', viewBox: '0 0 1920 350', preserveAspectRatio: 'none', 'aria-hidden': 'true' },
    svg('defs', null, svg('radialGradient', { id: 'gl' }, svg('stop', { offset: '0', 'stop-color': '#ffd59a', 'stop-opacity': '.95' }), svg('stop', { offset: '.35', 'stop-color': '#ff9a3c', 'stop-opacity': '.45' }), svg('stop', { offset: '1', 'stop-color': '#ff7a1a', 'stop-opacity': '0' })),
      svg('radialGradient', { id: 'sun' }, svg('stop', { offset: '0', 'stop-color': '#ffcf8a', 'stop-opacity': '.8' }), svg('stop', { offset: '1', 'stop-color': '#ff7a1a', 'stop-opacity': '0' }))),
    svg('ellipse', { cx: 1431, cy: 345, rx: 260, ry: 120, fill: 'url(#sun)', class: 'sun' }),
    routes, MAPDOTS.map(([x, y], i) => [g(x, y, 16, 'halo', i), g(x, y, 3.2, 'node', i)]),
    ROOF.map(([x, y], i) => svg('circle', { cx: x, cy: y, r: 22, fill: 'url(#gl)', class: 'roof', style: { '--i': i } })),
    HEADS.map(([x, y], i) => svg('circle', { cx: x, cy: y, r: 46, fill: 'url(#gl)', class: 'head', style: { '--i': i } })));
  const band = h('div', { class: 'band', 'aria-hidden': 'true' },
    h('div', { class: 'pan' }, h('div', { class: 'frame' }, h('img', { class: 'cover', src: '/img/cover.webp', alt: '', fetchpriority: 'high' }), over)),
    h('div', { class: 'grain' }));
  // the picture leans a little toward the pointer
  if (!REDUCED && matchMedia('(pointer: fine)').matches) {
    let tx = 0, ty = 0, x = 0, y = 0, raf = 0, on = true;
    const pm = (e) => { tx = e.clientX / innerWidth - 0.5; ty = e.clientY / innerHeight - 0.5; };
    const loop = () => { if (!on) return; x += (tx - x) * 0.04; y += (ty - y) * 0.04; band.style.setProperty('--px', `${(-x * 30).toFixed(1)}px`); band.style.setProperty('--py', `${(-y * 18).toFixed(1)}px`); raf = requestAnimationFrame(loop); };
    addEventListener('pointermove', pm, { passive: true }); raf = requestAnimationFrame(loop);
    cleanups.push(() => { on = false; cancelAnimationFrame(raf); removeEventListener('pointermove', pm); });
  }
  return band;
}
function embers(cv) {
  if (REDUCED) return;
  const ctx = cv.getContext('2d'); let W = 0, H = 0, run = false, last = 0;
  const parts = Array.from({ length: 46 }, () => spawn(true));
  function spawn(any) { return { x: Math.random(), y: any ? Math.random() : 1.05, v: 0.03 + Math.random() * 0.07, s: 0.6 + Math.random() * 1.8, w: Math.random() * 6.28, a: 0.3 + Math.random() * 0.6 }; }
  const size = () => { const d = Math.min(devicePixelRatio || 1, 2); W = cv.clientWidth; H = cv.clientHeight; cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0); };
  function frame(t) {
    if (!run) return; const dt = Math.min(0.05, (t - last) / 1000); last = t;
    ctx.clearRect(0, 0, W, H);
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i]; p.y -= p.v * dt; p.w += dt * 1.6; p.x += Math.sin(p.w) * 0.0004;
      if (p.y < -0.05) parts[i] = spawn(false);
      const x = p.x * W, y = p.y * H, gr = ctx.createRadialGradient(x, y, 0, x, y, p.s * 4);
      gr.addColorStop(0, `rgba(255,200,130,${p.a})`); gr.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = gr; ctx.fillRect(x - p.s * 4, y - p.s * 4, p.s * 8, p.s * 8);
    }
    requestAnimationFrame(frame);
  }
  const set = (v) => { if (v && !run) { run = true; last = performance.now(); requestAnimationFrame(frame); } else if (!v) run = false; };
  const ro = new ResizeObserver(size); ro.observe(cv);
  const io = new IntersectionObserver(([e]) => set(e.isIntersecting && !document.hidden)); io.observe(cv);
  cleanups.push(() => { set(false); ro.disconnect(); io.disconnect(); });
}
// the hero sinks a little as the page scrolls
function scrollFx() {
  const f = () => document.documentElement.style.setProperty('--sc', Math.min(1, scrollY / 600).toFixed(3));
  addEventListener('scroll', f, { passive: true }); f(); cleanups.push(() => removeEventListener('scroll', f));
}
function medallion(big) {
  return h('div', { class: `medal${big ? ' big' : ''}`, 'aria-hidden': 'true' }, h('span', { class: 'ring' }), h('img', { src: '/img/logo-512.webp', alt: '', width: 512, height: 512 }), h('span', { class: 'shine' }));
}

// a mechanical counter: each digit is a reel that rolls into place
function odometer(value, minDigits = 5) {
  const str = Math.round(value || 0).toString().padStart(minDigits, '0');
  const groups = []; for (let i = str.length; i > 0; i -= 3) groups.unshift(str.slice(Math.max(0, i - 3), i));
  const wrap = h('div', { class: 'digits num', 'aria-label': n0(value) });
  groups.forEach((g, gi) => {
    if (gi) wrap.append(h('span', { class: 'digit sep', 'aria-hidden': 'true', text: '.' }));
    for (const ch of g) {
      const reel = h('span', { class: 'reel' }, Array.from({ length: 20 }, (_, k) => h('span', { text: k % 10 })));
      wrap.append(h('span', { class: 'digit', 'aria-hidden': 'true' }, reel));
      const target = 10 + Number(ch);
      if (REDUCED) reel.style.transform = `translateY(-${target}em)`;
      else requestAnimationFrame(() => requestAnimationFrame(() => { reel.style.transitionDelay = `${Math.random() * 0.4}s`; reel.style.transform = `translateY(-${target}em)`; }));
    }
  });
  wrap.lastChild.classList.add('last');
  return wrap;
}

// ---- pieces ----
function bill(j) {
  return h('div', { class: 'bill rv' },
    av(j.avatar, j.driverName),
    h('div', { class: 'drv' }, h('b', { text: j.driverName }), h('span', null, h('span', { class: `game ${j.game}`, text: j.game }), ' ', ago(j.end))),
    h('div', { class: 'way' }, h('div', { class: 'r' }, h('span', { text: j.from || '?' }), icon('arrow', 16), h('span', { text: j.to || '?' })),
      h('div', { class: 'c', text: [j.cargo, j.mass ? `${(j.mass / 1000).toFixed(1)} t` : null, j.truck].filter(Boolean).join(' · ') })),
    h('div', { class: 'k num' }, n0(j.km), h('small', { text: 'km' })),
    h('div', { class: 'm num' }, cash(j.income, j.game), h('small', { text: `damage ${j.dmg}%` })));
}
// Discord-style formatting (**bold**, *italic*, __underline__, ~~strike~~, `code`, > quote, - list, # heading, [text](link))
// turned into real elements. Built node by node, so nothing typed in can become HTML.
const MD_INLINE = /(\*\*\*([^*]+?)\*\*\*)|(\*\*(.+?)\*\*)|(__(.+?)__)|(\*([^*\s](?:[^*]*?[^*\s])?)\*)|(\b_([^_\s](?:[^_]*?[^_\s])?)_\b)|(~~(.+?)~~)|(\|\|(.+?)\|\|)|(`([^`]+?)`)|(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))|(https?:\/\/[^\s<>()]+[^\s<>().,!?])/g;
function mdInline(text) {
  const out = [], re = new RegExp(MD_INLINE.source, 'g'); let last = 0, m; // own copy: the calls nest
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) out.push(h('strong', null, h('em', null, mdInline(m[2]))));
    else if (m[3]) out.push(h('strong', null, mdInline(m[4])));
    else if (m[5]) out.push(h('u', null, mdInline(m[6])));
    else if (m[7]) out.push(h('em', null, mdInline(m[8])));
    else if (m[9]) out.push(h('em', null, mdInline(m[10])));
    else if (m[11]) out.push(h('s', null, mdInline(m[12])));
    else if (m[13]) out.push(h('span', { class: 'spoiler', title: 'Spoiler', text: m[14] }));
    else if (m[15]) out.push(h('code', { text: m[16] }));
    else if (m[17]) out.push(h('a', { href: m[19], target: '_blank', rel: 'noopener noreferrer' }, mdInline(m[18])));
    else if (m[20]) out.push(h('a', { href: m[20], target: '_blank', rel: 'noopener noreferrer', text: m[20] }));
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
function md(text, cls = '') {
  const lines = String(text || '').replace(/\r/g, '').split('\n'), blocks = [];
  let para = [], list = null, quote = null;
  const flush = () => {
    if (para.length) { blocks.push(h('p', null, para.flatMap((l, i) => (i ? [h('br'), ...mdInline(l)] : mdInline(l))))); para = []; }
    if (list) { blocks.push(h('ul', null, list.map((l) => h('li', null, mdInline(l))))); list = null; }
    if (quote) { blocks.push(h('blockquote', null, quote.flatMap((l, i) => (i ? [h('br'), ...mdInline(l)] : mdInline(l))))); quote = null; }
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    let m;
    if (!line.trim()) { flush(); continue; }
    if ((m = line.match(/^(#{1,3})\s+(.*)$/))) { flush(); blocks.push(h(`h${m[1].length + 2}`, { class: 'md-h' }, mdInline(m[2]))); continue; }
    if ((m = line.match(/^\s*[-*•]\s+(.*)$/))) { if (para.length || quote) { const l = list; list = null; flush(); list = l; } (list ||= []).push(m[1]); continue; }
    if ((m = line.match(/^>>?>?\s?(.*)$/))) { if (para.length || list) { const q = quote; quote = null; flush(); quote = q; } (quote ||= []).push(m[1]); continue; }
    if (list || quote) flush();
    para.push(line);
  }
  flush();
  return h('div', { class: `md ${cls}`.trim() }, blocks);
}
function convoyCard(c, full) {
  const d = new Date(c.start), soon = c.start - Date.now();
  const card = h('article', { class: `convoy panel rv${c.image ? ' has-img' : ''}`, style: c.image ? { '--img': `url("${String(c.image).replace(/["\\\n]/g, '')}")` } : null },
    h('div', { class: 'date' }, h('b', { text: d.getDate() }), h('span', { text: d.toLocaleDateString('en-GB', { month: 'short' }).replace('.', '') }), h('small', { text: timeL(c.start) })),
    h('div', null,
      h('h3', null, c.title, c.tmp ? h('span', { class: 'badge-tmp', text: c.kind === 'host' ? 'TruckersMP' : 'Attending' }) : null),
      (c.from || c.to) ? h('div', { class: 'route' }, h('span', { text: c.from || '?' }), h('i'), h('span', { text: c.to || '?' })) : null,
      h('div', { class: 'facts' },
        soon > 0 ? h('span', null, icon('clock', 16), 'Departs in ', h('span', { class: 'count', 'data-until': c.start, text: until(c.start) })) : h('span', null, icon('clock', 16), soon > -3 * 3600_000 ? 'On the road now' : 'Finished'),
        c.server ? h('span', null, icon('server', 16), c.server) : null, c.meet ? h('span', null, icon('pin', 16), c.meet) : null, h('span', { class: `game ${c.game}`, text: c.game })),
      full && c.slots && (c.slots.lead.length || c.slots.tail.length || c.slots.guard.length) ? h('p', { class: 'desc slots', text: [c.slots.lead.length ? `Lead: ${c.slots.lead.join(', ')}` : null, c.slots.tail.length ? `Tail: ${c.slots.tail.join(', ')}` : null, c.slots.guard.length ? `Road Guard: ${c.slots.guard.join(', ')}` : null].filter(Boolean).join(' · ') }) : null,
      full && c.dlc ? h('p', { class: 'desc', text: `DLC: ${c.dlc}` }) : null,
      full && c.desc ? md(c.desc, 'desc') : null),
    h('div', { class: 'rsvp' },
      c.tmp ? h('a', { class: 'btn ghost small', href: c.link, target: '_blank', rel: 'noopener' }, 'View on TruckersMP', icon('out', 16))
        : [faces(c), soon > -3 * 3600_000 ? rsvpButtons(c) : null, S.caps.events && full ? h('button', { class: 'btn danger small', type: 'button', onclick: () => { if (confirm(`Delete the convoy "${c.title}"?`)) act('/api/convoys/remove', { id: c.id }, render); } }, 'Delete') : null]));
  return card;
}
function faces(c) {
  if (!c.yes?.length && !c.maybe) return h('span', { class: 'muted small', text: 'Nobody has confirmed yet' });
  return h('div', { class: 'faces' }, c.yes.slice(0, 6).map((p) => av(p.avatar, p.name)), h('span', { class: 'more', text: `${c.yes.length} going${c.maybe ? `, ${c.maybe} maybe` : ''}` }));
}
function rsvpButtons(c) {
  if (!S.user) return S.login ? h('a', { class: 'btn small', href: '/auth/login' }, 'Log in to RSVP') : null;
  const opts = [['yes', 'Going'], ['maybe', 'Maybe'], ['no', 'Not going']];
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Are you coming?' }, opts.map(([k, l]) => h('button', { type: 'button', 'aria-pressed': String(c.mine === k), onclick: () => act('/api/rsvp', { id: c.id, status: k }, render) }, l)));
  if (c.mine !== 'yes' || !c.slots) return seg;
  // going: pick a role in the column
  const SL = [['lead', 'Lead', 1], ['tail', 'Tail', 1], ['guard', 'Road Guard', 4], ['driver', 'Driver', 999]];
  return h('div', { class: 'slotpick' }, seg, h('div', { class: 'seg small', role: 'group', 'aria-label': 'Your role in the convoy' }, SL.map(([k, l, max]) => {
    const n = c.slots[k]?.length || 0, mine = c.mySlot === k;
    return h('button', { type: 'button', 'aria-pressed': String(mine), disabled: !mine && n >= max, title: n ? c.slots[k].join(', ') : 'Open', onclick: () => act('/api/rsvp', { id: c.id, status: 'yes', slot: k }, render) }, l, max < 999 ? h('small', { text: ` ${n}/${max}` }) : null);
  })));
}

// ---- pages ----
const VALUES = [
  ['flag', 'Convoys every week', 'Routes are posted in advance, with a meeting point, a lead and a tail. Open to anyone who wants to get to know us.'],
  ['truck', 'Jobs that log themselves', 'Run Trucky while you drive and every delivery goes straight into the company logbook.'],
  ['trophy', 'Ranks you earn', 'Rank roles follow the kilometres you deliver for the company, from Rookie to Diesel Legend.'],
  ['users', 'A crew on voice', 'Someone is always around on Discord when the road gets long or the trailer gets stuck.'],
];
const STEPS = [
  ['Apply', 'Press Apply on our Discord or on this site and answer five short questions.'],
  ['Get accepted', 'Staff read every application. The answer comes in a Discord DM, usually the same day.'],
  ['Join on Trucky and TruckersMP', 'Join Diesel Union in both, with the Steam account you applied with.'],
  ['Drive your first convoy', 'The server opens for you. We introduce you to the crew and hit the road together.'],
];
const FAQ = [
  ['Do I have to play on TruckersMP?', 'Convoys are on TruckersMP. Your other jobs can be single player too: Trucky counts both.'],
  ['Which DLCs do I need?', 'None are required. When a convoy needs a map DLC, the announcement says so in advance.'],
  ['Do you play ATS?', 'No. Diesel Union drives Euro Truck Simulator 2 only, so only ETS2 jobs count.'],
  ['Is there a minimum distance?', 'No. What matters is staying active and joining a convoy when you can. Going away for a while? Tell us with /loa.'],
  ['How are ranks worked out?', 'From the total kilometres you deliver with Trucky since joining. The thresholds are shown above.'],
];

async function pageHome() {
  const r = await api('/api/home');
  const d = r.ok ? r.data : { tot: { month: {}, week: {}, all: {} }, next: [], drivers: 0, partners: [] };
  const scrollTo_ = () => $('#despre')?.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
  const hero = h('section', { class: 'du-hero', 'aria-label': 'Diesel Union, United by the Road' },
    h('div', { class: 'du-hero-photo', 'aria-hidden': 'true' }, h('img', { src: '/img/hero-fleet.webp', srcset: '/img/hero-fleet-1400.webp 1600w, /img/hero-fleet.webp 3094w', sizes: '(max-width: 900px) 200vw, 160vw', alt: '', fetchpriority: 'high', width: 3094, height: 1190 })),
    h('div', { class: 'du-hero-content' },
      h('div', { class: 'du-hero-kicker' }, h('span', { class: 'du-hero-dot' }), h('span', { class: 'du-kicker-primary', text: 'A TRUCKERSMP VIRTUAL TRUCKING COMPANY' }), h('span', { class: 'du-rule' }), h('span', { class: 'du-kicker-secondary', text: 'EURO TRUCK SIMULATOR 2' })),
      h('div', { class: 'du-hero-title' },
        h('span', { class: 'du-edition', text: '01 — THE UNION' }),
        h('h1', { 'aria-label': 'Diesel Union — We move as one' }, h('span', { text: 'WE MOVE.' }), h('span', { class: 'du-accent', text: 'AS ONE.' }))),
      h('p', { class: 'du-hero-tagline', text: S.cfg.tagline || 'United by the Road' }),
      h('p', { class: 'du-hero-lead', text: 'A home for drivers who believe the best part of the journey is who you share it with. Real convoys. Good company. Miles that mean something.' }),
      h('div', { class: 'du-hero-actions' },
        S.cfg.recruitOpen && !S.member ? h('a', { class: 'btn du-btn-primary', href: '#/aplica' }, 'Become a driver', icon('arrow', 19)) :
          S.member ? h('a', { class: 'btn du-btn-primary', href: '#/curse' }, 'Driver logbook', icon('arrow', 19)) : null,
        h('a', { class: 'du-link-arrow', href: '#/convoaie' }, 'Explore convoys', icon('arrow', 18))),
      h('div', { class: 'du-hero-caption' }, h('span', { text: 'INDEPENDENT. UNITED. ALWAYS MOVING.' }), h('span', { class: 'du-fine-line' }), h('span', { text: 'EST. ON THE OPEN ROAD' }))),
    h('div', { class: 'du-hero-bottom' },
      h('span', { class: 'du-hero-coords', text: 'DIESEL UNION / ON THE ROAD' }),
      h('button', { class: 'du-scroll', type: 'button', onclick: scrollTo_ }, 'DISCOVER OUR STORY', h('span', { class: 'du-scroll-arrow', text: '↓' }))));
  const m = d.tot.month || {};
  const stat = (value, label, note, idx) => h('div', { class: 'du-stat rv', style: { '--i': idx } },
    h('div', { class: 'du-stat-index', text: `0${idx + 1} /` }),
    h('div', { class: 'du-stat-value num', title: n0(value), 'aria-label': n0(value), text: value >= 1000000 ? `${(value / 1000000).toFixed(2).replace(/\.?0+$/, '')}M` : n0(value) }),
    h('div', { class: 'du-stat-label', text: label }),
    h('div', { class: 'du-stat-note', text: note }));
  const strip = h('section', { class: 'du-ticker', 'aria-label': 'Our culture' },
    h('div', { class: 'du-ticker-inner' }, 'THE LONG HAUL', h('span', { text: '✳' }), 'REAL PEOPLE', h('span', { text: '✳' }), 'SHARED MILES', h('span', { text: '✳' }), 'NO ONE DRIVES ALONE'));
  const odo = h('section', { class: 'du-stats', 'aria-label': 'Diesel Union company statistics' },
    stat(m.km, 'KM THIS MONTH', `${kmS(d.tot.all?.km)} since day one`, 0),
    stat(m.jobs, 'JOBS DELIVERED', `${n0(d.tot.week?.jobs)} this week`, 1),
    stat(Math.round((m.mass || 0) / 1000), 'TONNES HAULED', 'This month', 2),
    stat(d.drivers, 'OUR DRIVERS', `${n0(m.drivers)} active this month`, 3));
  const out = [hero, strip, odo];

  // members get their corner first
  if (S.member && (d.top?.length || d.recent?.length || d.dotm)) out.push(h('section', { class: 'sec' }, head('Driver corner', 'Only members can see this part.', '#/clasament', 'Full leaderboard'),
    d.dotm ? h('div', { class: 'v-dotm panel' }, h('span', { class: 'v-dotm-t', text: `Driver of the Month, ${d.dotm.month}` }), h('b', { text: d.dotm.name }), h('span', { class: 'muted', text: `${kmS(d.dotm.km)} in ${d.dotm.jobs} jobs` })) : null,
    d.top?.length ? podium(d.top, 'km') : null, d.recent?.length ? h('div', { class: 'bills', style: { marginTop: '22px' } }, d.recent.slice(0, 5).map(bill)) : null));

  out.push(h('section', { class: 'sec du-manifesto', id: 'despre' },
    h('div', { class: 'du-manifesto-left rv' },
      h('span', { class: 'du-label', text: '02 / OUR STORY' }),
      h('h2', null, 'MORE THAN', h('br'), h('span', { text: 'MILES.' })),
      h('div', { class: 'du-manifesto-rule' }),
      h('p', { text: S.cfg.about }),
      h('div', { class: 'du-manifesto-links' },
        S.cfg.discordInvite ? h('a', { class: 'du-text-link', href: S.cfg.discordInvite, target: '_blank', rel: 'noopener noreferrer' }, 'JOIN OUR DISCORD', icon('out', 16)) : null,
        S.cfg.tmpUrl ? h('a', { class: 'du-text-link', href: S.cfg.tmpUrl, target: '_blank', rel: 'noopener noreferrer' }, 'FIND US ON TRUCKERSMP', icon('out', 16)) : null)),
    h('div', { class: 'du-principles' }, VALUES.map(([ic, t, x], i) => h('article', { class: 'du-principle rv' },
      h('span', { class: 'du-principle-num', text: String(i + 1).padStart(2, '0') }),
      h('div', { class: 'du-principle-copy' }, h('h3', { text: t }), h('p', { text: x })),
      h('span', { class: 'du-principle-icon' }, icon(ic, 25)))))));

  out.push(h('section', { class: 'du-interlude rv' },
    h('div', { class: 'du-interlude-art', 'aria-hidden': 'true' }, h('img', { src: '/img/convoy-detail.webp', alt: '', loading: 'lazy', width: 1600, height: 1040 })),
    h('div', { class: 'du-interlude-content' }, h('span', { class: 'du-label', text: 'THE SPIRIT OF DIESEL UNION' }),
      h('p', null, 'SOME JOURNEYS', h('br'), h('em', { text: 'ARE BETTER' }), h('br'), 'TOGETHER.'),
      h('a', { href: '#/convoaie', class: 'du-text-link' }, 'SEE OUR UPCOMING CONVOYS', icon('arrow', 17)))));

  if (d.next.length) out.push(h('section', { class: 'sec' }, head('The next departure', 'Show up for the journey. Stay for the company.', '#/convoaie', 'See all convoys'), h('div', { class: 'convoys' }, d.next.slice(0, 1).map((c) => convoyCard(c, false)))));

  if (S.cfg.ranks?.length) {
    const top = S.cfg.ranks[S.cfg.ranks.length - 1].km || 1;
    const R = [...S.cfg.ranks].sort((a, c) => a.km - c.km), tierOf = (n) => String(n).replace(/\s+(?:[IVX]+|\d+)$/, '').trim() || n, T = [];
    for (const r of R) { const t = tierOf(r.name); if (T.length && T[T.length - 1].name === t) T[T.length - 1].levels.push(r); else T.push({ name: t, levels: [r] }); }
    const tiered = T.some((t) => t.levels.length > 1);
    const shown = S.ranksOpen ? R : R.filter((_, i) => i < 9 || i === R.length - 1);
    const grid = tiered
      ? h('div', { class: 'tier-table rv', role: 'table', 'aria-label': 'Ranks' }, T.map((t, i) => h('div', { class: 'tier', role: 'row', style: { '--k': (i / Math.max(1, T.length - 1)).toFixed(3) } },
        h('div', { class: 'tier-name', role: 'rowheader' }, h('span', { class: 'num', text: String(i + 1).padStart(2, '0') }), h('b', { text: t.name })),
        t.levels.map((l) => h('div', { class: 'tier-lvl', role: 'cell' }, h('span', { text: l.name.slice(t.name.length).trim() || l.name }), h('small', { class: 'num', text: l.km ? `${n0(l.km)} km` : 'Start' }))))))
      : h('ol', { class: 'rank-grid rv' }, shown.map((rk) => { const i = R.indexOf(rk); return h('li', { style: { '--k': (i / Math.max(1, R.length - 1)).toFixed(3) } },
        h('span', { class: 'rank-no num', text: String(i + 1).padStart(2, '0') }), h('b', { text: rk.name }), h('span', { class: 'num', text: i ? `${n0(rk.km)} km` : 'Start' })); }));
    out.push(h('section', { class: 'sec' }, head('Every mile counts', `${R.length} ranks, from your first kilometre to ${n0(R[R.length - 1].km)} km. Each one is a role on Discord, given automatically.`), grid,
      !tiered && R.length > 10 ? h('button', { class: 'du-text-link rank-more', type: 'button', onclick: () => { S.ranksOpen = !S.ranksOpen; render(); } }, S.ranksOpen ? 'Show fewer' : `Show all ${R.length} ranks`) : null));
  }

  out.push(h('section', { class: 'sec' }, head('Your journey starts here', 'Four steps from a first hello to your first convoy.'),
    h('ol', { class: 'steps' }, STEPS.map(([t, x], i) => h('li', { class: 'step rv', style: { '--i': i } }, h('span', { class: 'no', text: String(i + 1).padStart(2, '0') }), h('h3', { text: t }), h('p', { text: x }))))));

  out.push(h('section', { class: 'sec reqs' },
    h('div', { class: 'rv' }, h('span', { class: 'eyebrow', text: 'What we ask' }), h('h2', { text: 'Not much, but we mean it.' }),
      h('ul', { class: 'checks' }, (S.cfg.requirements || []).map((x) => h('li', null, h('span', { class: 'ck' }, icon('check', 16)), x)))),
    h('div', { class: 'join rv' }, medallion(false), h('h3', { text: S.cfg.recruitOpen ? 'Ready to roll?' : 'Recruitment is closed' }),
      h('p', { text: S.cfg.recruitOpen ? 'Fill in the form and we will see you at the next convoy.' : 'Follow us on Discord: we announce it there when we reopen.' }),
      S.member ? h('a', { class: 'btn', href: '#/soferi' }, 'See the drivers') : S.cfg.recruitOpen ? h('a', { class: 'btn', href: '#/aplica' }, 'Apply now', icon('arrow', 18)) : S.cfg.discordInvite ? h('a', { class: 'btn', href: S.cfg.discordInvite, target: '_blank', rel: 'noopener' }, 'Join our Discord') : null)));

  if (d.partners?.length) out.push(h('section', { class: 'sec' }, head('Driving partners', 'The companies we share the road with.', '#/partners', 'All partners'), partnerRow(d.partners)));

  out.push(h('section', { class: 'sec' }, head('Good to know'), h('div', { class: 'faq' }, FAQ.map(([q, a]) => h('details', { class: 'rv' }, h('summary', null, q, icon('chev', 18)), h('p', { text: a }))))));
  return out;
}

const partnerRow = (list) => h('div', { class: 'v-partners' }, list.map((p) => h(p.url || p.tmp ? 'a' : 'div', { class: 'v-partner', href: p.url || p.tmp || null, target: p.url || p.tmp ? '_blank' : null, rel: 'noopener' },
  p.logo ? h('img', { src: p.logo, alt: '', loading: 'lazy' }) : h('span', { class: 'v-initial', text: p.name[0] }), h('span', { text: p.name }))));
async function pagePartners() {
  const r = await api('/api/partners'), list = r.ok ? r.data.partners : [];
  return [h('div', { class: 'pagehead' }, h('h1', { text: 'Partners' }), h('p', { text: 'Virtual trucking companies we drive with and join for convoys.' })),
    list.length ? h('div', { class: 'v-plist sec' }, list.map((p) => h('article', { class: 'panel v-pcard' }, p.logo ? h('img', { src: p.logo, alt: '' }) : h('span', { class: 'v-initial', text: p.name[0] }),
      h('div', null, h('h2', { text: p.name }), p.desc ? md(p.desc, 'muted') : null,
        h('div', { class: 'v-links' }, p.url ? h('a', { href: p.url, target: '_blank', rel: 'noopener' }, 'Website', icon('out', 14)) : null, p.tmp ? h('a', { href: p.tmp, target: '_blank', rel: 'noopener' }, 'TruckersMP', icon('out', 14)) : null))))) : h('div', { class: 'sec' }, empty('No partners yet', 'Partner companies will be listed here.'))];
}
// private pages: only drivers of the VTC (linked to Trucky, with the member role, or staff)
function gate(title) {
  const head_ = h('div', { class: 'pagehead' }, h('h1', { text: title }));
  let body;
  if (!S.user) body = empty('Drivers only', 'Log in with Discord. If you drive for Diesel Union, you will see everything.', loginBtn());
  else body = empty('Drivers only', 'Your Discord account is not linked to a Trucky driver.', h('div', { class: 'actions', style: { justifyContent: 'center' } }, h('a', { class: 'btn', href: '#/cont' }, icon('link', 18), 'Link your account'), S.cfg.recruitOpen ? h('a', { class: 'btn ghost', href: '#/aplica' }, 'Apply to join') : null));
  return [head_, h('div', { class: 'sec locked' }, h('span', { class: 'lockico' }, icon('lock', 28)), body)];
}

function podium(rows, metric) {
  const fmt = (r) => (metric === 'km' ? kmS(r.v) : metric === 'jobs' ? plural(r.v, 'job', 'jobs') : n0(r.v));
  return h('div', { class: 'podium' }, rows.slice(0, 3).map((r, i) => h('button', { class: `place p${i + 1}`, type: 'button', onclick: () => openDriver(r.id) },
    av(r.avatar, r.name), h('span', { class: 'nm', text: r.name }), h('span', { class: 'val num', text: fmt(r) }), h('span', { class: 'rk' }, chevrons(r.rank), ' ', r.rank?.name || ''), h('span', { class: 'plinth', text: i + 1 }))));
}

async function pageDrivers() {
  if (!S.member) return gate('Drivers');
  const r = await api('/api/drivers'), list = r.ok ? r.data.drivers : [];
  const grid = h('div', { class: 'drivers' });
  const q = h('input', { class: 'field', type: 'search', placeholder: 'Search drivers', 'aria-label': 'Search drivers' });
  let sort = 'km';
  const paint = () => {
    const t = q.value.trim().toLowerCase();
    const rows = list.filter((d) => !t || d.name.toLowerCase().includes(t)).sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) : sort === 'joined' ? (a.joined || 0) - (b.joined || 0) : b[sort] - a[sort]));
    grid.replaceChildren(...rows.map((d) => {
      const next = d.rank.next, k = next ? (d.km - d.rank.from) / (next.km - d.rank.from) : 1;
      return h('button', { class: 'driver rv', type: 'button', onclick: () => openDriver(d.id) },
        av(d.avatar, d.name), h('div', null, h('b', { text: d.name }), h('span', { class: 'rk' }, chevrons(d.rank), d.rank.name, d.role ? ` · ${d.role}` : '')),
        h('div', { class: 'kms' }, h('span', null, h('b', { class: 'num', text: n0(d.km) }), ' km'), h('span', { text: d.monthKm ? `+${n0(d.monthKm)} this month` : d.joined ? `since ${new Date(d.joined).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}` : '' })),
        h('span', { class: 'prog', title: next ? `${kmS(next.km - d.km)} to ${next.name}` : 'Top rank' }, h('i', { style: { width: `${Math.round(Math.min(1, Math.max(0.02, k)) * 100)}%` } })));
    }));
    if (!rows.length) grid.replaceChildren(empty(list.length ? 'No driver by that name' : 'No drivers yet', list.length ? 'Try another name.' : 'The list fills itself from Trucky.'));
    reveal(grid);
  };
  q.addEventListener('input', paint);
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Sort' }, [['km', 'Kilometres'], ['monthKm', 'This month'], ['joined', 'Seniority'], ['name', 'Name']].map(([k, l]) => h('button', { type: 'button', 'aria-pressed': String(sort === k), onclick: (e) => { sort = k; for (const b of e.currentTarget.parentNode.children) b.setAttribute('aria-pressed', String(b === e.currentTarget)); paint(); } }, l)));
  paint();
  return [h('div', { class: 'pagehead' }, h('h1', { text: 'Drivers' }), h('p', { text: `${plural(list.length, 'driver', 'drivers')} at ${S.cfg.name}. Your rank grows with every kilometre delivered with Trucky.` })),
    h('div', { class: 'toolbar' }, q, seg), grid,
    h('section', { class: 'sec' }, head('Ranks', 'You move up automatically with your total kilometres.'), h('div', { class: 'ranks' }, S.cfg.ranks.map((rk, i) => h('div', { class: 'rrow', style: { cursor: 'default', gridTemplateColumns: '40px minmax(0,1fr) auto' } }, h('span', { class: 'pos' }, chevrons({ index: i })), h('span', { class: 'nm', text: rk.name }), h('span', { class: 'v num', text: i ? `${n0(rk.km)} km` : 'start' })))))];
}

async function openDriver(id) {
  const dr = $('#drawer');
  dr.replaceChildren(h('div', { class: 'in' }, skel(3, 90))); dr.hidden = false; $('#scrim').hidden = false; document.body.classList.add('lock');
  if (location.hash !== `#/soferi/${id}`) history.replaceState(null, '', `#/soferi/${id}`);
  const r = await api(`/api/driver?id=${encodeURIComponent(id)}`);
  if (dr.hidden) return;
  if (!r.ok) { dr.replaceChildren(h('button', { class: 'x', type: 'button', 'aria-label': 'Close', onclick: closeDrawer }, icon('x', 18)), h('div', { class: 'in' }, empty('Driver not found', 'They may have left the company.'))); return; }
  const p = r.data, next = p.rank.next, k = next ? (p.km - p.rank.from) / (next.km - p.rank.from) : 1;
  const max = Math.max(1, ...p.months.map((m) => m.km)), W = 460, H = 150, bw = W / p.months.length;
  const chart = svg('svg', { class: 'chart', viewBox: `0 0 ${W} ${H + 24}`, role: 'img', 'aria-label': 'Kilometres over the last six months' },
    p.months.map((m, i) => { const hh = Math.max(2, (m.km / max) * H); return [svg('rect', { x: i * bw + 10, y: H - hh, width: bw - 20, height: hh, rx: 5, fill: i === p.months.length - 1 ? '#f2a03d' : '#8a5a2b', style: { '--i': i } }), svg('text', { x: i * bw + bw / 2, y: H + 18, 'text-anchor': 'middle', text: m.label }), m.km ? svg('text', { x: i * bw + bw / 2, y: H - hh - 6, 'text-anchor': 'middle', text: n0(m.km) }) : null]; }));
  dr.replaceChildren(
    h('button', { class: 'x', type: 'button', 'aria-label': 'Close', onclick: closeDrawer }, icon('x', 18)),
    h('div', { class: 'in' },
      h('div', { class: 'prof' }, av(p.avatar, p.name), h('div', null, h('h2', { text: p.name }), h('div', { class: 'rk' }, chevrons(p.rank), p.rank.name, p.role ? h('span', { class: 'muted', text: `· ${p.role}` }) : null))),
      h('p', { class: 'muted small', text: [p.joined ? `Driving for us since ${dateL(p.joined)}` : null, p.last ? `last job ${ago(p.last)}` : null].filter(Boolean).join(', ') }),
      h('div', { class: 'tiles' },
        h('div', { class: 'tile' }, h('b', { class: 'num', text: n0(p.km) }), h('span', { text: 'km in total' })),
        h('div', { class: 'tile' }, h('b', { class: 'num', text: n0(p.jobs) }), h('span', { text: 'jobs delivered' })),
        h('div', { class: 'tile' }, h('b', { class: 'num', text: n0(p.month?.km || 0) }), h('span', { text: 'km this month' })),
        h('div', { class: 'tile' }, h('b', { class: 'num', text: `${p.avgDmg}%` }), h('span', { text: 'average damage' })),
        h('div', { class: 'tile' }, h('b', { class: 'num', text: p.longest ? n0(p.longest.km) : '0' }), h('span', { text: 'longest job (km)' })),
        h('div', { class: 'tile' }, h('b', { class: 'num', text: n0(p.convoys || 0) }), h('span', { text: 'convoys driven' })),
        p.dotm ? h('div', { class: 'tile' }, h('b', { class: 'num', text: `🏆 ${p.dotm}` }), h('span', { text: 'Driver of the Month' })) : null),
      h('div', { class: 'next' }, next ? [h('b', { text: `${kmS(next.km - p.km)} to ${next.name}` }), h('span', { class: 'prog' }, h('i', { style: { width: `${Math.round(Math.max(0.02, k) * 100)}%` } }))] : h('b', { text: 'Reached the top rank.' })),
      h('h3', { text: 'Last six months' }), chart,
      p.fav ? h('p', { class: 'muted small', text: `Delivers most often to ${p.fav}.` }) : null,
      h('h3', { text: 'Recent jobs' }),
      p.recent.length ? h('div', { class: 'mini' }, p.recent.map((j) => h('div', { class: 'bill' }, h('div', { class: 'way' }, h('div', { class: 'r' }, h('span', { text: j.from }), icon('arrow', 14), h('span', { text: j.to })), h('div', { class: 'c', text: `${j.cargo} · ${ago(j.end)}` })), h('div', { class: 'k num' }, n0(j.km), h('small', { text: 'km' }))))) : h('p', { class: 'muted', text: 'No jobs yet.' })));
}
function closeDrawer() { $('#drawer').hidden = true; $('#scrim').hidden = true; document.body.classList.remove('lock'); if (/^#\/soferi\/./.test(location.hash)) history.replaceState(null, '', '#/soferi'); }

async function pageJobs() {
  if (!S.member) return gate('Jobs');
  const F = { period: 'month', game: '', q: '', page: 0 };
  const list = h('div', { class: 'bills' }), summary = h('p', { class: 'muted' }), more = h('button', { class: 'btn ghost', type: 'button', hidden: true, onclick: () => load(false) }, 'More jobs');
  let tok = 0;
  async function load(reset) {
    if (reset) { F.page = 0; list.replaceChildren(...skel(5, 64)); }
    const my = ++tok, p = new URLSearchParams({ period: F.period, page: F.page }); if (F.game) p.set('game', F.game); if (F.q) p.set('q', F.q);
    const r = await api(`/api/jobs?${p}`); if (my !== tok) return;
    if (reset) list.replaceChildren();
    const d = r.ok ? r.data : { jobs: [], total: 0, km: 0, pages: 0 };
    list.append(...d.jobs.map(bill)); reveal(list);
    summary.textContent = d.total ? `${plural(d.total, 'job', 'jobs')}, ${kmS(d.km)} in total.` : '';
    if (!d.total) list.replaceChildren(empty('No jobs', 'No delivered jobs match these filters.'));
    F.page++; more.hidden = F.page >= d.pages;
  }
  const seg = (key, opts) => h('div', { class: 'seg', role: 'group' }, opts.map(([v, l]) => h('button', { type: 'button', 'aria-pressed': String(F[key] === v), onclick: (e) => { F[key] = v; for (const b of e.currentTarget.parentNode.children) b.setAttribute('aria-pressed', String(b === e.currentTarget)); load(true); } }, l)));
  let t; const q = h('input', { class: 'field', type: 'search', placeholder: 'City, cargo or driver', 'aria-label': 'Search jobs', oninput: () => { clearTimeout(t); t = setTimeout(() => { F.q = q.value.trim(); load(true); }, 300); } });
  load(true);
  return [h('div', { class: 'pagehead' }, h('h1', { text: 'Jobs' }), h('p', { text: 'Every delivery the company made, straight from Trucky.' })),
    h('div', { class: 'toolbar' }, q, seg('period', [['week', 'This week'], ['month', 'This month'], ['all', 'All time']])),
    summary, list, h('p', { style: { textAlign: 'center', marginTop: '18px' } }, more)];
}

async function pageBoard() {
  if (!S.member) return gate('Leaderboard');
  const F = { period: 'month', metric: 'km' };
  const body = h('div');
  async function load() {
    body.replaceChildren(...skel(2, 160));
    const r = await api(`/api/board?period=${F.period}&metric=${F.metric}`), rows = r.ok ? r.data.rows : [];
    if (!rows.length) return body.replaceChildren(h('div', { class: 'sec' }, empty('No jobs yet', 'The leaderboard fills up with the first delivery of this period.')));
    const max = rows[0].v, fmt = (v) => (F.metric === 'km' ? kmS(v) : F.metric === 'jobs' ? n0(v) : n0(v));
    body.replaceChildren(h('div', { class: 'sec anim' }, podium(rows, F.metric)),
      h('div', { class: 'ranks' }, rows.slice(3).map((r, i) => h('button', { class: 'rrow rv', type: 'button', onclick: () => openDriver(r.id) },
        h('span', { class: 'pos num', text: i + 4 }), av(r.avatar, r.name), h('span', { class: 'nm' }, r.name, h('small', { text: `${r.rank?.name || ''} · ${plural(r.jobsP, 'job', 'jobs')}` })),
        h('span', { class: 'bar' }, h('i', { style: { width: `${Math.max(2, (r.v / max) * 100)}%` } })), h('span', { class: 'v num', text: fmt(r.v) })))));
    reveal(body);
  }
  const seg = (key, opts) => h('div', { class: 'seg', role: 'group' }, opts.map(([v, l]) => h('button', { type: 'button', 'aria-pressed': String(F[key] === v), onclick: (e) => { F[key] = v; for (const b of e.currentTarget.parentNode.children) b.setAttribute('aria-pressed', String(b === e.currentTarget)); load(); } }, l)));
  load();
  return [h('div', { class: 'pagehead' }, h('h1', { text: 'Leaderboard' }), h('p', { text: 'Weeks start on Monday and months on the 1st, Romanian time.' })),
    h('div', { class: 'toolbar' }, seg('period', [['week', 'This week'], ['month', 'This month'], ['all', 'All time']]), seg('metric', [['km', 'Kilometres'], ['income', 'Income'], ['jobs', 'Jobs']])), body];
}

async function pageConvoys() {
  const r = await api('/api/convoys'), d = r.ok ? r.data : { convoys: [], tmp: [] };
  const up = d.convoys.filter((c) => c.start > Date.now() - 3 * 3600_000), past = d.convoys.filter((c) => c.start <= Date.now() - 3 * 3600_000).reverse().slice(0, 6);
  const out = [h('div', { class: 'pagehead' }, h('h1', { text: 'Convoys' }), h('p', { text: 'We hit the road together. RSVP and the bot reminds you on Discord an hour before.' }))];
  if (S.caps.events) out.push(h('p', { class: 'actions' }, h('a', { class: 'btn', href: '#/panel' }, icon('flag', 18), 'Plan a convoy')));
  out.push(h('section', { class: 'sec' }, head('Upcoming'), up.length ? h('div', { class: 'convoys' }, up.map((c) => convoyCard(c, true))) : empty('No convoys planned', S.caps.events ? 'Plan one in the Discord panel.' : 'Staff announce the next convoy here and on Discord.')));
  if (d.tmp.length) out.push(h('section', { class: 'sec' }, head('On TruckersMP', 'Events the company hosts or attends.'), h('div', { class: 'convoys' }, d.tmp.map((c) => convoyCard(c, false)))));
  if (past.length) out.push(h('section', { class: 'sec' }, head('Past convoys'), h('div', { class: 'convoys' }, past.map((c) => convoyCard(c, false)))));
  return out;
}
// ---- team panel: post on Discord (CEO, Co-CEO, Media Manager) and plan convoys (Event Team) ----
const PING_LABEL = { none: 'No ping', 'members-hidden': '@everyone' };
const pingPicker = (list, cur, id) => h('select', { class: 'field', id }, list.map((p) => h('option', { value: p, selected: p === (cur || 'none') }, PING_LABEL[p])));
function pingPreview(kind) {
  if (!kind || kind === 'none') return null;
  return h('div', null, h('span', { class: 'spoiler', title: 'Pings every driver. It sits under a spoiler, so the chat only shows a grey bar.', text: '@Union Member' }));
}
// big photos are shrunk in the browser before upload (GIFs go as they are, to keep the animation)
function shrink(file) {
  return new Promise((ok, bad) => {
    const rd = new FileReader();
    rd.onerror = () => bad(new Error('Could not read the file.'));
    rd.onload = () => {
      if (file.type === 'image/gif') return ok(rd.result);
      const im = new Image();
      im.onerror = () => bad(new Error('That file is not a picture.'));
      im.onload = () => {
        const k = Math.min(1, 1920 / Math.max(im.width, im.height));
        if (k === 1 && file.size < 2_500_000) return ok(rd.result);
        const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        const out = c.toDataURL('image/webp', 0.86);
        ok(out.startsWith('data:image/webp') ? out : c.toDataURL('image/jpeg', 0.88));
      };
      im.src = rd.result;
    };
    rd.readAsDataURL(file);
  });
}
function imagePicker(cur, id, onchange) {
  let value = cur || '';
  const prev = h('div', { class: 'pick-prev' });
  const url = h('input', { class: 'field', type: 'url', 'aria-label': 'Picture link', placeholder: 'or paste a picture link (https://…)', value: value && !value.startsWith('/u/') ? value : '', oninput: () => { value = url.value.trim(); show(); } });
  const file = h('input', { type: 'file', class: 'sr', id, accept: 'image/png,image/jpeg,image/webp,image/gif', tabindex: '-1' });
  const btn = h('button', { class: 'btn ghost small', type: 'button', onclick: () => file.click() }, icon('img', 18), 'Upload a picture');
  file.addEventListener('change', async () => {
    const f = file.files[0]; if (!f) return;
    btn.disabled = true; btn.lastChild.textContent = 'Uploading…';
    try { const r = await api('/api/upload', { data: await shrink(f) }); if (r.ok) { value = r.data.url; url.value = ''; show(); toast('Picture uploaded.'); } else toast(r.data.msg || r.data.error, true); }
    catch (err) { toast(err.message, true); }
    btn.disabled = false; btn.lastChild.textContent = 'Upload a picture'; file.value = '';
  });
  function show(first) {
    prev.replaceChildren(...[value ? h('img', { src: value, alt: 'Chosen picture' }) : h('span', { class: 'muted small', text: 'No picture yet.' }),
      value ? h('button', { class: 'btn ghost small', type: 'button', onclick: () => { value = ''; url.value = ''; show(); } }, 'Remove') : null].filter(Boolean));
    if (onchange && !first) onchange(value);
  }
  show(true);
  return { el: h('div', { class: 'picker' }, h('div', { class: 'pick-row' }, file, btn, url), prev), get value() { return value; } };
}
const field_ = (el, label) => h('div', null, h('label', { class: 'lab', for: el.id, text: label }), el);
function chanPicker(chans, id) {
  const g = new Map(); for (const x of chans) { if (!g.has(x.group)) g.set(x.group, []); g.get(x.group).push(x); }
  return h('select', { class: 'field', id }, [...g].map(([n, xs]) => { const o = xs.map((x) => h('option', { value: x.id }, `# ${x.name}`)); return n ? h('optgroup', { label: n }, o) : o; }));
}

function composer(d) {
  if (!d.channels.length) return empty('No channels', 'The bot cannot post anywhere yet. Run /setup on Discord.');
  const ch = chanPicker(d.channels, 'po-ch');
  const title = h('input', { class: 'field', id: 'po-t', maxlength: 250, placeholder: 'Optional' });
  const text = h('textarea', { class: 'field', id: 'po-x', maxlength: 4000, rows: 7, placeholder: 'Discord formatting works: **bold**, *italic*, > quote, - list' });
  const color = h('input', { type: 'color', id: 'po-c', value: '#8a5a2b', class: 'swatch' });
  const link = h('input', { class: 'field', id: 'po-l', type: 'url', placeholder: 'https://…' }), linkLabel = h('input', { class: 'field', id: 'po-ll', maxlength: 80, placeholder: 'Open link' });
  const ping = pingPicker(d.pings, 'none', 'po-p'), plain = h('input', { type: 'checkbox' });
  const later = h('input', { type: 'checkbox' }), when = h('input', { class: 'field', id: 'po-at', type: 'datetime-local', hidden: true });
  later.addEventListener('change', () => { when.hidden = !later.checked; sendBtn.lastChild.textContent = later.checked ? 'Schedule post' : 'Post on Discord'; });
  const pv = h('div', { class: 'dc-prev', 'aria-label': 'Preview' });
  const img = imagePicker('', 'po-img', () => draw());
  function draw() {
    const box = plain.checked
      ? h('div', null, title.value ? h('b', { class: 'dc-plain-t', text: title.value }) : null, md(text.value, 'dc-text'), img.value ? h('img', { class: 'dc-img', src: img.value, alt: '' }) : null)
      : (title.value || text.value || img.value) ? h('div', { class: 'dc-embed', style: { '--c': color.value } }, title.value ? h('b', { text: title.value }) : null, text.value ? md(text.value) : null, img.value ? h('img', { src: img.value, alt: '' }) : null, h('small', { text: S.cfg.name })) : h('p', { class: 'muted small', text: 'Your post shows up here.' });
    pv.replaceChildren(h('div', { class: 'dc-who' }, h('img', { src: '/img/logo-160.webp', alt: '' }), h('span', { text: S.cfg.name }), h('i', { text: 'BOT' })), h('div', { class: 'dc-body' }, pingPreview(ping.value), box, /^https?:\/\//.test(link.value) ? h('span', { class: 'dc-btn', text: linkLabel.value || 'Open link' }) : null));
  }
  for (const el of [title, text, color, link, linkLabel, ping, plain]) el.addEventListener('input', draw);
  plain.addEventListener('change', draw);
  draw();
  const send_ = (e) => { const b = e.currentTarget; b.disabled = true; act('/api/post', { channel: ch.value, title: title.value, text: text.value, color: color.value, image: img.value, link: link.value, linkLabel: linkLabel.value, ping: ping.value, plain: plain.checked, at: later.checked && when.value ? new Date(when.value).getTime() : undefined }, () => { S.panelTab = 'history'; render(); }).finally(() => { b.disabled = false; }); };
  const sendBtn = h('button', { class: 'btn', type: 'button', onclick: send_ }, icon('send', 18), 'Post on Discord');
  return h('section', { class: 'composer sec' },
    h('div', { class: 'panel card' },
      h('div', { class: 'two' }, field_(ch, 'Channel'), h('div', null, field_(ping, 'Ping'), h('p', { class: 'muted small hint', text: '@everyone pings every driver, hidden under a grey spoiler.' }))),
      field_(title, 'Title'), field_(text, 'Message'),
      h('p', { class: 'lab', text: 'Picture' }), img.el,
      h('div', { class: 'two', style: { marginTop: '14px' } }, field_(link, 'Button link, optional'), field_(linkLabel, 'Button text')),
      h('div', { class: 'pick-row', style: { marginTop: '6px' } }, h('label', { class: 'lab', for: 'po-c', text: 'Colour', style: { margin: 0 } }), color, h('label', { class: 'check', style: { margin: 0 } }, plain, 'Plain message, without the box')),
      h('div', { class: 'pick-row', style: { marginTop: '10px' } }, h('label', { class: 'check', style: { margin: 0 } }, later, 'Post later'), when),
      h('div', { class: 'actions' }, sendBtn)),
    h('div', null, h('p', { class: 'lab', text: 'Preview' }), pv));
}

const dtLocal = (ms) => { const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60000); return d.toISOString().slice(0, 16); };
function planner(d) {
  const c = d.convoys.find((x) => x.id === S.editConvoy) || null, f = {};
  const inp = (k, label, attrs = {}) => { f[k] = h(attrs.tag || 'input', { class: 'field', id: `pl-${k}`, ...attrs, tag: undefined }); if (c && c[k] !== undefined && k !== 'start') f[k].value = c[k]; return field_(f[k], label); };
  const form = [
    h('div', { class: 'two' }, inp('title', 'Title', { maxlength: 80, placeholder: 'Friday night convoy' }), inp('start', 'Date and time', { type: 'datetime-local' }), inp('server', 'Server', { maxlength: 40, placeholder: 'Simulation 1' })),
    h('div', { class: 'two' }, inp('from', 'Departure', { maxlength: 60, placeholder: 'Calais, Euroacres' }), inp('to', 'Destination', { maxlength: 60, placeholder: 'Duisburg, Posped' }), inp('meet', 'Meeting point', { maxlength: 80 }), inp('dlc', 'Required DLC', { maxlength: 120, placeholder: 'None' })),
    inp('desc', 'Details', { tag: 'textarea', maxlength: 1500, rows: 5 })];
  if (c) f.start.value = dtLocal(c.start);
  const img = imagePicker(c?.image || '', 'pl-img');
  const link = h('input', { class: 'field', id: 'pl-link', type: 'url', placeholder: 'https://truckersmp.com/events/…', value: c?.link || '' });
  const ping = pingPicker(d.pings, c?.ping || 'none', 'pl-ping');
  const body = (draft, announce) => ({ id: c?.id, title: f.title.value, start: f.start.value ? new Date(f.start.value).getTime() : 0, server: f.server.value, from: f.from.value, to: f.to.value, meet: f.meet.value, dlc: f.dlc.value, desc: f.desc.value, image: img.value, link: link.value, ping: ping.value, draft, announce });
  const done = () => { S.editConvoy = null; render(); };
  const btns = c && c.posted
    ? [h('button', { class: 'btn', type: 'button', onclick: () => act('/api/convoys', body(false, true), done) }, icon('send', 18), 'Save and update the Discord post')]
    : [h('button', { class: 'btn', type: 'button', onclick: () => act('/api/convoys', body(false, true), done) }, icon('send', 18), 'Publish and announce'),
      h('button', { class: 'btn ghost', type: 'button', onclick: () => act('/api/convoys', body(true, false), done) }, 'Save as draft')];
  if (c) btns.push(h('button', { class: 'btn ghost', type: 'button', onclick: () => { S.editConvoy = null; render(); } }, 'Cancel'));
  return h('section', { class: 'panel card sec', id: 'planner' }, h('h2', { text: c ? `Edit: ${c.title}` : 'Plan a convoy' }),
    h('p', { class: 'muted', text: 'Drafts are only visible to the team. Publishing puts it on the website and in the convoys channel.' }),
    form, h('p', { class: 'lab', text: 'Banner picture' }), img.el,
    h('div', { class: 'two', style: { marginTop: '14px' } }, field_(link, 'Event link, optional (TruckersMP event page)'), field_(ping, 'Ping when it is announced')),
    h('div', { class: 'actions' }, btns));
}
function convoyRows(d) {
  const list = d.convoys.filter((c) => c.start > Date.now() - 7 * 864e5 || c.draft);
  if (!list.length) return empty('Nothing planned', 'Plan the next convoy with the form above.');
  return h('div', { class: 'plist' }, list.map((c) => h('div', { class: 'prow panel' },
    c.image ? h('img', { class: 'thumb', src: c.image, alt: '' }) : null,
    h('div', { class: 'grow' }, h('b', { text: c.title }), h('span', { class: 'muted small', text: `${dateL(c.start)} ${timeL(c.start)}${c.from || c.to ? ` · ${c.from || '?'} → ${c.to || '?'}` : ''}${c.yes ? ` · ${c.yes.length} going` : ''}${c.slots?.lead?.length ? ` · lead ${c.slots.lead[0]}` : ''}` })),
    h('span', { class: `pill ${c.draft ? 'pending' : 'accepted'}`, text: c.draft ? 'Draft' : c.posted ? 'On Discord' : 'Published' }),
    h('button', { class: 'btn ghost small', type: 'button', onclick: () => { S.editConvoy = c.id; render().then(() => $('#planner')?.scrollIntoView({ behavior: 'smooth' })); } }, 'Edit'),
    c.draft ? h('button', { class: 'btn small', type: 'button', onclick: () => act('/api/convoys/publish', { id: c.id, ping: c.ping }, render) }, 'Publish') : null,
    !c.draft && c.start < Date.now() + 3600_000 ? h('button', { class: 'btn ghost small', type: 'button', onclick: () => attendanceBox(c) }, c.attended ? `Attendance (${c.attended})` : 'Mark attendance') : null,
    h('button', { class: 'btn danger small', type: 'button', onclick: () => { if (confirm(`Delete "${c.title}"? The Discord post goes too.`)) act('/api/convoys/remove', { id: c.id }, render); } }, 'Delete'))));
}
function postHistory(d) {
  if (!d.posts.length) return empty('Nothing posted yet', 'What you post from here shows up in this list, so you can delete it later.');
  return h('div', { class: 'plist sec' }, d.posts.map((p) => h('div', { class: 'prow panel' },
    p.image ? h('img', { class: 'thumb', src: p.image, alt: '' }) : null,
    h('div', { class: 'grow' }, h('b', { text: p.title || '(picture)' }), h('span', { class: 'muted small', text: `#${p.channel} · ${p.by.name} · ${ago(p.at)}${p.ping && p.ping !== 'none' ? ' · @everyone' : ''}` })),
    h('button', { class: 'btn danger small', type: 'button', onclick: () => { if (confirm('Delete this post from Discord?')) act('/api/post/delete', { id: p.id }, render); } }, 'Delete'))));
}
const TEAM_NAME = { ceo: 'CEO', coceo: 'Co-CEO', management: 'Management', hr: 'HR Team', events: 'Event Team', media: 'Media Manager', staff: 'Staff' };
const yesNo = (v, t) => h('span', { class: `tick ${v === true ? 'ok' : v === false ? 'no' : 'na'}`, title: v === null ? `${t}: cannot check` : t, text: `${v === true ? '✓' : v === false ? '✗' : '–'} ${t}` });
const stat = (n, l, href) => h(href ? 'a' : 'div', { class: 'kpi panel', href }, h('b', { class: 'num', text: n0(n) }), h('span', { text: l }));
async function tabOverview() {
  const r = await api('/api/panel/overview'); if (!r.ok) return [empty('Could not load', r.data.error || 'Try again.')];
  const d = r.data;
  return [h('div', { class: 'kpis sec' }, stat(d.pending, 'applications waiting', '#/staff'), stat(d.onboarding.length, 'finishing setup'), stat(d.drivers, 'linked drivers'), stat(d.inactive.filter((x) => !x.loa).length, 'inactive 30+ days'), stat(d.loa.length, 'on leave'), stat(d.upcoming, 'convoys coming up'), stat(d.scheduled, 'scheduled posts')),
    h('div', { class: 'cols2 sec' },
      h('section', { class: 'panel card' }, h('h2', { text: 'Finishing setup' }), h('p', { class: 'muted', text: 'Accepted, but not in yet. What each one still has to do.' }),
        d.onboarding.length ? h('div', { class: 'plist' }, d.onboarding.map((o) => h('div', { class: 'prow line' }, h('div', { class: 'grow' }, h('b', { text: o.name }), h('span', { class: 'ticks' }, yesNo(o.trucky, 'Trucky'), yesNo(o.tmp, 'TruckersMP'), yesNo(o.web, 'Website'))),
          h('button', { class: 'btn ghost small', type: 'button', onclick: () => act('/api/admin/grant', { uid: o.uid }, render) }, 'Give access now')))) : h('p', { class: 'muted', text: 'Nobody is waiting.' })),
      h('section', { class: 'panel card' }, h('h2', { text: 'Driver of the Month' }),
        d.dotm ? h('p', { class: 'big-name' }, h('b', { text: d.dotm.name }), h('span', { class: 'muted', text: `${d.dotm.month} · ${kmS(d.dotm.km)}` })) : h('p', { class: 'muted', text: 'Picked automatically on the 1st of each month.' }),
        d.lastMonth.top.length ? [h('p', { class: 'lab', text: `Top of ${d.lastMonth.label}` }), h('ol', { class: 'topmini' }, d.lastMonth.top.map((t) => h('li', null, h('span', { text: t.name }), h('span', { class: 'num muted', text: kmS(t.km) }))))] : null)),
    h('div', { class: 'cols2 sec' },
      h('section', { class: 'panel card' }, h('h2', { text: 'Inactive drivers' }), h('p', { class: 'muted', text: 'No delivery for 30 days or more. The bot sends them one friendly DM a month.' }),
        d.inactive.length ? h('div', { class: 'plist' }, d.inactive.map((x) => h('div', { class: 'prow line' }, h('div', { class: 'grow' }, h('b', { text: x.name }), h('span', { class: 'muted small', text: `${x.days} days${x.lastJob ? `, last job ${dateL(x.lastJob)}` : ', no jobs yet'}${x.loa ? ' · on leave' : ''}${x.warned ? ` · messaged ${ago(x.warned)}` : ''}` })),
          x.loa ? null : h('button', { class: 'btn ghost small', type: 'button', onclick: () => act('/api/admin/warn', { uid: x.uid }, render) }, 'Send a reminder')))) : h('p', { class: 'muted', text: 'Everyone is driving. 🤎' })),
      h('section', { class: 'panel card' }, h('h2', { text: 'On leave' }), h('p', { class: 'muted', text: 'Set by the drivers themselves with /loa on Discord.' }),
        d.loa.length ? h('div', { class: 'plist' }, d.loa.map((l) => h('div', { class: 'prow line' }, h('div', { class: 'grow' }, h('b', { text: l.name }), h('span', { class: 'muted small', text: `until ${dateL(l.until)}${l.reason ? ` · ${l.reason}` : ''}` }))))) : h('p', { class: 'muted', text: 'Nobody is on leave.' }))),
    h('p', { class: 'muted small sec', text: `Trucky: jobs read ${ago(d.sync.jobs) || 'never'}, members read ${ago(d.sync.members) || 'never'}, last webhook ${ago(d.sync.hook) || 'never'}.` })];
}
// Trucky drivers with no Discord account yet: staff link them here (or with /linkdriver on Discord)
function unlinkedBox(list) {
  if (!list?.length) return null;
  return h('section', { class: 'sec' }, head('In the company on Trucky, not linked', 'Type their Discord name or user ID and press Link. Drivers can also do it themselves with /link on Discord.'),
    h('div', { class: 'plist' }, list.map((m) => {
      const who = h('input', { class: 'field', placeholder: 'Discord name or user ID', 'aria-label': `Discord account for ${m.name}` });
      const go = () => act('/api/admin/link', { who: who.value, driver: m.driver }, render);
      who.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
      return h('div', { class: 'prow panel' }, av(m.avatar, m.name), h('div', { class: 'grow' }, h('b', { text: m.name }), h('span', { class: 'muted small', text: `${n0(m.km)} km · Trucky #${m.driver}` })),
        h('div', { class: 'linkrow' }, who, h('button', { class: 'btn small', type: 'button', onclick: go }, 'Link')));
    })));
}
async function tabDrivers() {
  const r = await api('/api/panel/drivers'); if (!r.ok) return [empty('Could not load', r.data.error || 'Try again.')];
  const rows = r.data.rows;
  if (!rows.length) return [h('div', { class: 'sec' }, empty('No linked drivers yet', 'Drivers show up here once their Discord is linked to Trucky. Link them below, or they can use /link on Discord.')), unlinkedBox(r.data.unlinked)];
  const q = h('input', { class: 'field', type: 'search', placeholder: 'Search a driver', 'aria-label': 'Search a driver' });
  const status = { member: ['Has access', 'accepted'], guest: ['No access', 'pending'], gone: ['Not on Discord', 'rejected'] };
  const list = h('div', { class: 'dtable' }, h('div', { class: 'dhead' }, h('span', { text: 'Driver' }), h('span', { text: 'Rank' }), h('span', { text: 'Kilometres' }), h('span', { text: 'Last job' }), h('span', { text: 'Convoys' }), h('span', { text: 'Discord' }), h('span')),
    rows.map((x) => h('div', { class: 'drow', 'data-n': x.name.toLowerCase() },
      h('span', { class: 'who2' }, av(x.avatar, x.name), h('a', { href: `#/soferi/${x.driver}`, text: x.name }), x.dotm ? h('span', { class: 'crown', title: `Driver of the Month × ${x.dotm}`, text: `🏆${x.dotm > 1 ? x.dotm : ''}` }) : null),
      h('span', { text: x.rank }), h('span', { class: 'num', text: n0(x.km) }),
      h('span', { class: x.lastJob && Date.now() - x.lastJob < 30 * 864e5 ? '' : 'warn', text: x.lastJob ? ago(x.lastJob) : 'never' }),
      h('span', { class: 'num', text: x.convoys }),
      h('span', null, h('span', { class: `pill ${status[x.discord][1]}`, text: x.left ? 'Left Trucky' : x.loa ? 'On leave' : status[x.discord][0] })),
      h('span', { class: 'acts' }, x.discord === 'guest' ? h('button', { class: 'btn small', type: 'button', onclick: () => act('/api/admin/grant', { uid: x.uid }, render) }, 'Give access') : null,
        x.discord === 'member' ? h('button', { class: 'btn ghost small', type: 'button', onclick: () => act('/api/admin/grant', { uid: x.uid }, render) }, 'Sync rank') : null,
        x.discord === 'member' ? h('button', { class: 'btn danger small', type: 'button', onclick: () => { if (confirm(`Remove ${x.name}'s access on Discord?`)) act('/api/admin/revoke', { uid: x.uid }, render); } }, 'Remove access') : null,
        x.discord !== 'gone' ? h('button', { class: 'btn ghost small', type: 'button', onclick: () => { S.modQuery = x.uid; S.panelTab = 'moderation'; render(); } }, 'Moderate') : null,
        h('button', { class: 'btn ghost small', type: 'button', onclick: () => { if (confirm(`Unlink ${x.name} from their Discord account?`)) act('/api/admin/unlink', { uid: x.uid }, render); } }, 'Unlink')))));
  q.addEventListener('input', () => { const t = q.value.toLowerCase().trim(); for (const row of list.querySelectorAll('.drow')) row.hidden = !!t && !row.dataset.n.includes(t); });
  return [h('div', { class: 'toolbar sec' }, q, h('span', { class: 'muted small', text: `${rows.length} drivers` })), list, unlinkedBox(r.data.unlinked)];
}
function tabPartners(d) {
  const ed = d.partners.find((p) => p.id === S.editPartner) || null;
  const f = { name: h('input', { class: 'field', id: 'pa-n', maxlength: 60, value: ed?.name || '' }), url: h('input', { class: 'field', id: 'pa-u', type: 'url', placeholder: 'https://', value: ed?.url || '' }),
    tmp: h('input', { class: 'field', id: 'pa-t', type: 'url', placeholder: 'https://truckersmp.com/vtc/…', value: ed?.tmp || '' }), desc: h('textarea', { class: 'field', id: 'pa-d', maxlength: 400, rows: 3 }) };
  f.desc.value = ed?.desc || '';
  const logo = imagePicker(ed?.logo || '', 'pa-logo');
  const done = () => { S.editPartner = null; render(); };
  return [h('section', { class: 'panel card sec' }, h('h2', { text: ed ? `Edit ${ed.name}` : 'Add a partner' }), h('p', { class: 'muted', text: 'Partners show on the website and in the #partners channel on Discord. Ten at most.' }),
      h('div', { class: 'two' }, field_(f.name, 'Name'), field_(f.url, 'Website or Discord link'), field_(f.tmp, 'TruckersMP VTC page')), field_(f.desc, 'One or two lines about them'),
      h('p', { class: 'lab', text: 'Logo' }), logo.el,
      h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: () => act('/api/partners/save', { id: ed?.id, name: f.name.value, url: f.url.value, tmp: f.tmp.value, desc: f.desc.value, logo: logo.value }, done) }, ed ? 'Save partner' : 'Add partner'),
        ed ? h('button', { class: 'btn ghost', type: 'button', onclick: done }, 'Cancel') : null)),
    d.partners.length ? h('div', { class: 'plist sec' }, d.partners.map((p, i) => h('div', { class: 'prow panel' }, p.logo ? h('img', { class: 'thumb sq', src: p.logo, alt: '' }) : null,
      h('div', { class: 'grow' }, h('b', { text: p.name }), h('span', { class: 'muted small', text: p.desc || p.url || '' })),
      h('button', { class: 'btn ghost small', type: 'button', disabled: i === 0, 'aria-label': 'Move up', onclick: () => act('/api/partners/move', { id: p.id, dir: -1 }, render) }, '↑'),
      h('button', { class: 'btn ghost small', type: 'button', disabled: i === d.partners.length - 1, 'aria-label': 'Move down', onclick: () => act('/api/partners/move', { id: p.id, dir: 1 }, render) }, '↓'),
      h('button', { class: 'btn ghost small', type: 'button', onclick: () => { S.editPartner = p.id; render(); } }, 'Edit'),
      h('button', { class: 'btn danger small', type: 'button', onclick: () => { if (confirm(`Remove ${p.name}?`)) act('/api/partners/remove', { id: p.id }, render); } }, 'Remove')))) : null];
}
function tabTools() {
  const tool = (what, title, text, label) => h('div', { class: 'tool panel' }, h('div', null, h('b', { text: title }), h('p', { class: 'muted small', text })),
    h('button', { class: 'btn ghost small', type: 'button', onclick: (e) => { const b = e.currentTarget; b.disabled = true; act('/api/admin/run', { what }).finally(() => { b.disabled = false; }); } }, label));
  return [h('div', { class: 'tools sec' },
    tool('sync', 'Sync with Trucky', 'Read the latest jobs and members now, instead of waiting for the next automatic sync.', 'Sync now'),
    tool('panels', 'Refresh Discord panels', 'Rebuild the apply, links, ranks, rules, truck details and partners messages.', 'Refresh'),
    tool('weekly', 'Post the weekly top', 'Normally every Monday morning in #weekly-top.', 'Post now'),
    tool('dotm', 'Pick the Driver of the Month', 'Normally on the 1st. Gives the role and announces last month\'s winner.', 'Pick now'),
    tool('potw', 'Photo of the Week', 'Normally on Monday: the photo with the most reactions in #convoy-photos.', 'Post now'),
    tool('inactivity', 'Remind inactive drivers', 'DMs drivers with no delivery for 30 days who are not on leave. Once a month each.', 'Send now'),
    S.role === 'admin' ? tool('repair', 'Repair the Discord server', 'The same as /setup: recreates missing channels and roles and fixes permissions.', 'Repair') : null)];
}
function tabPosted(d) {
  return [d.scheduled.length ? h('section', { class: 'sec' }, head('Scheduled', 'These go out by themselves at the time shown.'), h('div', { class: 'plist' }, d.scheduled.sort((a, b) => a.at - b.at).map((p) => h('div', { class: 'prow panel' },
    p.image ? h('img', { class: 'thumb', src: p.image, alt: '' }) : null, h('div', { class: 'grow' }, h('b', { text: p.title || '(picture)' }), h('span', { class: 'muted small', text: `#${p.channel} · ${dateL(p.at)} ${timeL(p.at)} · ${p.by.name}${p.ping && p.ping !== 'none' ? ' · @everyone' : ''}` })),
    h('button', { class: 'btn danger small', type: 'button', onclick: () => act('/api/scheduled/cancel', { id: p.id }, render) }, 'Cancel'))))) : null,
    h('section', { class: 'sec' }, head('Posted'), postHistory(d))];
}
async function attendanceBox(c) {
  const r = await api(`/api/panel/attendance?id=${encodeURIComponent(c.id)}`); if (!r.ok) return toast(r.data.error, true);
  const boxes = r.data.people.map((p) => ({ p, el: h('input', { type: 'checkbox', checked: p.here }) }));
  const dlg = h('dialog', { class: 'dlg panel' }, h('h2', { text: `Who drove: ${c.title}` }), h('p', { class: 'muted', text: 'People who said they were coming are listed first.' }),
    h('div', { class: 'attlist' }, boxes.map(({ p, el }) => h('label', { class: 'check' }, el, p.name, p.rsvp ? h('span', { class: 'muted small', text: ` · ${p.rsvp === 'yes' ? (p.slot && p.slot !== 'driver' ? p.slot : 'going') : 'maybe'}` }) : null))),
    h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: () => act('/api/panel/attendance', { id: c.id, uids: boxes.filter((b) => b.el.checked).map((b) => b.p.uid) }, () => { dlg.close(); dlg.remove(); render(); }) }, 'Save attendance'),
      h('button', { class: 'btn ghost', type: 'button', onclick: () => { dlg.close(); dlg.remove(); } }, 'Close')));
  document.body.append(dlg); dlg.showModal();
}
// ---- moderation: find a member, then warn, time out, kick or ban, with a reason ----
const ACT_LABEL = { warn: 'Warn', timeout: 'Time out', kick: 'Kick', ban: 'Ban', unban: 'Unban' };
function modDialog(m, action, canBan) {
  const reason = h('textarea', { class: 'field', id: 'md-r', rows: 3, maxlength: 400, placeholder: 'They see this in a DM (except for unban)' });
  const mins = h('select', { class: 'field', id: 'md-t' }, [[10, '10 minutes'], [60, '1 hour'], [360, '6 hours'], [1440, '1 day'], [10080, '1 week'], [40320, '28 days'], ...(m.timeout ? [[0, 'Remove the timeout']] : [])].map(([v, l]) => h('option', { value: v, selected: v === 60 }, l)));
  const days = h('select', { class: 'field', id: 'md-d' }, [[0, 'Keep their messages'], [1, 'Delete the last 24 hours'], [7, 'Delete the last 7 days']].map(([v, l]) => h('option', { value: v }, l)));
  const close = () => { dlg.close(); dlg.remove(); };
  const go = (e) => { e.currentTarget.disabled = true; act('/api/admin/mod', { action, uid: m.uid, name: m.name, reason: reason.value, minutes: mins.value, days: days.value }, () => { close(); render(); }).finally(() => { if (dlg.open) e.target.disabled = false; }); };
  const dlg = h('dialog', { class: 'dlg panel' }, h('h2', { text: `${ACT_LABEL[action]} ${m.name}` }),
    h('p', { class: 'muted', text: { warn: 'A warning in their DMs, kept in the moderation log.', timeout: 'They can read but not write or talk until it ends.', kick: 'Removes them from the server. They can come back with an invite.', ban: 'Removes them and blocks them from coming back.', unban: 'They can join again with an invite.' }[action] }),
    action === 'timeout' ? field_(mins, 'How long') : null, action === 'ban' ? field_(days, 'Their recent messages') : null, field_(reason, 'Reason'),
    h('div', { class: 'actions' }, h('button', { class: `btn ${action === 'ban' || action === 'kick' ? 'danger' : ''}`, type: 'button', onclick: go }, ACT_LABEL[action]), h('button', { class: 'btn ghost', type: 'button', onclick: close }, 'Cancel')));
  document.body.append(dlg); dlg.showModal();
}
function memberCard(m, canBan) {
  return h('article', { class: 'mcard panel' },
    h('header', null, h('img', { class: 'av', src: m.avatar, alt: '' }), h('div', null, h('b', { text: m.name }), h('span', { class: 'muted small', text: `@${m.tag} · ID ${m.uid}${m.joined ? ` · joined ${dateL(m.joined)}` : ''}` })),
      m.staff ? h('span', { class: 'pill pending', text: 'Staff' }) : null, m.timeout ? h('span', { class: 'pill rejected', text: `Timed out until ${timeL(m.timeout)}` }) : null),
    m.roles.length ? h('div', { class: 'chips' }, m.roles.map((r) => h('span', { class: 'chip', text: r }))) : null,
    m.history.length ? h('ul', { class: 'mhist' }, m.history.map((x) => h('li', null, h('b', { text: ACT_LABEL[x.action] }), ` ${ago(x.at)} by ${x.by}: ${x.reason}`))) : null,
    m.bot ? h('p', { class: 'muted small', text: 'This is a bot.' }) : h('div', { class: 'actions' },
      h('button', { class: 'btn ghost small', type: 'button', onclick: () => modDialog(m, 'warn') }, 'Warn'),
      h('button', { class: 'btn ghost small', type: 'button', onclick: () => modDialog(m, 'timeout') }, m.timeout ? 'Change timeout' : 'Time out'),
      h('button', { class: 'btn danger small', type: 'button', onclick: () => modDialog(m, 'kick') }, 'Kick'),
      canBan ? h('button', { class: 'btn danger small', type: 'button', onclick: () => modDialog(m, 'ban', canBan) }, 'Ban') : null));
}
async function tabModeration() {
  const q = h('input', { class: 'field', type: 'search', id: 'mod-q', placeholder: 'Discord name or user ID', 'aria-label': 'Find a member', value: S.modQuery || '' });
  const results = h('div', { class: 'mlist' });
  const search = async () => {
    S.modQuery = q.value.trim(); if (!S.modQuery) { results.replaceChildren(); return; }
    results.replaceChildren(h('p', { class: 'muted', text: 'Searching…' }));
    const r = await api(`/api/panel/mod?q=${encodeURIComponent(S.modQuery)}`);
    results.replaceChildren(...(!r.ok ? [h('p', { class: 'muted', text: r.data.error })] : r.data.members.length ? r.data.members.map((m) => memberCard(m, r.data.canBan)) : [h('p', { class: 'muted', text: 'Nobody on the server matches that.' })]));
  };
  q.addEventListener('keydown', (e) => { if (e.key === 'Enter') search(); });
  if (S.modQuery) search();
  const b = await api('/api/panel/bans'), bd = b.ok ? b.data : { bans: [], log: [], canBan: false };
  return [h('section', { class: 'sec' }, h('div', { class: 'toolbar' }, q, h('button', { class: 'btn', type: 'button', onclick: search }, 'Find')), results),
    bd.canBan ? h('section', { class: 'sec' }, head('Banned', `${bd.bans.length} account${bd.bans.length === 1 ? '' : 's'}`), bd.bans.length ? h('div', { class: 'plist' }, bd.bans.map((x) => h('div', { class: 'prow panel' }, h('img', { class: 'av', src: x.avatar, alt: '' }),
      h('div', { class: 'grow' }, h('b', { text: x.name }), h('span', { class: 'muted small', text: x.reason || 'No reason' })),
      h('button', { class: 'btn ghost small', type: 'button', onclick: () => modDialog({ uid: x.uid, name: x.name }, 'unban') }, 'Unban')))) : h('p', { class: 'muted', text: 'Nobody is banned.' })) : null,
    h('section', { class: 'sec' }, head('Moderation log', 'Everything done from this panel.'), bd.log.length ? h('div', { class: 'plist' }, bd.log.map((x) => h('div', { class: 'prow line' },
      h('div', { class: 'grow' }, h('b', { text: `${ACT_LABEL[x.action]}: ${x.name}` }), h('span', { class: 'muted small', text: `${ago(x.at)} by ${x.by} · ${x.reason}` }))))) : h('p', { class: 'muted', text: 'Nothing yet.' }))];
}
async function pagePanel() {
  if (!S.user) return [empty('Log in with Discord', 'The admin panel is for the team.', loginBtn())];
  const r = await api('/api/panel'); if (!r.ok) return [empty('Team only', r.data.error || 'Try again.')];
  const d = r.data, c = d.caps;
  const tabs = [...(c.manage ? [['overview', 'Overview']] : []), ...(c.media ? [['post', 'Post']] : []), ...(c.events ? [['convoys', 'Convoys']] : []), ...(c.media ? [['history', 'Posted']] : []),
    ...(c.manage ? [['drivers', 'Drivers'], ['moderation', 'Moderation']] : []), ...(c.post ? [['partners', 'Partners'], ['tools', 'Tools']] : [])];
  const tab = tabs.some((t) => t[0] === S.panelTab) ? S.panelTab : tabs[0][0];
  const out = [h('div', { class: 'pagehead' }, h('h1', { text: 'Admin panel' }), d.teams.length ? h('div', { class: 'chips' }, d.teams.map((t) => h('span', { class: 'pill pending', text: TEAM_NAME[t] || t }))) : null),
    h('div', { class: 'tabsline', role: 'tablist' }, tabs.map(([k, l]) => h('button', { class: `btn small ${tab === k ? '' : 'ghost'}`, type: 'button', role: 'tab', 'aria-selected': String(tab === k), onclick: () => { S.panelTab = k; render(); } }, l)))];
  if (tab === 'overview') out.push(...await tabOverview());
  if (tab === 'post') out.push(composer(d));
  if (tab === 'convoys') out.push(planner(d), h('section', { class: 'sec' }, head('Planned', 'Drafts, upcoming convoys and the last ones (to mark who came).'), convoyRows(d)));
  if (tab === 'history') out.push(...tabPosted(d));
  if (tab === 'drivers') out.push(...await tabDrivers());
  if (tab === 'moderation') out.push(...await tabModeration());
  if (tab === 'partners') out.push(...tabPartners(d));
  if (tab === 'tools') out.push(...tabTools());
  return out;
}

async function pageApply() {
  const head_ = h('div', { class: 'pagehead' }, h('h1', { text: 'Apply' }), h('p', { text: `Want to drive with ${S.cfg.name}? Fill in the form and staff will reply on Discord.` }));
  if (!S.user) return [head_, h('div', { class: 'sec' }, empty('Log in with Discord', 'So we know who to reply to.', loginBtn()))];
  if (S.driver) return [head_, h('div', { class: 'sec' }, empty('You already drive for us', `Your account is linked to ${S.driver.name}.`, h('a', { class: 'btn ghost', href: `#/soferi/${S.driver.id}` }, 'See your profile')))];
  const r = await api('/api/apply'), mine = r.data.app;
  if (mine?.status === 'pending') return [head_, h('div', { class: 'sec' }, empty('Your application is pending', `Sent ${ago(mine.at)}. You will get an answer on Discord.`))];
  if (!r.data.open) return [head_, h('div', { class: 'sec' }, empty('Recruitment is closed', 'Check back later or follow the announcements on Discord.'))];
  const steam = h('input', { class: 'field', id: 'ap-steam', type: 'text', placeholder: 'https://steamcommunity.com/profiles/7656119…' });
  const tmp = h('input', { class: 'field', id: 'ap-tmp', type: 'text', placeholder: 'TruckersMP link or ID' });
  const age = h('input', { class: 'field', id: 'ap-age', type: 'number', min: 13, max: 99 });
  const from = h('input', { class: 'field', id: 'ap-from', type: 'text', maxlength: 80, placeholder: 'City or country' });
  const hours = h('input', { class: 'field', id: 'ap-hours', type: 'text', maxlength: 40, placeholder: 'For example: 10 hours a week' });
  const why = h('textarea', { class: 'field', id: 'ap-why', maxlength: 1200, placeholder: 'How long you have played, what you like to haul, why Diesel Union.' });
  const rules = h('input', { type: 'checkbox' });
  return [head_,
    mine?.status === 'rejected' ? h('p', { class: 'muted sec', text: `Your last application was declined ${ago(mine.decided)}.${mine.note ? ` Reason: ${mine.note}` : ''}` }) : null,
    h('section', { class: 'panel card sec' },
      h('div', { class: 'two' }, h('div', null, h('label', { class: 'lab', for: 'ap-steam', text: 'Steam profile' }), steam), h('div', null, h('label', { class: 'lab', for: 'ap-tmp', text: 'TruckersMP profile, optional' }), tmp)),
      h('div', { class: 'two' }, h('div', null, h('label', { class: 'lab', for: 'ap-age', text: 'Age' }), age), h('div', null, h('label', { class: 'lab', for: 'ap-from', text: 'Where you are from' }), from), h('div', null, h('label', { class: 'lab', for: 'ap-hours', text: 'Hours in ETS2' }), hours)),
      h('label', { class: 'lab', for: 'ap-why', text: 'About you' }), why,
      h('label', { class: 'check' }, rules, 'I agree to run Trucky on my jobs and to follow the company and TruckersMP rules.'),
      h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: () => act('/api/apply', { steam: steam.value, tmp: tmp.value, age: age.value, from: from.value, hours: hours.value, why: why.value, games: ['ETS2'], rules: rules.checked }, render) }, icon('pen', 18), 'Send application')))];
}

async function pageAccount() {
  const head_ = h('div', { class: 'pagehead' }, h('h1', { text: 'My account' }), h('p', { text: 'Link your Discord account to your Trucky driver, so you can see the members area and use /profile on Discord.' }));
  if (!S.user) return [head_, h('div', { class: 'sec' }, empty('Log in with Discord', 'To link your account.', loginBtn()))];
  if (S.driver) return [head_, h('section', { class: 'panel card sec' }, h('h2', { text: S.driver.name }), h('p', { class: 'muted', text: `Your Discord account is linked to the Trucky driver ${S.driver.name}.` }),
    h('div', { class: 'actions' }, h('a', { class: 'btn', href: `#/soferi/${S.driver.id}` }, 'See profile'), h('button', { class: 'btn ghost', type: 'button', onclick: () => act('/api/unlink', {}, boot) }, 'Unlink')))];
  const steam = h('input', { class: 'field', id: 'lk-steam', type: 'text', placeholder: 'https://steamcommunity.com/profiles/7656119…' });
  return [head_, h('section', { class: 'panel card sec' }, h('label', { class: 'lab', for: 'lk-steam', text: 'Your Steam profile, the same one you use in Trucky' }), steam,
    h('p', { class: 'muted small', text: 'In Steam, open your profile, right-click and choose "Copy Page URL". It must contain the number starting with 7656119.' }),
    h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: () => act('/api/link', { steam: steam.value }, boot) }, icon('link', 18), 'Link account')))];
}

async function pageStaff() {
  if (!S.role) return [empty('Staff only', 'This page is for the people who run the company.')];
  const r = await api('/api/staff'); if (!r.ok) return [empty('Could not load', r.data.error || 'Try again.')];
  const d = r.data, tab = S.staffTab || 'apps';
  const tabs = h('div', { class: 'tabsline' }, [['apps', `Applications${d.apps.filter((a) => a.status === 'pending').length ? ` (${d.apps.filter((a) => a.status === 'pending').length})` : ''}`], ['trucky', 'Trucky'], ...(d.role === 'admin' ? [['cfg', 'Settings']] : [])].map(([k, l]) => h('button', { class: `btn small ${tab === k ? '' : 'ghost'}`, type: 'button', onclick: () => { S.staffTab = k; render(); } }, l)));
  const out = [h('div', { class: 'pagehead' }, h('h1', { text: 'Staff' })), tabs];
  if (tab === 'apps') out.push(h('section', { class: 'sec apps' }, d.apps.length ? d.apps.map(appCard) : empty('No applications', 'When someone applies, it shows up here and in the staff channel.')));
  if (tab === 'trucky') {
    const s = d.sync, line = (ok, a, b) => h('div', null, h('b', { class: ok ? 'ok' : 'bad', text: a }), h('span', { class: 'muted small', text: b }));
    out.push(h('section', { class: 'sec' }, h('div', { class: 'status' },
      line(!!S.cfg.trucky, S.cfg.trucky ? 'Company ID set' : 'Company ID missing', 'Trucky, Company Settings, API.'),
      line(s.token, s.token ? 'Token set' : 'No token', 'The TRUCKY_TOKEN variable on Railway.'),
      line(s.secret, s.secret ? 'Webhook signed' : 'Webhook without a secret', 'The TRUCKY_WEBHOOK_SECRET variable (recommended).'),
      line(!!s.lastHook, s.lastHook ? `Last webhook ${ago(s.lastHook.at)}` : 'No webhook received', s.lastHook?.event || 'Add the address below in Trucky.'),
      line(s.jobs?.ok, s.jobs?.at ? `Read from the API ${ago(s.jobs.at)}` : 'API not read yet', s.jobs?.error || `${n0(s.stored)} jobs stored`),
      line(s.members?.ok, s.members?.ok ? `${s.members.count} members from Trucky` : 'Members not read', s.members?.error || 'Re-read every half hour.')),
    h('div', { class: 'panel card sec' }, h('h2', { text: 'Webhook' }), h('p', { class: 'muted', text: 'In Trucky, Company Settings, API, add this address and tick the job events (Job Completed, Canceled, Deleted) and the member events.' }), h('code', { class: 'copy', text: s.webhook }),
      h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: (e) => { e.currentTarget.disabled = true; act('/api/sync', {}, render); } }, icon('refresh', 18), 'Sync now'))),
    h('div', { class: 'panel card sec' }, h('h2', { text: 'Linked accounts' }), d.links.length ? h('div', { class: 'ranks' }, d.links.map((l) => h('div', { class: 'rrow', style: { gridTemplateColumns: 'minmax(0,1fr) auto', cursor: 'default' } }, h('span', { class: 'nm', text: `${l.name} · Discord ${l.discord}` }), h('button', { class: 'btn danger small', type: 'button', onclick: () => act('/api/staff/unlink', { discord: l.discord }, render) }, 'Unlink')))) : h('p', { class: 'muted', text: 'Nobody has linked an account yet.' }))));
  }
  if (tab === 'cfg' && d.cfg) out.push(...configForm(d.cfg, d.channels || []));
  return out;
}
function appCard(a) {
  const note = h('input', { class: 'field', type: 'text', maxlength: 500, placeholder: 'Message to the applicant, optional' }), tr = h('input', { type: 'checkbox', checked: true });
  return h('article', { class: 'app panel rv' },
    h('header', null, av(a.avatar, a.name), h('b', { text: a.name }), h('span', { class: `pill ${a.status}`, text: { pending: 'Pending', accepted: 'Accepted', rejected: 'Declined' }[a.status] }), h('span', { class: 'muted small', text: ago(a.at) })),
    h('dl', null, h('dt', { text: 'Discord' }), h('dd', { text: a.discord }), h('dt', { text: 'Steam' }), h('dd', null, h('a', { href: `https://steamcommunity.com/profiles/${a.steam}`, target: '_blank', rel: 'noopener', text: a.steam })),
      a.tmp ? [h('dt', { text: 'TruckersMP' }), h('dd', { text: a.tmp })] : null, h('dt', { text: 'Age' }), h('dd', { text: a.age }), a.from ? [h('dt', { text: 'From' }), h('dd', { text: a.from })] : null,
      h('dt', { text: 'Plays' }), h('dd', { text: `${a.games.join(', ')}${a.hours ? ` · ${a.hours}` : ''}` }), a.by ? [h('dt', { text: 'Decided by' }), h('dd', { text: `${a.by}${a.note ? `: ${a.note}` : ''}` })] : null),
    h('div', { class: 'why', text: a.why }),
    a.status === 'pending' ? [h('div', { class: 'two', style: { marginTop: '12px' } }, note), h('label', { class: 'check' }, tr, 'Also add them to the company on Trucky'),
      h('div', { class: 'actions' }, h('button', { class: 'btn ok', type: 'button', onclick: () => act('/api/apply/decide', { id: a.id, accept: true, note: note.value, trucky: tr.checked }, render) }, 'Accept'), h('button', { class: 'btn danger', type: 'button', onclick: () => act('/api/apply/decide', { id: a.id, accept: false, note: note.value }, render) }, 'Decline'))] : null);
}
function configForm(c, chans) {
  const pick = (id, cur) => { const g = new Map(); for (const x of chans) { if (!g.has(x.group)) g.set(x.group, []); g.get(x.group).push(x); } return h('select', { class: 'field', id }, h('option', { value: '' }, 'None'), [...g].map(([n, xs]) => { const o = xs.map((x) => h('option', { value: x.id, selected: x.id === cur }, `# ${x.name}`)); return n ? h('optgroup', { label: n }, o) : o; })); };
  const inp = (id, v, a = {}) => h('input', { class: 'field', id, value: v ?? '', ...a });
  const F = { name: inp('c-name', c.name, { maxlength: 40 }), tag: inp('c-tag', c.tag, { maxlength: 8 }), tagline: inp('c-tl', c.tagline, { maxlength: 90 }), truckyId: inp('c-tr', c.truckyId, { inputmode: 'numeric' }), tmpId: inp('c-tmp', c.tmpId, { placeholder: 'ID or truckersmp.com/vtc/… link' }), minJobKm: inp('c-min', c.minJobKm, { type: 'number', min: 0, max: 2000 }),
    jobsChannel: pick('c-jobs', c.jobsChannel), convoyChannel: pick('c-conv', c.convoyChannel), staffChannel: pick('c-staff', c.staffChannel) };
  const open = h('input', { type: 'checkbox', checked: c.recruitOpen });
  const about = h('textarea', { class: 'field', id: 'c-about', maxlength: 1500 }); about.value = c.about || '';
  const reqs = h('textarea', { class: 'field', id: 'c-reqs', maxlength: 1500 }); reqs.value = (c.requirements || []).join('\n');
  const invite = inp('c-inv', c.discordInvite, { type: 'url', placeholder: 'https://discord.gg/…' });
  const trUrl = inp('c-trurl', c.truckyUrl, { type: 'url', placeholder: 'https://hub.truckyapp.com/vtc/…' });
  const rules = h('textarea', { class: 'field', id: 'c-rules', maxlength: 4000 }); rules.value = (c.discordRules || []).join('\n');
  const autoRm = h('input', { type: 'checkbox', checked: c.autoRemove !== false });
  const STD = [['tag', 'Tag name and colour'], ['truck', 'Truck colour'], ['trailer', 'Trailer colour and livery']], std = {};
  const stdBlock = ([k, title]) => {
    const v = (c.standards || {})[k] || {}, t = h('textarea', { class: 'field', id: `sd-${k}`, maxlength: 3000, placeholder: 'What drivers need to know' }); t.value = v.text || '';
    std[k] = { text: t, color: inp(`sd-${k}-c`, v.color, { placeholder: '#8a5a2b', maxlength: 7 }), image: inp(`sd-${k}-i`, v.image, { type: 'url', placeholder: 'https://… picture link (optional)' }) };
    return h('div', { style: { marginTop: '18px' } }, h('h3', { text: title }), lab(t, 'Text'), h('div', { class: 'two' }, lab(std[k].color, 'Colour (hex)'), lab(std[k].image, 'Picture')));
  };
  const rows = h('div', { class: 'rankrows' });
  const addRow = (r = { name: '', km: '' }) => { const row = h('div', null, h('input', { class: 'field', value: r.name, placeholder: 'Rank name', maxlength: 30, 'aria-label': 'Rank name' }), h('input', { class: 'field', type: 'number', min: 0, value: r.km, 'aria-label': 'Kilometres' }), h('button', { class: 'btn danger small', type: 'button', 'aria-label': 'Remove rank', onclick: () => row.remove() }, icon('x', 16))); rows.append(row); };
  c.ranks.forEach(addRow);
  const save_ = () => act('/api/config', { ...Object.fromEntries(Object.entries(F).map(([k, el]) => [k, el.value])), recruitOpen: open.checked, about: about.value, requirements: reqs.value.split('\n'), discordInvite: invite.value, truckyUrl: trUrl.value, discordRules: rules.value.split('\n'), autoRemove: autoRm.checked, standards: Object.fromEntries(Object.entries(std).map(([k, f]) => [k, { text: f.text.value, color: f.color.value, image: f.image.value }])), ranks: [...rows.children].map((r) => ({ name: r.children[0].value, km: r.children[1].value })) }, boot);
  const lab = (el, t) => h('div', null, h('label', { class: 'lab', for: el.id, text: t }), el);
  const test = (el) => h('button', { class: 'btn ghost small', type: 'button', style: { marginTop: '8px' }, onclick: () => (el.value ? act('/api/test', { channel: el.value }) : toast('Pick a channel first.', true)) }, 'Send a test');
  return [
    h('section', { class: 'panel card sec' }, h('h2', { text: 'Company' }), h('div', { class: 'two' }, lab(F.name, 'Name'), lab(F.tag, 'Tag'), lab(F.tagline, 'Tagline')),
      h('div', { class: 'two' }, lab(F.truckyId, 'Trucky company ID'), lab(F.tmpId, 'TruckersMP VTC'), lab(F.minJobKm, 'Ignore jobs shorter than (km)')), h('label', { class: 'check' }, open, 'Recruitment open')),
    h('section', { class: 'panel card sec' }, h('h2', { text: 'Front page' }), h('p', { class: 'muted', text: 'What newcomers see on the home page.' }), lab(about, 'About us'), lab(reqs, 'Requirements, one per line'), lab(invite, 'Discord server invite')),
    h('section', { class: 'panel card sec' }, h('h2', { text: 'Discord server' }), h('p', { class: 'muted', text: 'Run /setup on Discord to build the channels and roles. These texts go into the panels the bot keeps there.' }),
      lab(trUrl, 'Trucky company page, for the Join button (leave empty to use the company ID)'), lab(rules, 'Discord rules, one per line'),
      h('label', { class: 'check' }, autoRm, 'Remove access on Discord when someone leaves the company on Trucky')),
    h('section', { class: 'panel card sec' }, h('h2', { text: 'Truck details' }), h('p', { class: 'muted', text: 'Shown in the three Truck Details channels on Discord. They update as soon as you save.' }), STD.map(stdBlock)),
    h('section', { class: 'panel card sec' }, h('h2', { text: 'Discord channels' }), chans.length ? null : h('p', { class: 'muted', text: 'No channels the bot can post in (it needs View Channel, Send Messages, Embed Links).' }),
      h('div', { class: 'two' }, h('div', null, lab(F.jobsChannel, 'Deliveries and rank-ups'), test(F.jobsChannel)), h('div', null, lab(F.convoyChannel, 'Convoys'), test(F.convoyChannel)), h('div', null, lab(F.staffChannel, 'Applications (staff)'), test(F.staffChannel)))),
    h('section', { class: 'panel card sec' }, h('h2', { text: 'Ranks' }), h('p', { class: 'muted', text: 'Total kilometres needed for each rank. The first one starts at 0.' }), rows, h('div', { class: 'actions' }, h('button', { class: 'btn ghost small', type: 'button', onclick: () => addRow() }, 'Add a rank'))),
    h('p', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: save_ }, 'Save settings'))];
}

// ---- shell ----
const TABS = [['', 'Home', 'home'], ['soferi', 'Drivers', 'users'], ['curse', 'Jobs', 'truck'], ['clasament', 'Leaderboard', 'trophy'], ['convoaie', 'Convoys', 'flag']];
const PAGES = { '': pageHome, soferi: pageDrivers, curse: pageJobs, clasament: pageBoard, convoaie: pageConvoys, aplica: pageApply, cont: pageAccount, staff: pageStaff, panel: pagePanel, partners: pagePartners };
const route = () => { const r = location.hash.replace(/^#\/?/, '').split('/'); return { page: r[0] in PAGES ? r[0] : '', arg: r[1] || null }; };

function shell() {
  const { page } = route();
  const tabs = [['', 'Home', 'home'], ...(S.member ? [['soferi', 'Drivers', 'users'], ['curse', 'Jobs', 'truck'], ['clasament', 'Leaderboard', 'trophy']] : []), ['convoaie', 'Convoys', 'flag'], ...(S.cfg.recruitOpen && !S.member ? [['aplica', 'Apply', 'pen']] : [])];
  $('#nav').replaceChildren(...tabs.map(([k, l, ic]) => h('a', { href: `#/${k}`, 'aria-current': k === page ? 'page' : null }, icon(ic, 18), l)));
  $('#tabbar').replaceChildren(...tabs.slice(0, 5).map(([k, l, ic]) => h('a', { href: `#/${k}`, 'aria-current': k === page ? 'page' : null }, icon(ic, 22), h('span', { text: l }))));
  $('#tabbar').style.setProperty('--n', Math.min(5, tabs.length));
  document.body.classList.toggle('on-home', page === '');
  const me = $('#me');
  if (S.user) {
    const menu = h('div', { class: 'menu', hidden: true }, S.driver ? h('a', { href: `#/soferi/${S.driver.id}` }, icon('users', 18), 'My profile') : null, h('a', { href: '#/cont' }, icon('link', 18), S.driver ? 'My account' : 'Link your account'),
      !S.member && S.cfg.recruitOpen ? h('a', { href: '#/aplica' }, icon('pen', 18), 'Apply') : null, S.caps.media || S.caps.events || S.caps.manage ? h('a', { href: '#/panel' }, icon('gear', 18), 'Admin panel') : null, S.role ? h('a', { href: '#/staff' }, icon('gear', 18), 'Staff') : null, h('a', { href: '/auth/logout' }, icon('exit', 18), 'Log out'));
    const btn = h('button', { class: 'who', type: 'button', 'aria-expanded': 'false', 'aria-label': `Account: ${S.user.name}`, onclick: (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; btn.setAttribute('aria-expanded', String(!menu.hidden)); } }, av(S.driver?.avatar || S.user.avatar, S.user.name), h('span', { text: S.driver?.name || S.user.name }));
    me.replaceChildren(btn, menu);
  } else me.replaceChildren(S.login ? h('a', { class: 'btn small', href: '/auth/login' }, 'Log in') : '');
}
document.addEventListener('click', () => { const m = $('#me .menu'); if (m) m.hidden = true; });

let tok = 0, lastPage = null;
async function render() {
  const my = ++tok, { page, arg } = route(), view = $('#view');
  if (page === 'soferi' && arg && lastPage === 'soferi' && view.childElementCount) { openDriver(arg); return; }
  for (const c of cleanups.splice(0)) c();
  shell();
  if (page !== lastPage) view.replaceChildren(...skel(3));
  let nodes; try { nodes = await PAGES[page](); } catch (err) { console.error(err); nodes = [empty('Something went wrong', 'Reload the page in a minute.')]; }
  if (my !== tok) return;
  view.replaceChildren(...nodes.flat(Infinity).filter(Boolean));
  lastPage = page; reveal(view);
  document.title = page ? `${(TABS.find((t) => t[0] === page) || [0, { aplica: 'Apply', cont: 'My account', staff: 'Staff', panel: 'Admin panel', partners: 'Partners' }[page]])[1]} · ${S.cfg.name}` : `${S.cfg.name} — TruckersMP VTC | United by the Road`;
  if (page === 'soferi' && arg) openDriver(arg);
}
addEventListener('hashchange', () => { const { page, arg } = route(); if (!(page === 'soferi' && arg)) { closeDrawerOnly(); if (page !== lastPage) scrollTo(0, 0); } render(); });
function closeDrawerOnly() { $('#drawer').hidden = true; $('#scrim').hidden = true; document.body.classList.remove('lock'); }

let revealer = null;
function reveal(root) {
  const els = root.querySelectorAll('.rv:not(.in)');
  if (REDUCED || !('IntersectionObserver' in window)) { for (const el of els) el.classList.add('in'); return; }
  revealer ||= new IntersectionObserver((list) => { let k = 0; for (const e of list) if (e.isIntersecting) { e.target.style.setProperty('--d', `${Math.min(k++, 10) * 50}ms`); e.target.classList.add('in'); revealer.unobserve(e.target); } }, { rootMargin: '0px 0px -4% 0px' });
  for (const el of els) revealer.observe(el);
}
setInterval(() => { for (const el of document.querySelectorAll('[data-until]')) el.textContent = until(Number(el.dataset.until)); }, 1000);
$('#scrim').addEventListener('click', closeDrawer);
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#drawer').hidden) closeDrawer(); });

function intro() {
  const el = $('#intro'); if (!el) return;
  let seen = false; try { seen = sessionStorage.getItem('du-intro') === '1'; sessionStorage.setItem('du-intro', '1'); } catch { /* storage blocked */ }
  if (seen || REDUCED) { el.remove(); return; }
  document.body.classList.add('lock');
  const go = () => { if (el.classList.contains('out')) return; el.classList.add('out'); document.body.classList.remove('lock'); setTimeout(() => el.remove(), 900); };
  el.addEventListener('pointerdown', go); addEventListener('keydown', go, { once: true });
  setTimeout(go, 2300);
}
async function boot() {
  const r = await api('/api/me').catch(() => null);
  if (r?.ok) Object.assign(S, { user: r.data.user, role: r.data.role, caps: r.data.caps || {}, teams: r.data.teams || [], member: !!r.data.member, cfg: r.data.cfg, login: r.data.login, driver: r.data.driver });
  $('.brand-name').textContent = S.cfg.name;
  // footer: point the outside links at our own VTC pages once the settings are known
  const setHref = (k, href) => { const a = document.querySelector(`.foot [data-k="${k}"]`); if (a && href) a.href = href; };
  setHref('tmp', S.cfg.tmpUrl); setHref('trucky', S.cfg.truckyUrl);
  const dc = document.querySelector('.foot [data-k="discord"]'); if (dc) { if (S.cfg.discordInvite) dc.href = S.cfg.discordInvite; else dc.remove(); }
  await render();
}
boot();

// Premium shell: page progress is a quiet orientation cue, not a decorative preloader.
(() => {
  const bar = document.getElementById('scroll-progress');
  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
  if (!bar) return;
  let queued = false;
  const update = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? Math.max(0, Math.min(1, window.scrollY / max)) : 0})`;
    queued = false;
  };
  const scroll = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
  addEventListener('scroll', scroll, { passive: true });
  addEventListener('resize', scroll, { passive: true });
  addEventListener('hashchange', scroll);
  scroll();
})();
