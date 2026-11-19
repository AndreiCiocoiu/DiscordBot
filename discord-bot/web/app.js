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
};
const icon = (n, s = 20) => svg('svg', { class: 'ico', viewBox: '0 0 24 24', width: s, height: s, 'aria-hidden': 'true' }, svg('path', { d: ICONS[n].replace(/(\d)\.(\d)00/g, '$1.$2') }));

const S = { user: null, role: null, cfg: { name: 'Diesel Union', ranks: [] }, login: false, driver: null, anim: true };
let cleanups = [];
async function api(path, body) {
  const res = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  let data = {}; try { data = await res.json(); } catch { /* not JSON */ }
  return { ok: res.ok, status: res.status, data };
}
let tt;
function toast(msg, bad) { const t = $('#toast'); t.textContent = msg; t.className = `toast${bad ? ' bad' : ''}`; t.hidden = false; t.style.animation = 'none'; void t.offsetWidth; t.style.animation = ''; clearTimeout(tt); tt = setTimeout(() => { t.hidden = true; }, bad ? 5200 : 3600); }
async function act(path, body, after) { const r = await api(path, body); toast(r.data.msg || r.data.error || 'Ceva nu a mers.', !r.ok); if (r.ok && after) await after(r.data); return r.ok; }

const n0 = (v) => Math.round(v || 0).toLocaleString('ro-RO');
const kmS = (v) => `${n0(v)} km`;
const cash = (v, game) => `${n0(v)} ${game === 'ATS' ? '$' : '€'}`;
const dateL = (ms) => new Date(ms).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' });
const timeL = (ms) => new Date(ms).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
function ago(ms) { if (!ms) return ''; const m = Math.round((Date.now() - ms) / 60000); if (m < 1) return 'acum'; if (m < 60) return `acum ${m} min`; if (m < 1440) return `acum ${Math.round(m / 60)} h`; const d = Math.round(m / 1440); return d < 30 ? `acum ${d} ${d === 1 ? 'zi' : 'zile'}` : dateL(ms); }
function until(ms) { let s = Math.max(0, Math.floor((ms - Date.now()) / 1000)); const d = Math.floor(s / 86400); s -= d * 86400; const p = (x) => String(x).padStart(2, '0'); return `${d ? `${d}z ` : ''}${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`; }
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
const empty = (title, text, action) => h('div', { class: 'empty' }, h('b', { text: title }), text, action || null);
const head = (title, sub, href, more) => h('div', { class: 'sec-head' }, h('h2', { text: title }), sub ? h('p', { text: sub }) : null, href ? h('a', { class: 'more', href, text: more || 'Vezi tot' }) : null);
const loginBtn = (txt) => (S.login ? h('a', { class: 'btn', href: '/auth/login' }, txt || 'Intră cu Discord') : h('p', { class: 'muted', text: 'Login-ul cu Discord nu e configurat încă.' }));

