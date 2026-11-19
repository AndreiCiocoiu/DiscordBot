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
  discord: 'M8 7c-2 .500-3 1-3 1-1.500 3-2 6-1.500 9 1.500 1.300 3 2 4.500 2l1-1.700M16 7c2 .500 3 1 3 1 1.500 3 2 6 1.500 9-1.500 1.300-3 2-4.500 2l-1-1.700M7.500 16c3 1.500 6 1.500 9 0M9.500 13h.01M14.500 13h.01M9 6.500c2-.500 4-.500 6 0',
};
const icon = (n, s = 20) => svg('svg', { class: 'ico', viewBox: '0 0 24 24', width: s, height: s, 'aria-hidden': 'true' }, svg('path', { d: ICONS[n].replace(/(\d)\.(\d)00/g, '$1.$2') }));

const S = { user: null, role: null, member: false, cfg: { name: 'Diesel Union', ranks: [], requirements: [] }, login: false, driver: null, anim: true };
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
  const n = Math.max(1, Math.min(6, (rank?.index ?? 0) + 1));
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
  const sparks = h('canvas', { class: 'sparks', 'aria-hidden': 'true' });
  const band = h('div', { class: 'band', 'aria-hidden': 'true' },
    h('div', { class: 'pan' }, h('div', { class: 'frame' }, h('img', { class: 'cover', src: '/img/cover.webp', alt: '', fetchpriority: 'high' }), over)),
    sparks, h('div', { class: 'leak' }), h('div', { class: 'grain' }));
  setTimeout(() => embers(sparks), 0);
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
      full && c.dlc ? h('p', { class: 'desc', text: `DLC: ${c.dlc}` }) : null,
      full && c.desc ? h('p', { class: 'desc', text: c.desc }) : null),
    h('div', { class: 'rsvp' },
      c.tmp ? h('a', { class: 'btn ghost small', href: c.link, target: '_blank', rel: 'noopener' }, 'View on TruckersMP', icon('out', 16))
        : [faces(c), soon > -3 * 3600_000 ? rsvpButtons(c) : null, S.role && full ? h('button', { class: 'btn danger small', type: 'button', onclick: () => { if (confirm(`Delete the convoy "${c.title}"?`)) act('/api/convoys/remove', { id: c.id }, render); } }, 'Delete') : null]));
  return card;
}
function faces(c) {
  if (!c.yes?.length && !c.maybe) return h('span', { class: 'muted small', text: 'Nobody has confirmed yet' });
  return h('div', { class: 'faces' }, c.yes.slice(0, 6).map((p) => av(p.avatar, p.name)), h('span', { class: 'more', text: `${c.yes.length} going${c.maybe ? `, ${c.maybe} maybe` : ''}` }));
}
function rsvpButtons(c) {
  if (!S.user) return S.login ? h('a', { class: 'btn small', href: '/auth/login' }, 'Log in to RSVP') : null;
  const opts = [['yes', 'Going'], ['maybe', 'Maybe'], ['no', 'Not going']];
  return h('div', { class: 'seg', role: 'group', 'aria-label': 'Are you coming?' }, opts.map(([k, l]) => h('button', { type: 'button', 'aria-pressed': String(c.mine === k), onclick: () => act('/api/rsvp', { id: c.id, status: k }, render) }, l)));
}

// ---- pages ----
const VALUES = [
  ['flag', 'Weekly convoys', 'We drive together on TruckersMP, with the route posted in advance, a meeting point and someone leading the column.'],
  ['truck', 'Jobs log themselves', 'With Trucky running, every delivery goes straight into the company logbook. Nothing to fill in by hand.'],
  ['trophy', 'Ranks you earn', 'Every kilometre you deliver moves you up. Leaderboards reset every week and every month.'],
  ['users', 'People you can count on', 'On voice during convoys, and around to help when your trailer breaks down or you lose the road.'],
];
const STEPS = [
  ['Apply on the site', 'Log in with Discord and fill in the form. It takes two minutes.'],
  ['Staff gets back to you', 'You get a Discord message, usually the same day.'],
  ['Join the company on Trucky', 'Install Trucky and join Diesel Union so your jobs are counted.'],
  ['Drive your first convoy', 'We introduce you to the crew and hit the road together.'],
];
const FAQ = [
  ['Do I have to play on TruckersMP?', 'Convoys are on TruckersMP. Jobs can be single player too: Trucky counts both.'],
  ['Which DLCs do I need?', 'None are required. When a convoy needs a map DLC, the announcement says so in advance.'],
  ['ETS2 or ATS?', 'Both. Every job is logged under its own game.'],
  ['Is there a minimum distance?', 'It is not a race. What matters is staying active and joining convoys when you can.'],
  ['How are ranks worked out?', 'From the total kilometres you deliver with Trucky since joining. The thresholds are shown above.'],
];