// ---- the night highway behind the hero ----
function highway(cv) {
  const ctx = cv.getContext('2d'); let W = 0, H = 0, dpr = 1, raf = 0, run = false, t0 = performance.now(), mx = 0, tmx = 0;
  const poles = Array.from({ length: 10 }, (_, i) => i / 10);
  const hills = Array.from({ length: 3 }, (_, k) => Array.from({ length: 40 }, (_, i) => Math.sin(i * (0.5 + k * 0.23) + k * 2) * 0.5 + Math.sin(i * 1.7 + k) * 0.25));
  const stars = Array.from({ length: 70 }, () => [Math.random(), Math.random() * 0.4, Math.random()]);
  function size() { dpr = Math.min(devicePixelRatio || 1, 2); W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); draw(performance.now()); }
  function draw(now) {
    const t = (now - t0) / 1000; mx += (tmx - mx) * 0.05;
    const hz = H * 0.5, vx = W * (W < 700 ? 0.5 : 0.66) + mx * 40;
    const sky = ctx.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0, '#120b07'); sky.addColorStop(0.6, '#3a1f10'); sky.addColorStop(1, '#a4521e');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, hz + 1);
    for (const [x, y, p] of stars) { ctx.globalAlpha = 0.25 + 0.35 * Math.abs(Math.sin(t * 0.8 + p * 9)); ctx.fillStyle = '#f3e6d0'; ctx.fillRect(x * W, y * hz, 1.4, 1.4); }
    ctx.globalAlpha = 1;
    const sun = ctx.createRadialGradient(vx, hz, 0, vx, hz, W * 0.45);
    sun.addColorStop(0, 'rgba(255,170,80,.55)'); sun.addColorStop(0.25, 'rgba(230,120,40,.18)'); sun.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sun; ctx.fillRect(0, 0, W, hz + 2);
    hills.forEach((hl, k) => {
      ctx.fillStyle = ['#3b2414', '#2b190e', '#1d1109'][k];
      ctx.beginPath(); ctx.moveTo(0, hz);
      const shift = (mx * (k + 1) * 14) - 20;
      for (let i = 0; i < hl.length; i++) ctx.lineTo((i / (hl.length - 1)) * (W + 40) + shift, hz - (12 + k * 10) - hl[i] * (14 + k * 10));
      ctx.lineTo(W + 40, hz); ctx.closePath(); ctx.fill();
    });
    const ground = ctx.createLinearGradient(0, hz, 0, H);
    ground.addColorStop(0, '#1a0f08'); ground.addColorStop(1, '#0d0805');
    ctx.fillStyle = ground; ctx.fillRect(0, hz, W, H - hz);
    // road
    const bw = W * 1.5, bx = vx - bw / 2 - mx * 60;
    ctx.fillStyle = '#17110c';
    ctx.beginPath(); ctx.moveTo(vx - 4, hz); ctx.lineTo(vx + 4, hz); ctx.lineTo(bx + bw, H); ctx.lineTo(bx, H); ctx.closePath(); ctx.fill();
    const lerp = (a, b, k) => a + (b - a) * k;
    const at = (z, side) => { const k = z * z; return [lerp(vx + side * 4, side < 0 ? bx : bx + bw, k), lerp(hz, H, k)]; };
    ctx.strokeStyle = 'rgba(243,230,208,.35)'; ctx.lineWidth = 2;
    for (const side of [-0.92, 0.92]) { ctx.beginPath(); const a = at(0, side), b = at(1, side); ctx.moveTo(vx + side * 4, hz); ctx.lineTo(lerp(vx, side < 0 ? bx : bx + bw, 1) * 0.92 + vx * 0.08, H); ctx.stroke(); }
    // lane dashes coming at us
    const speed = REDUCED ? 0 : 0.45;
    for (let i = 0; i < 14; i++) {
      const z1 = ((i / 14 + t * speed) % 1), z2 = Math.min(1, z1 + 0.035);
      const [x1, y1] = [lerp(vx, vx + (bx + bw / 2 - vx), z1 * z1), lerp(hz, H, z1 * z1)];
      const [x2, y2] = [lerp(vx, vx + (bx + bw / 2 - vx), z2 * z2), lerp(hz, H, z2 * z2)];
      const w1 = 1 + z1 * z1 * 14, w2 = 1 + z2 * z2 * 14;
      ctx.fillStyle = `rgba(242,160,61,${0.25 + z1 * 0.7})`;
      ctx.beginPath(); ctx.moveTo(x1 - w1 / 2, y1); ctx.lineTo(x1 + w1 / 2, y1); ctx.lineTo(x2 + w2 / 2, y2); ctx.lineTo(x2 - w2 / 2, y2); ctx.closePath(); ctx.fill();
    }
    // reflector poles on both sides
    for (const p of poles) {
      const z = (p + t * speed * 0.5) % 1, k = z * z;
      for (const side of [-1, 1]) {
        const x = lerp(vx + side * 6, side < 0 ? bx - W * 0.05 : bx + bw + W * 0.05, k), y = lerp(hz, H, k), ph = 4 + k * 70;
        ctx.fillStyle = `rgba(30,20,12,${0.4 + k})`; ctx.fillRect(x - (1 + k * 3) / 2, y - ph, 1 + k * 3, ph);
        ctx.fillStyle = side < 0 ? `rgba(255,120,60,${0.3 + k})` : `rgba(255,220,150,${0.3 + k})`; ctx.fillRect(x - (1 + k * 3) / 2, y - ph, 1 + k * 3, 2 + k * 6);
      }
    }
    // a truck ahead: two tail lights and a trailer silhouette
    const tz = 0.32 + Math.sin(t * 0.3) * 0.015, tk = tz * tz, tx = lerp(vx, vx + (bx + bw * 0.62 - vx), tk), ty = lerp(hz, H, tk), tw = 14 + tk * 160, th = tw * 0.75;
    ctx.fillStyle = '#0e0905'; ctx.fillRect(tx - tw / 2, ty - th, tw, th);
    for (const s of [-1, 1]) {
      const lx = tx + s * tw * 0.42, ly = ty - th * 0.12, g = ctx.createRadialGradient(lx, ly, 0, lx, ly, tw * 0.4);
      g.addColorStop(0, 'rgba(255,60,40,.9)'); g.addColorStop(1, 'rgba(255,40,20,0)');
      ctx.fillStyle = g; ctx.fillRect(lx - tw * 0.4, ly - tw * 0.4, tw * 0.8, tw * 0.8);
      ctx.fillStyle = '#ff5a3c'; ctx.fillRect(lx - tw * 0.05, ly - 2, tw * 0.1, 3);
    }
    // our own headlights on the road
    const hl = ctx.createRadialGradient(bx + bw / 2, H * 1.1, 0, bx + bw / 2, H * 1.1, H * 0.7);
    hl.addColorStop(0, 'rgba(255,225,170,.22)'); hl.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = hl; ctx.fillRect(0, hz, W, H - hz);
  }
  function loop(now) { if (!run) return; draw(now); raf = requestAnimationFrame(loop); }
  const set = (v) => { if (v && !run && !REDUCED) { run = true; raf = requestAnimationFrame(loop); } else if (!v) { run = false; cancelAnimationFrame(raf); } };
  const io = new IntersectionObserver(([e]) => set(e.isIntersecting && !document.hidden)); io.observe(cv);
  const vis = () => set(!document.hidden); document.addEventListener('visibilitychange', vis);
  const pm = (e) => { tmx = e.clientX / innerWidth - 0.5; }; addEventListener('pointermove', pm, { passive: true });
  const ro = new ResizeObserver(size); ro.observe(cv);
  cleanups.push(() => { set(false); io.disconnect(); ro.disconnect(); document.removeEventListener('visibilitychange', vis); removeEventListener('pointermove', pm); });
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
    h('div', { class: 'm num' }, cash(j.income, j.game), h('small', { text: `avarii ${j.dmg}%` })));
}
function convoyCard(c, full) {
  const d = new Date(c.start), soon = c.start - Date.now();
  const card = h('article', { class: `convoy panel rv${c.image ? ' has-img' : ''}`, style: c.image ? { '--img': `url("${String(c.image).replace(/["\\\n]/g, '')}")` } : null },
    h('div', { class: 'date' }, h('b', { text: d.getDate() }), h('span', { text: d.toLocaleDateString('ro-RO', { month: 'short' }).replace('.', '') }), h('small', { text: timeL(c.start) })),
    h('div', null,
      h('h3', null, c.title, c.tmp ? h('span', { class: 'badge-tmp', text: c.kind === 'host' ? 'TruckersMP' : 'Participăm' }) : null),
      (c.from || c.to) ? h('div', { class: 'route' }, h('span', { text: c.from || '?' }), h('i'), h('span', { text: c.to || '?' })) : null,
      h('div', { class: 'facts' },
        soon > 0 ? h('span', null, icon('clock', 16), 'Pornim în ', h('span', { class: 'count', 'data-until': c.start, text: until(c.start) })) : h('span', null, icon('clock', 16), soon > -3 * 3600_000 ? 'E pe drum acum' : 'S-a încheiat'),
        c.server ? h('span', null, icon('server', 16), c.server) : null, c.meet ? h('span', null, icon('pin', 16), c.meet) : null, h('span', { class: `game ${c.game}`, text: c.game })),
      full && c.dlc ? h('p', { class: 'desc', text: `DLC: ${c.dlc}` }) : null,
      full && c.desc ? h('p', { class: 'desc', text: c.desc }) : null),
    h('div', { class: 'rsvp' },
      c.tmp ? h('a', { class: 'btn ghost small', href: c.link, target: '_blank', rel: 'noopener' }, 'Vezi pe TruckersMP', icon('out', 16))
        : [faces(c), soon > -3 * 3600_000 ? rsvpButtons(c) : null, S.role && full ? h('button', { class: 'btn danger small', type: 'button', onclick: () => { if (confirm(`Ștergi convoiul „${c.title}”?`)) act('/api/convoys/remove', { id: c.id }, render); } }, 'Șterge') : null]));
  return card;
}
function faces(c) {
  if (!c.yes?.length && !c.maybe) return h('span', { class: 'muted small', text: 'Nimeni confirmat încă' });
  return h('div', { class: 'faces' }, c.yes.slice(0, 6).map((p) => av(p.avatar, p.name)), h('span', { class: 'more', text: `${c.yes.length} vin${c.maybe ? `, ${c.maybe} poate` : ''}` }));
}
function rsvpButtons(c) {
  if (!S.user) return S.login ? h('a', { class: 'btn small', href: '/auth/login' }, 'Intră ca să confirmi') : null;
  const opts = [['yes', 'Vin'], ['maybe', 'Poate'], ['no', 'Nu vin']];
  return h('div', { class: 'seg', role: 'group', 'aria-label': 'Vii la convoi?' }, opts.map(([k, l]) => h('button', { type: 'button', 'aria-pressed': String(c.mine === k), onclick: () => act('/api/rsvp', { id: c.id, status: k }, render) }, l)));
}

// ---- pages ----
async function pageHome() {
  const r = await api('/api/home');
  if (!r.ok) return [empty('Nu se încarcă', 'Portalul nu răspunde acum. Reîncarcă pagina peste un minut.')];
  const d = r.data, cv = h('canvas', { 'aria-hidden': 'true' });
  const hero = h('section', { class: 'hero' }, cv,
    h('div', { class: 'hero-in' },
      h('span', { class: 'kick' }, h('i'), `VTC pe TruckersMP${S.cfg.tag ? ` · [${S.cfg.tag}]` : ''}`),
      h('h1', { 'aria-label': S.cfg.name }, ...splitName(S.cfg.name)),
      h('p', { class: 'tagline', text: S.cfg.tagline }),
      h('div', { class: 'cta' }, S.cfg.recruitOpen ? h('a', { class: 'btn', href: '#/aplica' }, 'Aplică în VTC', icon('arrow', 18)) : null, h('a', { class: 'btn ghost', href: '#/convoaie' }, 'Vezi convoaiele'))));
  setTimeout(() => highway(cv), 0);
  const m = d.tot.month;
  const odo = h('section', { class: 'odo', 'aria-label': 'Luna asta' },
    h('div', null, h('div', { class: 'lbl', text: 'Kilometri luna asta' }), h('div', { style: { display: 'flex' } }, odometer(m.km, 6), h('span', { class: 'unit', text: 'km' })), h('div', { class: 'sub', text: `${kmS(d.tot.all.km)} de la început` })),
    h('div', null, h('div', { class: 'lbl', text: 'Curse livrate' }), odometer(m.jobs, 3), h('div', { class: 'sub', text: `${n0(d.tot.week.jobs)} săptămâna asta` })),
    h('div', null, h('div', { class: 'lbl', text: 'Tone transportate' }), odometer(m.mass / 1000, 4), h('div', { class: 'sub', text: 'luna asta' })),
    h('div', null, h('div', { class: 'lbl', text: 'Șoferi activi' }), odometer(m.drivers, 2), h('div', { class: 'sub', text: `din ${d.drivers} în VTC` })));
  const out = [hero, odo];
  if (d.next.length) out.push(h('section', { class: 'sec' }, head('Următorul convoi', null, '#/convoaie', 'Toate convoaiele'), h('div', { class: 'convoys' }, d.next.slice(0, 1).map((c) => convoyCard(c, false)))));
  if (d.top.length) out.push(h('section', { class: 'sec' }, head('Topul lunii', 'După kilometri parcurși.', '#/clasament', 'Clasamentul complet'), podium(d.top, 'km')));
  out.push(h('section', { class: 'sec livefeed' }, head('Ultimele livrări', null, '#/curse', 'Toate cursele'),
    d.recent.length ? h('div', { class: 'bills' }, d.recent.map(bill)) : empty('Nicio cursă încă', 'Cursele apar aici imediat ce un șofer livrează cu Trucky pornit.'),
    h('p', { class: 'small muted', style: { marginTop: '12px' } }, h('span', { class: 'dot' }), d.synced ? `Sincronizat cu Trucky ${ago(d.synced)}` : 'Așteptăm prima sincronizare cu Trucky.')));
  return out;
}
function splitName(name) {
  const w = String(name || '').trim().split(/\s+/);
  if (w.length < 2) return [h('span', { class: 'a', text: name })];
  return [h('span', { class: 'a', text: w.slice(0, Math.ceil(w.length / 2)).join(' ') }), h('span', { class: 'b', text: w.slice(Math.ceil(w.length / 2)).join(' ') })];
}
function podium(rows, metric) {
  const fmt = (r) => (metric === 'km' ? kmS(r.v) : metric === 'jobs' ? plural(r.v, 'cursă', 'curse') : n0(r.v));
  return h('div', { class: 'podium' }, rows.slice(0, 3).map((r, i) => h('button', { class: `place p${i + 1}`, type: 'button', onclick: () => openDriver(r.id) },
    av(r.avatar, r.name), h('span', { class: 'nm', text: r.name }), h('span', { class: 'val num', text: fmt(r) }), h('span', { class: 'rk' }, chevrons(r.rank), ' ', r.rank?.name || ''), h('span', { class: 'plinth', text: i + 1 }))));
}

async function pageDrivers() {
  const r = await api('/api/drivers'), list = r.ok ? r.data.drivers : [];
  const grid = h('div', { class: 'drivers' });
  const q = h('input', { class: 'field', type: 'search', placeholder: 'Caută un șofer', 'aria-label': 'Caută un șofer' });
  let sort = 'km';
  const paint = () => {
    const t = q.value.trim().toLowerCase();
    const rows = list.filter((d) => !t || d.name.toLowerCase().includes(t)).sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) : sort === 'joined' ? (a.joined || 0) - (b.joined || 0) : b[sort] - a[sort]));
    grid.replaceChildren(...rows.map((d) => {
      const next = d.rank.next, k = next ? (d.km - d.rank.from) / (next.km - d.rank.from) : 1;
      return h('button', { class: 'driver rv', type: 'button', onclick: () => openDriver(d.id) },
        av(d.avatar, d.name), h('div', null, h('b', { text: d.name }), h('span', { class: 'rk' }, chevrons(d.rank), d.rank.name, d.role ? ` · ${d.role}` : '')),
        h('div', { class: 'kms' }, h('span', null, h('b', { class: 'num', text: n0(d.km) }), ' km'), h('span', { text: d.monthKm ? `+${n0(d.monthKm)} luna asta` : d.joined ? `din ${new Date(d.joined).toLocaleDateString('ro-RO', { month: 'short', year: 'numeric' })}` : '' })),
        h('span', { class: 'prog', title: next ? `${kmS(next.km - d.km)} până la ${next.name}` : 'Rangul maxim' }, h('i', { style: { width: `${Math.round(Math.min(1, Math.max(0.02, k)) * 100)}%` } })));
    }));
    if (!rows.length) grid.replaceChildren(empty(list.length ? 'Niciun șofer cu numele ăsta' : 'Niciun șofer încă', list.length ? 'Încearcă alt nume.' : 'Lista se umple singură din Trucky.'));
    reveal(grid);
  };
  q.addEventListener('input', paint);
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Ordonează' }, [['km', 'Kilometri'], ['monthKm', 'Luna asta'], ['joined', 'Vechime'], ['name', 'Nume']].map(([k, l]) => h('button', { type: 'button', 'aria-pressed': String(sort === k), onclick: (e) => { sort = k; for (const b of e.currentTarget.parentNode.children) b.setAttribute('aria-pressed', String(b === e.currentTarget)); paint(); } }, l)));
  paint();
  return [h('div', { class: 'pagehead' }, h('h1', { text: 'Șoferi' }), h('p', { text: `${plural(list.length, 'șofer', 'șoferi')} în ${S.cfg.name}. Rangul crește cu fiecare kilometru livrat cu Trucky.` })),
    h('div', { class: 'toolbar' }, q, seg), grid,
    h('section', { class: 'sec' }, head('Rangurile', 'Se urcă automat după kilometrii totali.'), h('div', { class: 'ranks' }, S.cfg.ranks.map((rk, i) => h('div', { class: 'rrow', style: { cursor: 'default', gridTemplateColumns: '40px minmax(0,1fr) auto' } }, h('span', { class: 'pos' }, chevrons({ index: i })), h('span', { class: 'nm', text: rk.name }), h('span', { class: 'v num', text: i ? `${n0(rk.km)} km` : 'start' })))))];
}