async function pageHome() {
  const r = await api('/api/home');
  const d = r.ok ? r.data : { tot: { month: {}, week: {}, all: {} }, next: [], drivers: 0 };
  const scrollTo_ = () => $('#despre')?.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
  const [w1, ...rest] = String(S.cfg.name || '').trim().split(/\s+/);
  const hero = h('section', { class: 'hero' }, coverHero(),
    h('div', { class: 'hero-in' }, medallion(true),
      h('h1', { 'aria-label': S.cfg.name }, h('span', { class: 'a', text: w1 || '' }), rest.length ? h('span', { class: 'b', text: rest.join(' ') }) : null),
      h('p', { class: 'tagline', text: S.cfg.tagline }),
      h('p', { class: 'lead', text: `A virtual trucking company on TruckersMP${S.cfg.tag ? `, tag [${S.cfg.tag}]` : ''}. Euro Truck Simulator 2 and American Truck Simulator.` }),
      h('div', { class: 'cta' }, S.cfg.recruitOpen && !S.member ? h('a', { class: 'btn', href: '#/aplica' }, 'Apply to join', icon('arrow', 18)) : S.member ? h('a', { class: 'btn', href: '#/curse' }, 'Company jobs', icon('arrow', 18)) : null,
        h('button', { class: 'btn ghost', type: 'button', onclick: scrollTo_ }, 'Learn more'))),
    h('button', { class: 'cue', type: 'button', 'aria-label': 'Scroll down', onclick: scrollTo_ }, h('span')));
  scrollFx();
  const m = d.tot.month || {};
  const odo = h('section', { class: 'odo', 'aria-label': 'This month' },
    h('div', null, h('div', { class: 'lbl', text: 'Kilometres this month' }), h('div', { style: { display: 'flex' } }, odometer(m.km, 6), h('span', { class: 'unit', text: 'km' })), h('div', { class: 'sub', text: `${kmS(d.tot.all?.km)} since day one` })),
    h('div', null, h('div', { class: 'lbl', text: 'Jobs delivered' }), odometer(m.jobs, 3), h('div', { class: 'sub', text: `${n0(d.tot.week?.jobs)} this week` })),
    h('div', null, h('div', { class: 'lbl', text: 'Tonnes hauled' }), odometer((m.mass || 0) / 1000, 4), h('div', { class: 'sub', text: 'this month' })),
    h('div', null, h('div', { class: 'lbl', text: 'Drivers' }), odometer(d.drivers, 2), h('div', { class: 'sub', text: `${n0(m.drivers)} active this month` })));
  const out = [hero, odo];

  // members get their corner first
  if (S.member && (d.top?.length || d.recent?.length)) out.push(h('section', { class: 'sec' }, head('Driver corner', 'Only members can see this part.', '#/clasament', 'Full leaderboard'),
    d.top?.length ? podium(d.top, 'km') : null, d.recent?.length ? h('div', { class: 'bills', style: { marginTop: '22px' } }, d.recent.slice(0, 5).map(bill)) : null));

  out.push(h('section', { class: 'sec about', id: 'despre' },
    h('div', { class: 'about-copy rv' }, h('span', { class: 'eyebrow', text: 'About us' }), h('h2', { text: 'United by the road.' }), h('p', { text: S.cfg.about }),
      h('div', { class: 'links' }, S.cfg.discordInvite ? h('a', { class: 'btn ghost small', href: S.cfg.discordInvite, target: '_blank', rel: 'noopener' }, icon('discord', 16), 'Discord server') : null,
        S.cfg.tmpUrl ? h('a', { class: 'btn ghost small', href: S.cfg.tmpUrl, target: '_blank', rel: 'noopener' }, 'TruckersMP page', icon('out', 14)) : null)),
    h('div', { class: 'values' }, VALUES.map(([ic, t, x]) => h('article', { class: 'value rv' }, h('span', { class: 'vi' }, icon(ic, 22)), h('h3', { text: t }), h('p', { text: x }))))));

  if (d.next.length) out.push(h('section', { class: 'sec' }, head('Next convoy', 'Convoys are open to anyone who wants to get to know us.', '#/convoaie', 'All convoys'), h('div', { class: 'convoys' }, d.next.slice(0, 1).map((c) => convoyCard(c, false)))));

  if (S.cfg.ranks?.length) {
    const top = S.cfg.ranks[S.cfg.ranks.length - 1].km || 1;
    out.push(h('section', { class: 'sec' }, head('Ranks', 'Earned with delivered kilometres, not handed out.'),
      h('div', { class: 'ladder rv' }, h('i', { class: 'lane' }), S.cfg.ranks.map((rk, i) => h('div', { class: 'rung', style: { '--x': `${(Math.sqrt(rk.km / top) * 92 + 4).toFixed(1)}%`, '--i': i } },
        h('span', { class: 'pin' }, chevrons({ index: i })), h('b', { text: rk.name }), h('small', { class: 'num', text: i ? `${n0(rk.km)} km` : 'start' }))))));
  }

  out.push(h('section', { class: 'sec' }, head('How to join', 'Four steps, from the form to your first convoy.'),
    h('ol', { class: 'steps' }, STEPS.map(([t, x], i) => h('li', { class: 'step rv', style: { '--i': i } }, h('span', { class: 'no', text: String(i + 1).padStart(2, '0') }), h('h3', { text: t }), h('p', { text: x }))))));

  out.push(h('section', { class: 'sec reqs' },
    h('div', { class: 'rv' }, h('span', { class: 'eyebrow', text: 'What we ask' }), h('h2', { text: 'Not much, but we mean it.' }),
      h('ul', { class: 'checks' }, (S.cfg.requirements || []).map((x) => h('li', null, h('span', { class: 'ck' }, icon('check', 16)), x)))),
    h('div', { class: 'join rv' }, medallion(false), h('h3', { text: S.cfg.recruitOpen ? 'Ready to roll?' : 'Recruitment is closed' }),
      h('p', { text: S.cfg.recruitOpen ? 'Fill in the form and we will see you at the next convoy.' : 'Follow us on Discord: we announce it there when we reopen.' }),
      S.member ? h('a', { class: 'btn', href: '#/soferi' }, 'See the drivers') : S.cfg.recruitOpen ? h('a', { class: 'btn', href: '#/aplica' }, 'Apply now', icon('arrow', 18)) : S.cfg.discordInvite ? h('a', { class: 'btn', href: S.cfg.discordInvite, target: '_blank', rel: 'noopener' }, 'Join our Discord') : null)));

  out.push(h('section', { class: 'sec' }, head('FAQ'), h('div', { class: 'faq' }, FAQ.map(([q, a]) => h('details', { class: 'rv' }, h('summary', null, q, icon('chev', 18)), h('p', { text: a }))))));
  return out;
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
        h('div', { class: 'tile' }, h('b', { text: p.games.ATS > p.games.ETS2 ? 'ATS' : 'ETS2' }), h('span', { text: 'favourite game' }))),
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
    h('div', { class: 'toolbar' }, q, seg('period', [['week', 'This week'], ['month', 'This month'], ['all', 'All time']]), seg('game', [['', 'Both games'], ['ETS2', 'ETS2'], ['ATS', 'ATS']])),
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
  if (S.role) out.push(convoyForm());
  out.push(h('section', { class: 'sec' }, head('Upcoming'), up.length ? h('div', { class: 'convoys' }, up.map((c) => convoyCard(c, true))) : empty('No convoys planned', S.role ? 'Add one with the form above.' : 'Staff announce the next convoy here and on Discord.')));
  if (d.tmp.length) out.push(h('section', { class: 'sec' }, head('On TruckersMP', 'Events the company hosts or attends.'), h('div', { class: 'convoys' }, d.tmp.map((c) => convoyCard(c, false)))));
  if (past.length) out.push(h('section', { class: 'sec' }, head('Past convoys'), h('div', { class: 'convoys' }, past.map((c) => convoyCard(c, false)))));
  return out;
}
function convoyForm() {
  const f = {};
  const field = (k, label, attrs = {}) => { f[k] = h(attrs.tag || 'input', { class: 'field', id: `cv-${k}`, ...attrs, tag: undefined }); return h('div', null, h('label', { class: 'lab', for: `cv-${k}`, text: label }), f[k]); };
  const game = h('select', { class: 'field', id: 'cv-game' }, h('option', { value: 'ETS2' }, 'Euro Truck Simulator 2'), h('option', { value: 'ATS' }, 'American Truck Simulator'));
  const ann = h('input', { type: 'checkbox', checked: true });
  const box = h('details', { class: 'panel card sec' }, h('summary', { style: { cursor: 'pointer', fontWeight: 700 } }, 'Add a convoy'),
    h('div', { class: 'two' }, field('title', 'Title', { type: 'text', maxlength: 80, placeholder: 'For example: Friday night convoy' }), field('start', 'Date and time', { type: 'datetime-local' }), h('div', null, h('label', { class: 'lab', for: 'cv-game', text: 'Game' }), game), field('server', 'Server', { type: 'text', maxlength: 40, placeholder: 'Simulation 1' })),
    h('div', { class: 'two' }, field('from', 'Departure', { type: 'text', maxlength: 60, placeholder: 'Calais, Euroacres' }), field('to', 'Destination', { type: 'text', maxlength: 60, placeholder: 'Duisburg, Posped' }), field('meet', 'Meeting point', { type: 'text', maxlength: 80 }), field('dlc', 'Required DLC', { type: 'text', maxlength: 120, placeholder: 'None' })),
    field('desc', 'Details', { tag: 'textarea', maxlength: 1500 }), field('image', 'Image link, optional', { type: 'url', placeholder: 'https://' }),
    h('label', { class: 'check' }, ann, 'Announce it on Discord'),
    h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: async () => {
      const start = f.start.value ? new Date(f.start.value).getTime() : 0;
      await act('/api/convoys', { title: f.title.value, start, game: game.value, server: f.server.value, from: f.from.value, to: f.to.value, meet: f.meet.value, dlc: f.dlc.value, desc: f.desc.value, image: f.image.value, announce: ann.checked }, render);
    } }, icon('flag', 18), 'Add convoy')));
  return box;
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
  const ets = h('input', { type: 'checkbox', checked: true }), ats = h('input', { type: 'checkbox' }), rules = h('input', { type: 'checkbox' });
  return [head_,
    mine?.status === 'rejected' ? h('p', { class: 'muted sec', text: `Your last application was declined ${ago(mine.decided)}.${mine.note ? ` Reason: ${mine.note}` : ''}` }) : null,
    h('section', { class: 'panel card sec' },
      h('div', { class: 'two' }, h('div', null, h('label', { class: 'lab', for: 'ap-steam', text: 'Steam profile' }), steam), h('div', null, h('label', { class: 'lab', for: 'ap-tmp', text: 'TruckersMP profile, optional' }), tmp)),
      h('div', { class: 'two' }, h('div', null, h('label', { class: 'lab', for: 'ap-age', text: 'Age' }), age), h('div', null, h('label', { class: 'lab', for: 'ap-from', text: 'Where you are from' }), from), h('div', null, h('label', { class: 'lab', for: 'ap-hours', text: 'How much you play' }), hours)),
      h('p', { class: 'lab', style: { marginBottom: 0 }, text: 'What you play' }), h('div', { style: { display: 'flex', gap: '20px' } }, h('label', { class: 'check' }, ets, 'Euro Truck Simulator 2'), h('label', { class: 'check' }, ats, 'American Truck Simulator')),
      h('label', { class: 'lab', for: 'ap-why', text: 'About you' }), why,
      h('label', { class: 'check' }, rules, 'I agree to run Trucky on my jobs and to follow the company and TruckersMP rules.'),
      h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: () => act('/api/apply', { steam: steam.value, tmp: tmp.value, age: age.value, from: from.value, hours: hours.value, why: why.value, games: [ets.checked && 'ETS2', ats.checked && 'ATS'].filter(Boolean), rules: rules.checked }, render) }, icon('pen', 18), 'Send application')))];
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
  const rows = h('div', { class: 'rankrows' });
  const addRow = (r = { name: '', km: '' }) => { const row = h('div', null, h('input', { class: 'field', value: r.name, placeholder: 'Rank name', maxlength: 30, 'aria-label': 'Rank name' }), h('input', { class: 'field', type: 'number', min: 0, value: r.km, 'aria-label': 'Kilometres' }), h('button', { class: 'btn danger small', type: 'button', 'aria-label': 'Remove rank', onclick: () => row.remove() }, icon('x', 16))); rows.append(row); };
  c.ranks.forEach(addRow);
  const save_ = () => act('/api/config', { ...Object.fromEntries(Object.entries(F).map(([k, el]) => [k, el.value])), recruitOpen: open.checked, about: about.value, requirements: reqs.value.split('\n'), discordInvite: invite.value, ranks: [...rows.children].map((r) => ({ name: r.children[0].value, km: r.children[1].value })) }, boot);
  const lab = (el, t) => h('div', null, h('label', { class: 'lab', for: el.id, text: t }), el);
  const test = (el) => h('button', { class: 'btn ghost small', type: 'button', style: { marginTop: '8px' }, onclick: () => (el.value ? act('/api/test', { channel: el.value }) : toast('Pick a channel first.', true)) }, 'Send a test');
  return [
    h('section', { class: 'panel card sec' }, h('h2', { text: 'Company' }), h('div', { class: 'two' }, lab(F.name, 'Name'), lab(F.tag, 'Tag'), lab(F.tagline, 'Tagline')),
      h('div', { class: 'two' }, lab(F.truckyId, 'Trucky company ID'), lab(F.tmpId, 'TruckersMP VTC'), lab(F.minJobKm, 'Ignore jobs shorter than (km)')), h('label', { class: 'check' }, open, 'Recruitment open')),
    h('section', { class: 'panel card sec' }, h('h2', { text: 'Front page' }), h('p', { class: 'muted', text: 'What newcomers see on the home page.' }), lab(about, 'About us'), lab(reqs, 'Requirements, one per line'), lab(invite, 'Discord server invite')),
    h('section', { class: 'panel card sec' }, h('h2', { text: 'Discord channels' }), chans.length ? null : h('p', { class: 'muted', text: 'No channels the bot can post in (it needs View Channel, Send Messages, Embed Links).' }),
      h('div', { class: 'two' }, h('div', null, lab(F.jobsChannel, 'Deliveries and rank-ups'), test(F.jobsChannel)), h('div', null, lab(F.convoyChannel, 'Convoys'), test(F.convoyChannel)), h('div', null, lab(F.staffChannel, 'Applications (staff)'), test(F.staffChannel)))),
    h('section', { class: 'panel card sec' }, h('h2', { text: 'Ranks' }), h('p', { class: 'muted', text: 'Total kilometres needed for each rank. The first one starts at 0.' }), rows, h('div', { class: 'actions' }, h('button', { class: 'btn ghost small', type: 'button', onclick: () => addRow() }, 'Add a rank'))),
    h('p', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: save_ }, 'Save settings'))];
}