async function openDriver(id) {
  const dr = $('#drawer');
  dr.replaceChildren(h('div', { class: 'in' }, skel(3, 90))); dr.hidden = false; $('#scrim').hidden = false; document.body.classList.add('lock');
  if (location.hash !== `#/soferi/${id}`) history.replaceState(null, '', `#/soferi/${id}`);
  const r = await api(`/api/driver?id=${encodeURIComponent(id)}`);
  if (dr.hidden) return;
  if (!r.ok) { dr.replaceChildren(h('button', { class: 'x', type: 'button', 'aria-label': 'Închide', onclick: closeDrawer }, icon('x', 18)), h('div', { class: 'in' }, empty('Șoferul nu există', 'Poate a plecat din VTC.'))); return; }
  const p = r.data, next = p.rank.next, k = next ? (p.km - p.rank.from) / (next.km - p.rank.from) : 1;
  const max = Math.max(1, ...p.months.map((m) => m.km)), W = 460, H = 150, bw = W / p.months.length;
  const chart = svg('svg', { class: 'chart', viewBox: `0 0 ${W} ${H + 24}`, role: 'img', 'aria-label': 'Kilometri în ultimele șase luni' },
    p.months.map((m, i) => { const hh = Math.max(2, (m.km / max) * H); return [svg('rect', { x: i * bw + 10, y: H - hh, width: bw - 20, height: hh, rx: 5, fill: i === p.months.length - 1 ? '#f2a03d' : '#8a5a2b', style: { '--i': i } }), svg('text', { x: i * bw + bw / 2, y: H + 18, 'text-anchor': 'middle', text: m.label }), m.km ? svg('text', { x: i * bw + bw / 2, y: H - hh - 6, 'text-anchor': 'middle', text: n0(m.km) }) : null]; }));
  dr.replaceChildren(
    h('button', { class: 'x', type: 'button', 'aria-label': 'Închide', onclick: closeDrawer }, icon('x', 18)),
    h('div', { class: 'in' },
      h('div', { class: 'prof' }, av(p.avatar, p.name), h('div', null, h('h2', { text: p.name }), h('div', { class: 'rk' }, chevrons(p.rank), p.rank.name, p.role ? h('span', { class: 'muted', text: `· ${p.role}` }) : null))),
      h('p', { class: 'muted small', text: [p.joined ? `În VTC din ${dateL(p.joined)}` : null, p.last ? `ultima cursă ${ago(p.last)}` : null].filter(Boolean).join(', ') }),
      h('div', { class: 'tiles' },
        h('div', { class: 'tile' }, h('b', { class: 'num', text: n0(p.km) }), h('span', { text: 'km în total' })),
        h('div', { class: 'tile' }, h('b', { class: 'num', text: n0(p.jobs) }), h('span', { text: 'curse livrate' })),
        h('div', { class: 'tile' }, h('b', { class: 'num', text: n0(p.month?.km || 0) }), h('span', { text: 'km luna asta' })),
        h('div', { class: 'tile' }, h('b', { class: 'num', text: `${p.avgDmg}%` }), h('span', { text: 'avarii medii' })),
        h('div', { class: 'tile' }, h('b', { class: 'num', text: p.longest ? n0(p.longest.km) : '0' }), h('span', { text: 'cea mai lungă cursă' })),
        h('div', { class: 'tile' }, h('b', { text: p.games.ATS > p.games.ETS2 ? 'ATS' : 'ETS2' }), h('span', { text: 'jocul preferat' }))),
      h('div', { class: 'next' }, next ? [h('b', { text: `${kmS(next.km - p.km)} până la ${next.name}` }), h('span', { class: 'prog' }, h('i', { style: { width: `${Math.round(Math.max(0.02, k) * 100)}%` } }))] : h('b', { text: 'A ajuns la cel mai mare rang.' })),
      h('h3', { text: 'Ultimele șase luni' }), chart,
      p.fav ? h('p', { class: 'muted small', text: `Livrează cel mai des în ${p.fav}.` }) : null,
      h('h3', { text: 'Ultimele curse' }),
      p.recent.length ? h('div', { class: 'mini' }, p.recent.map((j) => h('div', { class: 'bill' }, h('div', { class: 'way' }, h('div', { class: 'r' }, h('span', { text: j.from }), icon('arrow', 14), h('span', { text: j.to })), h('div', { class: 'c', text: `${j.cargo} · ${ago(j.end)}` })), h('div', { class: 'k num' }, n0(j.km), h('small', { text: 'km' }))))) : h('p', { class: 'muted', text: 'Nicio cursă încă.' })));
}
function closeDrawer() { $('#drawer').hidden = true; $('#scrim').hidden = true; document.body.classList.remove('lock'); if (/^#\/soferi\/./.test(location.hash)) history.replaceState(null, '', '#/soferi'); }

async function pageJobs() {
  const F = { period: 'month', game: '', q: '', page: 0 };
  const list = h('div', { class: 'bills' }), summary = h('p', { class: 'muted' }), more = h('button', { class: 'btn ghost', type: 'button', hidden: true, onclick: () => load(false) }, 'Mai multe curse');
  let tok = 0;
  async function load(reset) {
    if (reset) { F.page = 0; list.replaceChildren(...skel(5, 64)); }
    const my = ++tok, p = new URLSearchParams({ period: F.period, page: F.page }); if (F.game) p.set('game', F.game); if (F.q) p.set('q', F.q);
    const r = await api(`/api/jobs?${p}`); if (my !== tok) return;
    if (reset) list.replaceChildren();
    const d = r.ok ? r.data : { jobs: [], total: 0, km: 0, pages: 0 };
    list.append(...d.jobs.map(bill)); reveal(list);
    summary.textContent = d.total ? `${plural(d.total, 'cursă', 'curse')}, ${kmS(d.km)} în total.` : '';
    if (!d.total) list.replaceChildren(empty('Nicio cursă', 'Nu e nicio cursă livrată cu filtrele astea.'));
    F.page++; more.hidden = F.page >= d.pages;
  }
  const seg = (key, opts) => h('div', { class: 'seg', role: 'group' }, opts.map(([v, l]) => h('button', { type: 'button', 'aria-pressed': String(F[key] === v), onclick: (e) => { F[key] = v; for (const b of e.currentTarget.parentNode.children) b.setAttribute('aria-pressed', String(b === e.currentTarget)); load(true); } }, l)));
  let t; const q = h('input', { class: 'field', type: 'search', placeholder: 'Oraș, marfă sau șofer', 'aria-label': 'Caută în curse', oninput: () => { clearTimeout(t); t = setTimeout(() => { F.q = q.value.trim(); load(true); }, 300); } });
  load(true);
  return [h('div', { class: 'pagehead' }, h('h1', { text: 'Curse' }), h('p', { text: 'Fiecare livrare a VTC-ului, cum a venit din Trucky.' })),
    h('div', { class: 'toolbar' }, q, seg('period', [['week', 'Săptămâna asta'], ['month', 'Luna asta'], ['all', 'Toate']]), seg('game', [['', 'Ambele jocuri'], ['ETS2', 'ETS2'], ['ATS', 'ATS']])),
    summary, list, h('p', { style: { textAlign: 'center', marginTop: '18px' } }, more)];
}

async function pageBoard() {
  const F = { period: 'month', metric: 'km' };
  const body = h('div');
  async function load() {
    body.replaceChildren(...skel(2, 160));
    const r = await api(`/api/board?period=${F.period}&metric=${F.metric}`), rows = r.ok ? r.data.rows : [];
    if (!rows.length) return body.replaceChildren(h('div', { class: 'sec' }, empty('Nicio cursă încă', 'Clasamentul se umple cu prima livrare din perioada asta.')));
    const max = rows[0].v, fmt = (v) => (F.metric === 'km' ? kmS(v) : F.metric === 'jobs' ? n0(v) : n0(v));
    body.replaceChildren(h('div', { class: 'sec anim' }, podium(rows, F.metric)),
      h('div', { class: 'ranks' }, rows.slice(3).map((r, i) => h('button', { class: 'rrow rv', type: 'button', onclick: () => openDriver(r.id) },
        h('span', { class: 'pos num', text: i + 4 }), av(r.avatar, r.name), h('span', { class: 'nm' }, r.name, h('small', { text: `${r.rank?.name || ''} · ${plural(r.jobsP, 'cursă', 'curse')}` })),
        h('span', { class: 'bar' }, h('i', { style: { width: `${Math.max(2, (r.v / max) * 100)}%` } })), h('span', { class: 'v num', text: fmt(r.v) })))));
    reveal(body);
  }
  const seg = (key, opts) => h('div', { class: 'seg', role: 'group' }, opts.map(([v, l]) => h('button', { type: 'button', 'aria-pressed': String(F[key] === v), onclick: (e) => { F[key] = v; for (const b of e.currentTarget.parentNode.children) b.setAttribute('aria-pressed', String(b === e.currentTarget)); load(); } }, l)));
  load();
  return [h('div', { class: 'pagehead' }, h('h1', { text: 'Clasament' }), h('p', { text: 'Săptămâna începe luni, luna pe 1, după ora României.' })),
    h('div', { class: 'toolbar' }, seg('period', [['week', 'Săptămâna asta'], ['month', 'Luna asta'], ['all', 'Total']]), seg('metric', [['km', 'Kilometri'], ['income', 'Venit'], ['jobs', 'Curse']])), body];
}

async function pageConvoys() {
  const r = await api('/api/convoys'), d = r.ok ? r.data : { convoys: [], tmp: [] };
  const up = d.convoys.filter((c) => c.start > Date.now() - 3 * 3600_000), past = d.convoys.filter((c) => c.start <= Date.now() - 3 * 3600_000).reverse().slice(0, 6);
  const out = [h('div', { class: 'pagehead' }, h('h1', { text: 'Convoaie' }), h('p', { text: 'Ieșim împreună pe drum. Confirmă dacă vii și botul îți amintește cu o oră înainte, pe Discord.' }))];
  if (S.role) out.push(convoyForm());
  out.push(h('section', { class: 'sec' }, head('Programate'), up.length ? h('div', { class: 'convoys' }, up.map((c) => convoyCard(c, true))) : empty('Niciun convoi programat', S.role ? 'Adaugă unul din formularul de mai sus.' : 'Staff-ul anunță următorul convoi aici și pe Discord.')));
  if (d.tmp.length) out.push(h('section', { class: 'sec' }, head('Pe TruckersMP', 'Evenimente organizate sau la care participă VTC-ul.'), h('div', { class: 'convoys' }, d.tmp.map((c) => convoyCard(c, false)))));
  if (past.length) out.push(h('section', { class: 'sec' }, head('Au fost'), h('div', { class: 'convoys' }, past.map((c) => convoyCard(c, false)))));
  return out;
}
function convoyForm() {
  const f = {};
  const field = (k, label, attrs = {}) => { f[k] = h(attrs.tag || 'input', { class: 'field', id: `cv-${k}`, ...attrs, tag: undefined }); return h('div', null, h('label', { class: 'lab', for: `cv-${k}`, text: label }), f[k]); };
  const game = h('select', { class: 'field', id: 'cv-game' }, h('option', { value: 'ETS2' }, 'Euro Truck Simulator 2'), h('option', { value: 'ATS' }, 'American Truck Simulator'));
  const ann = h('input', { type: 'checkbox', checked: true });
  const box = h('details', { class: 'panel card sec' }, h('summary', { style: { cursor: 'pointer', fontWeight: 700 } }, 'Adaugă un convoi'),
    h('div', { class: 'two' }, field('title', 'Titlu', { type: 'text', maxlength: 80, placeholder: 'De exemplu: Convoiul de vineri' }), field('start', 'Data și ora', { type: 'datetime-local' }), h('div', null, h('label', { class: 'lab', for: 'cv-game', text: 'Joc' }), game), field('server', 'Server', { type: 'text', maxlength: 40, placeholder: 'Simulation 1' })),
    h('div', { class: 'two' }, field('from', 'Plecare', { type: 'text', maxlength: 60, placeholder: 'Calais, Euroacres' }), field('to', 'Destinație', { type: 'text', maxlength: 60, placeholder: 'Duisburg, Posped' }), field('meet', 'Loc de întâlnire', { type: 'text', maxlength: 80 }), field('dlc', 'DLC necesar', { type: 'text', maxlength: 120, placeholder: 'Niciunul' })),
    field('desc', 'Detalii', { tag: 'textarea', maxlength: 1500 }), field('image', 'Imagine (link), opțional', { type: 'url', placeholder: 'https://' }),
    h('label', { class: 'check' }, ann, 'Anunță convoiul pe Discord'),
    h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: async () => {
      const start = f.start.value ? new Date(f.start.value).getTime() : 0;
      await act('/api/convoys', { title: f.title.value, start, game: game.value, server: f.server.value, from: f.from.value, to: f.to.value, meet: f.meet.value, dlc: f.dlc.value, desc: f.desc.value, image: f.image.value, announce: ann.checked }, render);
    } }, icon('flag', 18), 'Adaugă convoiul')));
  return box;
}

async function pageApply() {
  const head_ = h('div', { class: 'pagehead' }, h('h1', { text: 'Aplică' }), h('p', { text: `Vrei să conduci cu ${S.cfg.name}? Completează formularul și staff-ul îți răspunde pe Discord.` }));
  if (!S.user) return [head_, h('div', { class: 'sec' }, empty('Intră cu Discord', 'Ca să știm cui să răspundem.', loginBtn()))];
  if (S.driver) return [head_, h('div', { class: 'sec' }, empty('Ești deja în VTC', `Contul tău e legat de ${S.driver.name}.`, h('a', { class: 'btn ghost', href: `#/soferi/${S.driver.id}` }, 'Vezi profilul tău')))];
  const r = await api('/api/apply'), mine = r.data.app;
  if (mine?.status === 'pending') return [head_, h('div', { class: 'sec' }, empty('Aplicarea ta e în așteptare', `Trimisă ${ago(mine.at)}. Primești răspuns pe Discord.`))];
  if (!r.data.open) return [head_, h('div', { class: 'sec' }, empty('Recrutările sunt închise', 'Revino mai târziu sau urmărește anunțurile de pe Discord.'))];
  const steam = h('input', { class: 'field', id: 'ap-steam', type: 'text', placeholder: 'https://steamcommunity.com/profiles/7656119…' });
  const tmp = h('input', { class: 'field', id: 'ap-tmp', type: 'text', placeholder: 'Link sau ID TruckersMP' });
  const age = h('input', { class: 'field', id: 'ap-age', type: 'number', min: 13, max: 99 });
  const from = h('input', { class: 'field', id: 'ap-from', type: 'text', maxlength: 80, placeholder: 'Oraș sau țară' });
  const hours = h('input', { class: 'field', id: 'ap-hours', type: 'text', maxlength: 40, placeholder: 'De exemplu: 10 ore pe săptămână' });
  const why = h('textarea', { class: 'field', id: 'ap-why', maxlength: 1200, placeholder: 'De când joci, ce-ți place să transporți, de ce Diesel Union.' });
  const ets = h('input', { type: 'checkbox', checked: true }), ats = h('input', { type: 'checkbox' }), rules = h('input', { type: 'checkbox' });
  return [head_,
    mine?.status === 'rejected' ? h('p', { class: 'muted sec', text: `Ultima aplicare a fost respinsă ${ago(mine.decided)}.${mine.note ? ` Motiv: ${mine.note}` : ''}` }) : null,
    h('section', { class: 'panel card sec' },
      h('div', { class: 'two' }, h('div', null, h('label', { class: 'lab', for: 'ap-steam', text: 'Profilul de Steam' }), steam), h('div', null, h('label', { class: 'lab', for: 'ap-tmp', text: 'Profilul TruckersMP, opțional' }), tmp)),
      h('div', { class: 'two' }, h('div', null, h('label', { class: 'lab', for: 'ap-age', text: 'Vârsta' }), age), h('div', null, h('label', { class: 'lab', for: 'ap-from', text: 'De unde ești' }), from), h('div', null, h('label', { class: 'lab', for: 'ap-hours', text: 'Cât joci' }), hours)),
      h('p', { class: 'lab', style: { marginBottom: 0 }, text: 'Ce joci' }), h('div', { style: { display: 'flex', gap: '20px' } }, h('label', { class: 'check' }, ets, 'Euro Truck Simulator 2'), h('label', { class: 'check' }, ats, 'American Truck Simulator')),
      h('label', { class: 'lab', for: 'ap-why', text: 'Despre tine' }), why,
      h('label', { class: 'check' }, rules, 'Sunt de acord să folosesc Trucky la curse și să respect regulile VTC-ului și ale TruckersMP.'),
      h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: () => act('/api/apply', { steam: steam.value, tmp: tmp.value, age: age.value, from: from.value, hours: hours.value, why: why.value, games: [ets.checked && 'ETS2', ats.checked && 'ATS'].filter(Boolean), rules: rules.checked }, render) }, icon('pen', 18), 'Trimite aplicarea')))];
}