// ---- shell ----
const TABS = [['', 'Home', 'home'], ['soferi', 'Drivers', 'users'], ['curse', 'Jobs', 'truck'], ['clasament', 'Leaderboard', 'trophy'], ['convoaie', 'Convoys', 'flag']];
const PAGES = { '': pageHome, soferi: pageDrivers, curse: pageJobs, clasament: pageBoard, convoaie: pageConvoys, aplica: pageApply, cont: pageAccount, staff: pageStaff };
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
      !S.member && S.cfg.recruitOpen ? h('a', { href: '#/aplica' }, icon('pen', 18), 'Apply') : null, S.role ? h('a', { href: '#/staff' }, icon('gear', 18), 'Staff') : null, h('a', { href: '/auth/logout' }, icon('exit', 18), 'Log out'));
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
  document.title = page ? `${(TABS.find((t) => t[0] === page) || [0, { aplica: 'Apply', cont: 'My account', staff: 'Staff' }[page]])[1]} · ${S.cfg.name}` : S.cfg.name;
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
intro();
async function boot() {
  const r = await api('/api/me').catch(() => null);
  if (r?.ok) Object.assign(S, { user: r.data.user, role: r.data.role, member: !!r.data.member, cfg: r.data.cfg, login: r.data.login, driver: r.data.driver });
  $('.brand-name').textContent = S.cfg.name;
  await render();
}
boot();