async function pageAccount() {
  const head_ = h('div', { class: 'pagehead' }, h('h1', { text: 'Contul meu' }), h('p', { text: 'Leagă-ți contul de Discord de șoferul tău din Trucky, ca să apară profilul la /profil și să știm cine ești la convoaie.' }));
  if (!S.user) return [head_, h('div', { class: 'sec' }, empty('Intră cu Discord', 'Ca să-ți legi contul.', loginBtn()))];
  if (S.driver) return [head_, h('section', { class: 'panel card sec' }, h('h2', { text: S.driver.name }), h('p', { class: 'muted', text: `Contul tău de Discord e legat de șoferul ${S.driver.name} din Trucky.` }),
    h('div', { class: 'actions' }, h('a', { class: 'btn', href: `#/soferi/${S.driver.id}` }, 'Vezi profilul'), h('button', { class: 'btn ghost', type: 'button', onclick: () => act('/api/unlink', {}, boot) }, 'Dezleagă')))];
  const r = await api('/api/drivers'), list = (r.ok ? r.data.drivers : []).sort((a, b) => a.name.localeCompare(b.name));
  const sel = h('select', { class: 'field', id: 'lk-drv' }, h('option', { value: '' }, 'Alege-ți numele'), list.map((d) => h('option', { value: d.id }, d.name)));
  const steam = h('input', { class: 'field', id: 'lk-steam', type: 'text', placeholder: 'https://steamcommunity.com/profiles/7656119…' });
  return [head_, h('section', { class: 'panel card sec' }, h('div', { class: 'two' }, h('div', null, h('label', { class: 'lab', for: 'lk-drv', text: 'Numele tău în Trucky' }), sel), h('div', null, h('label', { class: 'lab', for: 'lk-steam', text: 'Profilul de Steam (pentru verificare)' }), steam)),
    h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: () => act('/api/link', { driver: sel.value, steam: steam.value }, boot) }, icon('link', 18), 'Leagă contul')),
    !list.length ? h('p', { class: 'muted small', text: 'Lista e goală până la prima sincronizare cu Trucky.' }) : null)];
}

async function pageStaff() {
  if (!S.role) return [empty('Doar pentru staff', 'Pagina asta e pentru cei care conduc VTC-ul.')];
  const r = await api('/api/staff'); if (!r.ok) return [empty('Nu se încarcă', r.data.error || 'Încearcă din nou.')];
  const d = r.data, tab = S.staffTab || 'apps';
  const tabs = h('div', { class: 'tabsline' }, [['apps', `Aplicări${d.apps.filter((a) => a.status === 'pending').length ? ` (${d.apps.filter((a) => a.status === 'pending').length})` : ''}`], ['trucky', 'Trucky'], ...(d.role === 'admin' ? [['cfg', 'Setări']] : [])].map(([k, l]) => h('button', { class: `btn small ${tab === k ? '' : 'ghost'}`, type: 'button', onclick: () => { S.staffTab = k; render(); } }, l)));
  const out = [h('div', { class: 'pagehead' }, h('h1', { text: 'Staff' })), tabs];
  if (tab === 'apps') out.push(h('section', { class: 'sec apps' }, d.apps.length ? d.apps.map(appCard) : empty('Nicio aplicare', 'Când cineva aplică, apare aici și pe canalul de staff.')));
  if (tab === 'trucky') {
    const s = d.sync, line = (ok, a, b) => h('div', null, h('b', { class: ok ? 'ok' : 'bad', text: a }), h('span', { class: 'muted small', text: b }));
    out.push(h('section', { class: 'sec' }, h('div', { class: 'status' },
      line(!!S.cfg.trucky, S.cfg.trucky ? 'ID companie setat' : 'Lipsește ID-ul companiei', 'Trucky, Company Settings, API.'),
      line(s.token, s.token ? 'Token setat' : 'Fără token', 'Variabila TRUCKY_TOKEN în Railway.'),
      line(s.secret, s.secret ? 'Webhook semnat' : 'Webhook fără secret', 'Variabila TRUCKY_WEBHOOK_SECRET (recomandat).'),
      line(!!s.lastHook, s.lastHook ? `Ultimul webhook ${ago(s.lastHook.at)}` : 'Niciun webhook primit', s.lastHook?.event || 'Adaugă adresa de mai jos în Trucky.'),
      line(s.jobs?.ok, s.jobs?.at ? `Citit din API ${ago(s.jobs.at)}` : 'API necitit încă', s.jobs?.error || `${n0(s.stored)} curse salvate`),
      line(s.members?.ok, s.members?.ok ? `${s.members.count} membri din Trucky` : 'Membrii nu s-au citit', s.members?.error || 'Se recitesc la jumătate de oră.')),
    h('div', { class: 'panel card sec' }, h('h2', { text: 'Webhook' }), h('p', { class: 'muted', text: 'În Trucky, Company Settings, API, adaugă adresa asta și bifează evenimentele de curse (Job Completed, Canceled, Deleted) și de membri.' }), h('code', { class: 'copy', text: s.webhook }),
      h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: (e) => { e.currentTarget.disabled = true; act('/api/sync', {}, render); } }, icon('refresh', 18), 'Sincronizează acum'))),
    h('div', { class: 'panel card sec' }, h('h2', { text: 'Conturi legate' }), d.links.length ? h('div', { class: 'ranks' }, d.links.map((l) => h('div', { class: 'rrow', style: { gridTemplateColumns: 'minmax(0,1fr) auto', cursor: 'default' } }, h('span', { class: 'nm', text: `${l.name} · Discord ${l.discord}` }), h('button', { class: 'btn danger small', type: 'button', onclick: () => act('/api/staff/unlink', { discord: l.discord }, render) }, 'Dezleagă')))) : h('p', { class: 'muted', text: 'Nimeni nu și-a legat încă contul.' }))));
  }
  if (tab === 'cfg' && d.cfg) out.push(...configForm(d.cfg, d.channels || []));
  return out;
}
function appCard(a) {
  const note = h('input', { class: 'field', type: 'text', maxlength: 500, placeholder: 'Mesaj pentru el, opțional' }), tr = h('input', { type: 'checkbox', checked: true });
  return h('article', { class: 'app panel rv' },
    h('header', null, av(a.avatar, a.name), h('b', { text: a.name }), h('span', { class: `pill ${a.status}`, text: { pending: 'În așteptare', accepted: 'Acceptat', rejected: 'Respins' }[a.status] }), h('span', { class: 'muted small', text: ago(a.at) })),
    h('dl', null, h('dt', { text: 'Discord' }), h('dd', { text: a.discord }), h('dt', { text: 'Steam' }), h('dd', null, h('a', { href: `https://steamcommunity.com/profiles/${a.steam}`, target: '_blank', rel: 'noopener', text: a.steam })),
      a.tmp ? [h('dt', { text: 'TruckersMP' }), h('dd', { text: a.tmp })] : null, h('dt', { text: 'Vârsta' }), h('dd', { text: a.age }), a.from ? [h('dt', { text: 'De unde' }), h('dd', { text: a.from })] : null,
      h('dt', { text: 'Joacă' }), h('dd', { text: `${a.games.join(', ')}${a.hours ? ` · ${a.hours}` : ''}` }), a.by ? [h('dt', { text: 'Decis de' }), h('dd', { text: `${a.by}${a.note ? `: ${a.note}` : ''}` })] : null),
    h('div', { class: 'why', text: a.why }),
    a.status === 'pending' ? [h('div', { class: 'two', style: { marginTop: '12px' } }, note), h('label', { class: 'check' }, tr, 'Adaugă-l și în compania din Trucky'),
      h('div', { class: 'actions' }, h('button', { class: 'btn ok', type: 'button', onclick: () => act('/api/apply/decide', { id: a.id, accept: true, note: note.value, trucky: tr.checked }, render) }, 'Acceptă'), h('button', { class: 'btn danger', type: 'button', onclick: () => act('/api/apply/decide', { id: a.id, accept: false, note: note.value }, render) }, 'Respinge'))] : null);
}
function configForm(c, chans) {
  const pick = (id, cur) => { const g = new Map(); for (const x of chans) { if (!g.has(x.group)) g.set(x.group, []); g.get(x.group).push(x); } return h('select', { class: 'field', id }, h('option', { value: '' }, 'Niciunul'), [...g].map(([n, xs]) => { const o = xs.map((x) => h('option', { value: x.id, selected: x.id === cur }, `# ${x.name}`)); return n ? h('optgroup', { label: n }, o) : o; })); };
  const inp = (id, v, a = {}) => h('input', { class: 'field', id, value: v ?? '', ...a });
  const F = { name: inp('c-name', c.name, { maxlength: 40 }), tag: inp('c-tag', c.tag, { maxlength: 8 }), tagline: inp('c-tl', c.tagline, { maxlength: 90 }), truckyId: inp('c-tr', c.truckyId, { inputmode: 'numeric' }), tmpId: inp('c-tmp', c.tmpId, { placeholder: 'ID sau link truckersmp.com/vtc/…' }), minJobKm: inp('c-min', c.minJobKm, { type: 'number', min: 0, max: 2000 }),
    jobsChannel: pick('c-jobs', c.jobsChannel), convoyChannel: pick('c-conv', c.convoyChannel), staffChannel: pick('c-staff', c.staffChannel) };
  const open = h('input', { type: 'checkbox', checked: c.recruitOpen });
  const rows = h('div', { class: 'rankrows' });
  const addRow = (r = { name: '', km: '' }) => { const row = h('div', null, h('input', { class: 'field', value: r.name, placeholder: 'Nume rang', maxlength: 30, 'aria-label': 'Nume rang' }), h('input', { class: 'field', type: 'number', min: 0, value: r.km, 'aria-label': 'Kilometri' }), h('button', { class: 'btn danger small', type: 'button', 'aria-label': 'Șterge rangul', onclick: () => row.remove() }, icon('x', 16))); rows.append(row); };
  c.ranks.forEach(addRow);
  const save_ = () => act('/api/config', { ...Object.fromEntries(Object.entries(F).map(([k, el]) => [k, el.value])), recruitOpen: open.checked, ranks: [...rows.children].map((r) => ({ name: r.children[0].value, km: r.children[1].value })) }, boot);
  const lab = (el, t) => h('div', null, h('label', { class: 'lab', for: el.id, text: t }), el);
  const test = (el) => h('button', { class: 'btn ghost small', type: 'button', style: { marginTop: '8px' }, onclick: () => (el.value ? act('/api/test', { channel: el.value }) : toast('Alege mai întâi canalul.', true)) }, 'Trimite un test');
  return [
    h('section', { class: 'panel card sec' }, h('h2', { text: 'VTC' }), h('div', { class: 'two' }, lab(F.name, 'Nume'), lab(F.tag, 'Tag'), lab(F.tagline, 'Motto')),
      h('div', { class: 'two' }, lab(F.truckyId, 'ID companie Trucky'), lab(F.tmpId, 'VTC pe TruckersMP'), lab(F.minJobKm, 'Curse sub atâția km nu contează')), h('label', { class: 'check' }, open, 'Recrutări deschise')),
    h('section', { class: 'panel card sec' }, h('h2', { text: 'Canale de Discord' }), chans.length ? null : h('p', { class: 'muted', text: 'Nu văd canale în care botul poate scrie (View Channel, Send Messages, Embed Links).' }),
      h('div', { class: 'two' }, h('div', null, lab(F.jobsChannel, 'Livrări și ranguri noi'), test(F.jobsChannel)), h('div', null, lab(F.convoyChannel, 'Convoaie'), test(F.convoyChannel)), h('div', null, lab(F.staffChannel, 'Aplicări (staff)'), test(F.staffChannel)))),
    h('section', { class: 'panel card sec' }, h('h2', { text: 'Ranguri' }), h('p', { class: 'muted', text: 'Kilometrii totali de la care se primește fiecare rang. Primul începe de la 0.' }), rows, h('div', { class: 'actions' }, h('button', { class: 'btn ghost small', type: 'button', onclick: () => addRow() }, 'Adaugă un rang'))),
    h('p', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: save_ }, 'Salvează setările'))];
}

// ---- shell ----
const TABS = [['', 'Acasă', 'home'], ['soferi', 'Șoferi', 'users'], ['curse', 'Curse', 'truck'], ['clasament', 'Clasament', 'trophy'], ['convoaie', 'Convoaie', 'flag']];
const PAGES = { '': pageHome, soferi: pageDrivers, curse: pageJobs, clasament: pageBoard, convoaie: pageConvoys, aplica: pageApply, cont: pageAccount, staff: pageStaff };
const route = () => { const r = location.hash.replace(/^#\/?/, '').split('/'); return { page: r[0] in PAGES ? r[0] : '', arg: r[1] || null }; };

function shell() {
  const { page } = route();
  const tabs = [...TABS, ...(S.cfg.recruitOpen && !S.driver ? [['aplica', 'Aplică', 'pen']] : [])];
  $('#nav').replaceChildren(...tabs.map(([k, l, ic]) => h('a', { href: `#/${k}`, 'aria-current': k === page ? 'page' : null }, icon(ic, 18), l)));
  $('#tabbar').replaceChildren(...TABS.map(([k, l, ic]) => h('a', { href: `#/${k}`, 'aria-current': k === page ? 'page' : null }, icon(ic, 22), h('span', { text: l }))));
  const me = $('#me');
  if (S.user) {
    const menu = h('div', { class: 'menu', hidden: true }, S.driver ? h('a', { href: `#/soferi/${S.driver.id}` }, icon('users', 18), 'Profilul meu') : null, h('a', { href: '#/cont' }, icon('link', 18), S.driver ? 'Contul meu' : 'Leagă-ți contul'),
      !S.driver && S.cfg.recruitOpen ? h('a', { href: '#/aplica' }, icon('pen', 18), 'Aplică') : null, S.role ? h('a', { href: '#/staff' }, icon('gear', 18), 'Staff') : null, h('a', { href: '/auth/logout' }, icon('exit', 18), 'Ieși din cont'));
    const btn = h('button', { class: 'who', type: 'button', 'aria-expanded': 'false', 'aria-label': `Cont: ${S.user.name}`, onclick: (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; btn.setAttribute('aria-expanded', String(!menu.hidden)); } }, av(S.driver?.avatar || S.user.avatar, S.user.name), h('span', { text: S.driver?.name || S.user.name }));
    me.replaceChildren(btn, menu);
  } else me.replaceChildren(S.login ? h('a', { class: 'btn small', href: '/auth/login' }, 'Intră cu Discord') : '');
}
document.addEventListener('click', () => { const m = $('#me .menu'); if (m) m.hidden = true; });

let tok = 0, lastPage = null;
async function render() {
  const my = ++tok, { page, arg } = route(), view = $('#view');
  if (page === 'soferi' && arg && lastPage === 'soferi' && view.childElementCount) { openDriver(arg); return; }
  for (const c of cleanups.splice(0)) c();
  shell();
  if (page !== lastPage) view.replaceChildren(...skel(3));
  let nodes; try { nodes = await PAGES[page](); } catch (err) { console.error(err); nodes = [empty('Ceva nu a mers', 'Reîncarcă pagina peste un minut.')]; }
  if (my !== tok) return;
  view.replaceChildren(...nodes.flat(Infinity).filter(Boolean));
  lastPage = page; reveal(view);
  document.title = page ? `${(TABS.find((t) => t[0] === page) || [0, { aplica: 'Aplică', cont: 'Contul meu', staff: 'Staff' }[page]])[1]} · ${S.cfg.name}` : S.cfg.name;
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

async function boot() {
  const r = await api('/api/me').catch(() => null);
  if (r?.ok) Object.assign(S, { user: r.data.user, role: r.data.role, cfg: r.data.cfg, login: r.data.login, driver: r.data.driver });
  $('.brand-name').textContent = S.cfg.name;
  await render();
}
boot();
