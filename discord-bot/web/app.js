'use strict';
// Sahara Cartel site. Everything that comes from the server is inserted as text (never as HTML).

const RANKS = ['membru', 'asociat', 'angajat'];
const RANK_NAME = { angajat: 'Angajat', asociat: 'Asociat', membru: 'Membru' };
const TYPE_LABEL = { mina: 'Mină', task: 'Task', prezenta: 'Prezență eveniment', organizat: 'Eveniment organizat', voice: 'Voice', bonus: 'Bonus' };
const S = { state: null, authed: null, craft: null, week: 'curenta', weekData: null, order: new Map(), tab: '' };
const $ = (s) => document.querySelector(s);

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'style') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return el;
}
const svg = (tag, attrs, ...kids) => {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
  for (const kid of kids.flat(Infinity)) if (kid != null) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return el;
};

// ---- helpers -------------------------------------------------------------

const DAY = 86400000;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const daysSince = (ts) => Math.max(0, Math.floor((Date.now() - ts) / DAY));
const dayText = (n) => (n === 0 ? 'de azi' : `de ${plural(n, 'zi', 'zile')}`);
const tz = () => S.state?.cfg.tz || 'Europe/Bucharest';
const fmtDate = (ts) => new Intl.DateTimeFormat('ro-RO', { timeZone: tz(), day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(ts));
const fmtTime = (ts) => new Intl.DateTimeFormat('ro-RO', { timeZone: tz(), weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(ts));
function countdown(ms) {
  const left = Math.max(0, ms - Date.now());
  const d = Math.floor(left / DAY), hr = Math.floor((left % DAY) / 3600000), min = Math.floor((left % 3600000) / 60000);
  if (d) return `${plural(d, 'zi', 'zile')} și ${plural(hr, 'oră', 'ore')}`;
  return hr ? `${plural(hr, 'oră', 'ore')} și ${plural(min, 'minut', 'minute')}` : plural(min, 'minut', 'minute');
}

function avatar(m, size) {
  const ok = m.avatar && m.avatar.startsWith('https://cdn.discordapp.com/');
  if (ok) return h('img', { class: 'avatar', src: m.avatar, alt: '', width: size || 40, height: size || 40, loading: 'lazy' });
  return h('span', { class: 'avatar', 'aria-hidden': 'true' }, (m.name || '?').trim().charAt(0).toUpperCase());
}

let toastTimer;
function toast(msg, bad) {
  const t = $('#toast');
  t.textContent = msg; t.className = `toast${bad ? ' bad' : ''}`; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, bad ? 7000 : 4500);
}

async function api(path, body) {
  const res = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
  if (res.status === 401) { S.authed = false; render(); throw new Error('auth'); }
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

// run a leader action, show the answer, reload the data
async function act(path, body, done) {
  const r = await api(path, body).catch(() => null);
  if (!r) return false;
  toast(r.data.msg || r.data.error || 'Ceva nu a mers.', !r.ok);
  if (r.ok) { await refresh(); if (done) done(r.data); }
  return r.ok;
}

// ---- boot / data ---------------------------------------------------------

async function refresh(soft) {
  const r = await fetch('/api/state').catch(() => null);
  if (!r) return;
  if (r.status === 401) { S.authed = false; return render(); }
  if (!r.ok) { S.authed = true; S.state = null; return render(); }
  S.state = await r.json(); S.authed = true;
  if (S.week !== 'curenta' && !S.state.archive.some((w) => String(w.no) === String(S.week))) S.week = 'curenta';
  if (S.week !== 'curenta') await loadWeek(S.week, true);
  // the background refresh must not wipe forms or an open profile: it only redraws the read-only pages
  if (soft && (!['clasament', 'banda'].includes(route()) || !$('#drawer').hidden)) return;
  render();
}
async function loadWeek(no, quiet) {
  const r = await api(`/api/week?no=${no}`);
  S.weekData = r.ok ? r.data : null;
  if (!quiet) render();
}
async function loadCraft() {
  if (S.craft) return;
  const r = await api('/api/craft');
  if (r.ok) { S.craft = r.data; render(); }
}

// ---- shell ---------------------------------------------------------------

const TABS = [['clasament', 'Clasament'], ['banda', 'Banda'], ['crafting', 'Crafting'], ['lideri', 'Lideri']];
function route() { const t = location.hash.replace(/^#\/?/, '').split('/')[0]; return TABS.some(([k]) => k === t) ? t : 'clasament'; }

function shell() {
  const me = $('#me'), nav = $('#nav');
  me.replaceChildren(); nav.replaceChildren();
  if (!S.authed || !S.state) return;
  const m = S.state.me;
  me.append(m.avatar ? h('img', { src: m.avatar, alt: '' }) : '', h('span', { text: m.name }), h('a', { href: '/auth/logout' }, 'Ieși'));
  const tab = route();
  for (const [k, label] of TABS) {
    if (k === 'lideri' && !m.leader) continue;
    nav.append(h('a', { href: `#/${k}`, 'aria-current': tab === k ? 'page' : null }, label));
  }
}

function sheet(...kids) { return h('div', { class: 'sheet-wrap' }, h('section', { class: 'sheet' }, kids)); }

function render() {
  const view = $('#view');
  shell();
  if (S.authed === null) return view.replaceChildren();
  if (!S.authed) return view.replaceChildren(sheet(h('div', { class: 'login' },
    h('h2', { text: 'Doar pentru banda' }),
    h('p', { text: 'Intră cu contul tău de Discord. Dacă ești pe serverul Sahara Cartel, vezi clasamentul, banda și calculatorul de crafting.' }),
    h('a', { class: 'btn', href: '/auth/login' }, 'Intră cu Discord'))));
  if (!S.state) return view.replaceChildren(sheet(h('h2', { text: 'Nu pot încărca datele' }), h('p', { text: 'Botul nu răspunde acum. Reîncarcă pagina peste un minut.' })));
  const tab = route();
  document.title = `${TABS.find(([k]) => k === tab)[1]} - Sahara Cartel`;
  const pages = { clasament: pageBoard, banda: pageRoster, crafting: pageCraft, lideri: pageLeaders };
  if (tab === 'lideri' && !S.state.me.leader) return (location.hash = '#/clasament');
  const keepScroll = S.tab === tab ? scrollY : 0;
  view.replaceChildren(...[].concat(pages[tab]()));
  S.tab = tab;
  if (keepScroll) scrollTo(0, keepScroll);
  if (tab === 'crafting') loadCraft();
}

// ---- leaderboard ---------------------------------------------------------

function pageBoard() {
  const st = S.state, cur = S.week === 'curenta' || !S.weekData;
  const rows = cur
    ? st.members.map((m) => ({ id: m.id, name: m.name, avatar: m.avatar, rank: m.rank, t: m.points })).sort((a, b) => b.t - a.t)
    : S.weekData.rows;
  const prag = cur ? st.cfg.prag : S.weekData.prag;
  const title = cur ? `Săptămâna ${st.week.no}` : `Săptămâna ${S.weekData.no}`;
  const sub = cur ? `Se închide peste ${countdown(st.week.end)}, duminică la miezul nopții.` : `Încheiată pe ${fmtDate(S.weekData.end - 1)}.`;
  const sel = h('select', { 'aria-label': 'Alege săptămâna', onchange: async (e) => { S.week = e.target.value; if (S.week === 'curenta') render(); else await loadWeek(S.week); } },
    h('option', { value: 'curenta', selected: cur }, 'Săptămâna curentă'),
    st.archive.map((w) => h('option', { value: w.no, selected: !cur && String(S.week) === String(w.no) }, `Săptămâna ${w.no} (încheiată)`)));
  const list = rows.length ? h('ol', { class: 'board' }, rows.map((r, i) => {
    const p = prag[r.rank] || 0, held = p && r.t >= p;
    return h('li', null, h('button', { type: 'button', onclick: () => openProfile(r.id) },
      h('span', { class: 'pos', text: i + 1 }), avatar(r),
      h('span', { class: 'who' }, h('b', { text: r.name }), h('span', { text: RANK_NAME[r.rank] })),
      h('span', { class: `meter${held ? ' ok' : ''}`, 'aria-label': p ? `${r.t} din ${p} puncte` : `${r.t} puncte` },
        p ? h('span', { class: 'track', style: {} }, h('span', { class: 'fill', style: { display: 'block', width: `${Math.min(100, (100 * r.t) / p)}%` } })) : null,
        h('span', { class: 'num', text: p ? `${r.t} din ${p}${held ? ', insigna ținută' : ''}` : `${r.t} puncte` }))));
  })) : h('p', { class: 'empty muted', text: 'Nimeni nu e în evidență încă. Un lider poate adăuga oameni din secțiunea Lideri sau cu /add pe Discord.' });
  return sheet(
    h('div', { class: 'head' }, h('div', null, h('h2', { text: title }), h('p', { class: 'muted', text: sub })), sel),
    h('p', { class: 'small muted', text: `Insigna de Membru se ține cu ${prag.membru} puncte pe săptămână, cea de Asociat cu ${prag.asociat}. Angajații nu au prag.` }),
    list);
}

// ---- roster --------------------------------------------------------------

function pageRoster() {
  const st = S.state;
  return sheet(
    h('h2', { text: 'Banda' }),
    h('p', { class: 'muted', text: `${plural(st.members.length, 'om', 'oameni')} în evidență. Apasă pe cineva ca să-i vezi profilul.` }),
    RANKS.map((r) => {
      const people = st.members.filter((m) => m.rank === r).sort((a, b) => a.rankSince - b.rankSince);
      const [used, max] = st.seats[r];
      return h('div', { class: 'rank-block' },
        h('header', null, h('h3', { text: RANK_NAME[r] }),
          max ? h('span', { class: 'seats', role: 'img', 'aria-label': `${used} din ${max} locuri ocupate` }, Array.from({ length: Math.min(max, 40) }, (_, i) => h('span', { class: `seat${i < used ? ' used' : ''}` })))
            : null,
          h('span', { class: 'small muted', text: max ? `${used} din ${max} locuri` : plural(used, 'angajat', 'angajați') })),
        people.length ? h('ul', { class: 'people' }, people.map((m) => h('li', null, h('button', { type: 'button', class: 'person', onclick: () => openProfile(m.id) },
          avatar(m), h('span', { class: 'who' }, h('b', { text: m.name }), h('span', { text: `în bandă ${dayText(daysSince(m.since))}` }), m.leaveUntil > Date.now() ? h('span', { class: 'tag', text: 'concediu' }) : null))))) : h('p', { class: 'small muted', text: 'Nimeni încă.' }));
    }));
}

// ---- profile drawer ------------------------------------------------------

function closeDrawer() { $('#drawer').hidden = true; $('#scrim').hidden = true; document.body.style.overflow = ''; }
$('#scrim').addEventListener('click', closeDrawer);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });

// the rank as a badge: brass sheriff star (Membru), copper shield (Asociat), plain iron plate (Angajat)
function badgeSvg(rank, size) {
  const g = svg('svg', { class: 'badge', viewBox: '0 0 40 40', width: size, height: size, 'aria-hidden': 'true' });
  const defs = svg('defs', null, svg('linearGradient', { id: `bg-${rank}`, x1: 0, y1: 0, x2: 1, y2: 1 },
    svg('stop', { offset: '0', 'stop-color': rank === 'membru' ? '#f0cd7a' : rank === 'asociat' ? '#d98a4a' : '#9a9184' }),
    svg('stop', { offset: '1', 'stop-color': rank === 'membru' ? '#a8761f' : rank === 'asociat' ? '#8d4a1c' : '#5f574c' })));
  g.append(defs);
  const fill = `url(#bg-${rank})`, stroke = '#3a2412';
  if (rank === 'membru') {
    const pts = [], balls = [];
    for (let i = 0; i < 12; i++) {
      const a = (Math.PI / 6) * i - Math.PI / 2, r = i % 2 ? 9 : 17;
      pts.push(`${(20 + r * Math.cos(a)).toFixed(1)},${(20 + r * Math.sin(a)).toFixed(1)}`);
      if (!(i % 2)) balls.push(svg('circle', { cx: (20 + 17 * Math.cos(a)).toFixed(1), cy: (20 + 17 * Math.sin(a)).toFixed(1), r: 2.7, fill, stroke, 'stroke-width': 1 }));
    }
    g.append(svg('polygon', { points: pts.join(' '), fill, stroke, 'stroke-width': 1.2, 'stroke-linejoin': 'round' }), ...balls, svg('circle', { cx: 20, cy: 20, r: 4.4, fill: '#3a2412' }));
  } else if (rank === 'asociat') {
    g.append(svg('path', { d: 'M20 3 L35 8 V21 C35 29 28 35 20 38 C12 35 5 29 5 21 V8 Z', fill, stroke, 'stroke-width': 1.4, 'stroke-linejoin': 'round' }), svg('path', { d: 'M20 11 L22.6 17 L29 17.6 L24.2 21.8 L25.7 28 L20 24.7 L14.3 28 L15.8 21.8 L11 17.6 L17.4 17 Z', fill: '#3a2412' }));
  } else {
    g.append(svg('circle', { cx: 20, cy: 20, r: 15, fill, stroke, 'stroke-width': 1.4 }), svg('circle', { cx: 20, cy: 20, r: 3.4, fill: '#3a2412' }));
  }
  return g;
}

function historyChart(m) {
  const weeks = [...m.hist].reverse().filter((w) => w.t != null);
  if (!weeks.length) return h('p', { class: 'small muted', text: 'Nicio săptămână încheiată încă.' });
  const prag = S.state.cfg.prag[m.rank] || 0, max = Math.max(prag, ...weeks.map((w) => w.t), 10);
  const W = 440, H = 150, pad = 54, bw = Math.min(40, (W - pad) / weeks.length - 8);
  const g = svg('svg', { class: 'chart', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `Puncte pe ultimele ${weeks.length} săptămâni` });
  const y = (v) => H - 22 - ((H - 40) * v) / max;
  if (prag) { g.append(svg('line', { x1: pad - 4, x2: W, y1: y(prag), y2: y(prag), stroke: '#7a2a1e', 'stroke-dasharray': '5 4', 'stroke-width': 1.4 }), svg('text', { x: 0, y: y(prag) + 4, 'text-anchor': 'start' }, `prag ${prag}`)); }
  weeks.forEach((w, i) => {
    const x = pad + i * ((W - pad) / weeks.length) + 4, held = prag && w.t >= (w.prag?.[w.rank] ?? prag);
    g.append(svg('rect', { x, y: y(w.t), width: bw, height: Math.max(2, H - 22 - y(w.t)), fill: held ? '#d9a441' : '#c8702a', stroke: '#3a2412', 'stroke-width': 1 }),
      svg('text', { x: x + bw / 2, y: y(w.t) - 4, 'text-anchor': 'middle' }, w.t),
      svg('text', { x: x + bw / 2, y: H - 6, 'text-anchor': 'middle' }, `S${w.no}`));
  });
  return g;
}

function openProfile(id) {
  const st = S.state, m = st.members.find((x) => x.id === id);
  if (!m) return;
  const d = $('#drawer'), prag = st.cfg.prag[m.rank] || 0;
  const breakdown = Object.entries(m.byType).filter(([, v]) => v).map(([k, v]) => h('li', null, h('span', { text: k === 'voice' ? `Voice (${Math.floor(m.voiceMin / 60)} ore ${m.voiceMin % 60} min)` : TYPE_LABEL[k] }), h('b', { text: v })));
  const held = prag && m.points >= prag;
  const closeBtn = h('button', { class: 'close', type: 'button', 'aria-label': 'Închide', onclick: closeDrawer }, '\u00d7');
  const kids = [
    h('div', { class: 'profile-head' }, avatar(m, 76),
      h('h2', { text: m.name }),
      h('p', { class: 'rank-line' }, badgeSvg(m.rank, 30), h('span', { text: RANK_NAME[m.rank] })),
      h('div', { class: 'flourish', 'aria-hidden': 'true' }, h('span', { text: '\u2605' }))),
    h('dl', { class: 'facts' },
      h('dt', { text: 'În bandă' }), h('dd', { text: `${dayText(daysSince(m.since))}, din ${fmtDate(m.since)}` }),
      h('dt', { text: 'Rang' }), h('dd', { text: `${RANK_NAME[m.rank]} ${dayText(daysSince(m.rankSince))}` }),
      h('dt', { text: 'Săptămâna asta' }), h('dd', { text: prag ? `${m.points} din ${prag} puncte` : `${m.points} puncte` })),
    prag ? h('div', { class: `meter${held ? ' ok' : ''}`, role: 'img', 'aria-label': `${m.points} din ${prag} puncte` },
      h('span', { class: 'track' }, h('span', { class: 'fill', style: { display: 'block', width: `${Math.min(100, (100 * m.points) / prag)}%` } })),
      h('span', { class: 'num', text: held ? 'Insigna ținută săptămâna asta' : `Mai sunt ${prag - m.points} puncte până la prag` })) : null,
  ];
  if (m.strikes) kids.push(h('p', { class: 'notice-line', text: `${plural(m.strikes, 'săptămână', 'săptămâni')} sub prag din ${st.cfg.toleranta} permise. La ${st.cfg.toleranta} pierde rangul${st.cfg.autoDemote ? '' : ' (retrogradarea e manuală)'}.` }));
  if (m.leaveUntil > Date.now()) kids.push(h('p', { class: 'notice-line', text: `În concediu până pe ${fmtDate(m.leaveUntil)}. Nu primește avertismente.` }));
  kids.push(h('h3', { text: 'Puncte săptămâna asta' }), breakdown.length ? h('ul', { class: 'breakdown' }, breakdown) : h('p', { class: 'small muted', text: 'Încă nimic.' }));
  kids.push(h('h3', { text: 'Ultimele săptămâni' }), historyChart(m));
  if (m.next) kids.push(h('h3', { text: `Avansare la ${RANK_NAME[m.next]}` }), h('p', { class: 'small', text: m.canPromote ? 'Îndeplinește condițiile și există loc liber.' : m.why }));
  if (st.me.leader) kids.push(leaderTools(m));
  d.replaceChildren(closeBtn, h('div', { class: 'drawer-inner' }, h('div', { class: 'poster' }, ...kids)));
  d.hidden = false; $('#scrim').hidden = false; d.querySelector('.drawer-inner').scrollTop = 0;
  closeBtn.focus();
}

function leaderTools(m) {
  const st = S.state, me = st.me;
  const type = h('select', { id: 'g-type' }, st.types.map((t) => h('option', { value: t.value }, `${t.label}${t.pts != null ? ` (${t.pts})` : ''}`)));
  const qty = h('input', { type: 'number', id: 'g-qty', value: 1, min: -500, max: 500 });
  const note = h('input', { type: 'text', id: 'g-note', maxlength: 100, placeholder: 'Motiv, opțional' });
  const rank = h('select', { id: 'r-rank' }, RANKS.filter((r) => r !== m.rank).reverse().map((r) => h('option', { value: r }, RANK_NAME[r])));
  const force = me.admin ? h('label', { class: 'checks' }, h('input', { type: 'checkbox', id: 'r-force' }), 'Ignoră condiția de puncte') : null;
  const days = h('input', { type: 'number', id: 'l-days', value: 7, min: 0, max: 60 });
  return h('div', null,
    h('h3', { text: 'Dă puncte' }),
    h('div', { class: 'row' }, h('div', null, h('label', { for: 'g-type', text: 'Activitate' }), type), h('div', null, h('label', { for: 'g-qty', text: type.value === 'bonus' ? 'Puncte' : 'De câte ori' }), qty)),
    h('label', { for: 'g-note', text: 'Notă' }), note,
    h('p', null, h('button', { class: 'btn', type: 'button', onclick: () => act('/api/give', { userIds: [m.id], type: type.value, qty: Number(qty.value), note: note.value }, () => openProfile(m.id)) }, 'Dă puncte')),
    h('h3', { text: 'Schimbă rangul' }),
    h('div', { class: 'row' }, h('div', null, rank), force ? h('div', { class: 'fit' }, force) : null),
    h('p', null, h('button', { class: 'btn alt', type: 'button', onclick: () => act('/api/rank', { userId: m.id, rank: rank.value, force: !!document.getElementById('r-force')?.checked }, () => openProfile(m.id)) }, 'Schimbă rangul')),
    h('h3', { text: 'Concediu' }),
    h('div', { class: 'row' }, h('div', null, h('label', { for: 'l-days', text: 'Zile (0 îl oprește)' }), days)),
    h('p', null, h('button', { class: 'btn alt', type: 'button', onclick: () => act('/api/leave', { userId: m.id, zile: Number(days.value) }, () => openProfile(m.id)) }, 'Setează concediul')),
    h('hr', { class: 'rule' }),
    h('button', { class: 'btn danger small', type: 'button', onclick: () => { if (confirm(`Scoți pe ${m.name} din bandă? Istoricul săptămânilor rămâne în arhivă.`)) act('/api/remove', { userId: m.id }, closeDrawer); } }, 'Scoate din bandă'));
}

// ---- crafting ------------------------------------------------------------

let calcTimer, calcResult = null;
function runCalc() {
  clearTimeout(calcTimer);
  calcTimer = setTimeout(async () => {
    const items = [...S.order].map(([name, qty]) => ({ name, qty }));
    if (!items.length) { calcResult = null; return paintResult(); }
    const r = await api('/api/craft', { items }).catch(() => null);
    calcResult = r?.ok ? r.data : null; paintResult();
  }, 220);
}

function paintResult() {
  const box = document.getElementById('result');
  if (!box) return;
  box.replaceChildren();
  const r = calcResult;
  if (!r || !r.orders?.length) return box.append(h('p', { class: 'small muted', text: 'Adaugă arme din listă și apar materialele, minereul de adunat și ordinea de craft.' }));
  const dl = (title, pairs) => pairs?.length ? [h('h3', { text: title }), h('dl', null, pairs.map(([n, q]) => [h('dt', { text: n }), h('dd', { text: q })]))] : [];
  box.append(...dl('Materiale necesare', r.materials), ...dl('Făcute pe parcurs', r.onTheWay), ...dl('Minereu de adunat', r.ore),
    h('h3', { text: 'Ordinea de craft' }), h('ol', null, r.order.map((o) => h('li', null, h('b', { text: o.title }), ` - ${o.text}`))));
}

function setQty(name, q) {
  if (q <= 0) S.order.delete(name); else S.order.set(name, Math.min(200, q));
  const list = document.getElementById('order');
  if (list) list.replaceWith(orderList());
  runCalc();
}
function orderList() {
  const box = h('div', { id: 'order' });
  if (!S.order.size) return box.append(h('p', { class: 'small muted', text: 'Comanda e goală.' })) || box;
  for (const [name, q] of S.order) {
    box.append(h('div', { class: 'order-item' }, h('span', { text: name }), h('span', { class: 'qty' },
      h('button', { type: 'button', 'aria-label': `Mai puțin ${name}`, onclick: () => setQty(name, q - 1) }, '−'),
      h('output', { text: q }),
      h('button', { type: 'button', 'aria-label': `Mai mult ${name}`, onclick: () => setQty(name, q + 1) }, '+'))));
  }
  box.append(h('p', null, h('button', { class: 'btn alt small', type: 'button', onclick: () => { S.order.clear(); setQty('', 0); } }, 'Golește comanda')));
  return box;
}

function pageCraft() {
  if (!S.craft) return sheet(h('h2', { text: 'Crafting' }), h('p', { class: 'muted', text: 'Se încarcă rețetele…' }));
  const q = h('input', { type: 'text', id: 'c-q', placeholder: 'Caută o armă', 'aria-label': 'Caută o armă', autocomplete: 'off' });
  const catalog = h('div', { id: 'catalog' });
  const paint = () => {
    const term = q.value.trim().toLowerCase();
    catalog.replaceChildren();
    for (const cat of S.craft.categories) {
      const items = S.craft.weapons.filter((w) => w.category === cat && (!term || w.name.toLowerCase().includes(term)));
      if (!items.length) continue;
      catalog.append(h('h3', { text: cat }), ...items.map((w) => h('div', { class: 'recipe' },
        h('b', null, w.name, w.badge ? h('span', { class: 'tag', text: w.badge }) : null),
        h('span', { class: 'ing', text: w.ingredients.map(([n, k]) => `${k} ${n}`).join(', ') }),
        h('button', { class: 'btn small', type: 'button', 'aria-label': `Adaugă ${w.name}`, onclick: () => setQty(w.name, (S.order.get(w.name) || 0) + 1) }, 'Adaugă'))));
    }
    if (!catalog.children.length) catalog.append(h('p', { class: 'muted', text: 'Nicio armă cu numele ăsta.' }));
  };
  q.addEventListener('input', paint); paint();
  queueMicrotask(() => { paintResult(); });
  return sheet(h('div', { class: 'craft' },
    h('div', null, h('h2', { text: 'Crafting' }), q, catalog),
    h('aside', null, h('h2', { text: 'Comanda ta' }), orderList(), h('div', { id: 'result', class: 'result' }))));
}

// ---- leaders -------------------------------------------------------------

function picker({ title, multi, onChange, remote }) {
  const picked = new Map(), input = h('input', { type: 'text', placeholder: remote ? 'Caută pe server (min. 2 litere) sau lipește ID-ul' : 'Caută în bandă', autocomplete: 'off' });
  const chips = h('div', { class: 'chips' }), sug = h('ul', { class: 'suggest', hidden: true }), note = h('p', { class: 'small muted', hidden: true });
  const paintChips = () => {
    chips.replaceChildren(...[...picked].map(([id, name]) => h('span', { class: 'chip' }, name, h('button', { type: 'button', 'aria-label': `Scoate ${name}`, onclick: () => { picked.delete(id); paintChips(); } }, '×'))));
    onChange([...picked.keys()]);
  };
  const add = (id, name) => { if (!multi) picked.clear(); picked.set(id, name); input.value = ''; sug.hidden = true; paintChips(); };
  let t;
  input.addEventListener('input', () => {
    clearTimeout(t);
    const v = input.value.trim();
    if (remote) {
      if (/^\d{15,22}$/.test(v)) { sug.replaceChildren(h('li', null, h('button', { type: 'button', onclick: () => add(v, `ID ${v}`) }, `Folosește ID ${v}`))); sug.hidden = false; return; }
      if (v.length < 2) { sug.hidden = true; return; }
      t = setTimeout(async () => {
        const r = await api(`/api/members?q=${encodeURIComponent(v)}`);
        const list = r.data.members || [];
        note.hidden = !r.data.note; note.textContent = r.data.note || '';
        sug.replaceChildren(...list.map((u) => h('li', null, h('button', { type: 'button', onclick: () => add(u.id, u.name) }, u.name))));
        sug.hidden = !list.length;
      }, 250);
    } else {
      const list = S.state.members.filter((m) => !picked.has(m.id) && (!v || m.name.toLowerCase().includes(v.toLowerCase()))).slice(0, 8);
      sug.replaceChildren(...list.map((m) => h('li', null, h('button', { type: 'button', onclick: () => add(m.id, m.name) }, `${m.name} (${RANK_NAME[m.rank]})`))));
      sug.hidden = !list.length;
    }
  });
  if (!remote) input.addEventListener('focus', () => input.dispatchEvent(new Event('input')));
  const el = h('div', null, h('label', { text: title }), chips, input, sug, note);
  return { el, ids: () => [...picked.keys()], clear: () => { picked.clear(); paintChips(); } };
}

function pageLeaders() {
  const st = S.state;
  const give = picker({ title: 'Cine primește', multi: true, onChange: () => {} });
  const type = h('select', { id: 'p-type' }, st.types.map((t) => h('option', { value: t.value }, `${t.label}${t.pts != null ? ` (${t.pts} puncte)` : ''}`)));
  const qty = h('input', { type: 'number', id: 'p-qty', value: 1, min: -500, max: 500 });
  const qtyLabel = h('label', { for: 'p-qty', text: 'De câte ori' });
  type.addEventListener('change', () => { qtyLabel.textContent = type.value === 'bonus' ? 'Puncte (poate fi negativ)' : 'De câte ori'; });
  const note = h('input', { type: 'text', id: 'p-note', maxlength: 100, placeholder: 'Motiv, opțional' });

  const add = picker({ title: 'Persoana de adăugat', multi: false, remote: true, onChange: () => {} });
  const rank = h('select', { id: 'a-rank' }, ['angajat', 'asociat', 'membru'].map((r) => h('option', { value: r }, `${RANK_NAME[r]}${r === 'angajat' ? '' : ` (${st.seats[r][0]} din ${st.seats[r][1]} locuri)`}`)));

  const log = st.entries.length ? h('table', { class: 'log' },
    h('thead', null, h('tr', null, ['Când', 'Cui', 'Ce', 'Puncte', 'Notă', ''].map((t) => h('th', { text: t })))),
    h('tbody', null, st.entries.map((e) => h('tr', null, h('td', { text: fmtTime(e.at) }), h('td', { text: e.userName }), h('td', { text: `${e.label}${e.qty > 1 && e.type !== 'bonus' ? ` x${e.qty}` : ''}` }),
      h('td', { text: `${e.pts > 0 ? '+' : ''}${e.pts}` }), h('td', { text: e.note || '' }),
      h('td', null, h('button', { class: 'btn alt small', type: 'button', onclick: () => { if (confirm(`Anulezi #${e.id}: ${e.userName} ${e.pts > 0 ? '+' : ''}${e.pts} ${e.label}?`)) act('/api/undo', { id: e.id }); } }, 'Anulează'))))))
    : h('p', { class: 'small muted', text: 'Nu s-au dat puncte manual săptămâna asta.' });

  const out = [
    sheet(h('h2', { text: 'Dă puncte' }),
      h('p', { class: 'muted', text: 'Voice-ul se adaugă singur. Aici dai minat, task-uri, prezențe, evenimente organizate și bonusuri.' }),
      give.el,
      h('div', { class: 'row' }, h('div', null, h('label', { for: 'p-type', text: 'Activitate' }), type), h('div', null, qtyLabel, qty), h('div', { class: 'grow' }, h('label', { for: 'p-note', text: 'Notă' }), note)),
      h('p', null, h('button', { class: 'btn', type: 'button', onclick: async () => {
        const ok = await act('/api/give', { userIds: give.ids(), type: type.value, qty: Number(qty.value), note: note.value });
        if (ok) { give.clear(); note.value = ''; }
      } }, 'Dă puncte'))),
    sheet(h('h2', { text: 'Adaugă în bandă' }), add.el,
      h('label', { for: 'a-rank', text: 'Rang' }), rank,
      h('p', null, h('button', { class: 'btn', type: 'button', onclick: async () => {
        const id = add.ids()[0];
        if (!id) return toast('Alege mai întâi persoana.', true);
        if (await act('/api/add', { userId: id, rank: rank.value })) add.clear();
      } }, 'Adaugă în bandă'))),
    sheet(h('h2', { text: 'Puncte date săptămâna asta' }), log),
  ];
  if (st.me.admin) out.push(configSheet());
  return out;
}

function configSheet() {
  const c = S.state.cfg, fields = [
    ['mina', 'Puncte pe o mină', c.values.mina], ['task', 'Puncte pe un task', c.values.task], ['prezenta', 'Puncte pe prezență la eveniment', c.values.prezenta],
    ['organizat', 'Puncte pe eveniment organizat', c.values.organizat], ['voice', 'Puncte pe oră de voice', c.values.voice], ['plafon_voice', 'Maximum din voice pe săptămână', c.caps.voice || 0],
    ['prag_membru', 'Prag Membru pe săptămână', c.prag.membru], ['prag_asociat', 'Prag Asociat pe săptămână', c.prag.asociat],
    ['locuri_membru', 'Locuri de Membru', c.slots.membru], ['locuri_asociat', 'Locuri de Asociat', c.slots.asociat],
    ['toleranta', 'Săptămâni sub prag până la retrogradare', c.toleranta], ['saptamani_promovare', 'Săptămâni peste prag pentru promovare', c.promoWeeks],
  ];
  const inputs = fields.map(([k, label, v]) => ({ k, el: h('input', { type: 'number', id: `cfg-${k}`, value: v, min: 0, max: 1000 }), label }));
  const demote = h('input', { type: 'checkbox', id: 'cfg-demote', checked: c.autoDemote });
  return sheet(h('h2', { text: 'Setări' }),
    h('p', { class: 'muted', text: 'Valorile noi se aplică de acum. Punctele deja date rămân cum au fost.' }),
    h('div', { class: 'cfg-grid' }, inputs.map(({ k, el, label }) => h('div', null, h('label', { for: `cfg-${k}`, text: label }), el))),
    h('label', { class: 'checks' }, demote, 'Retrogradare automată după toleranță'),
    h('p', null, h('button', { class: 'btn', type: 'button', onclick: () => act('/api/config', { ...Object.fromEntries(inputs.map(({ k, el }) => [k, el.value])), retrogradare: demote.checked }) }, 'Salvează setările')));
}

// ---- go ------------------------------------------------------------------

window.addEventListener('hashchange', () => { closeDrawer(); render(); scrollTo(0, 0); });
refresh();
setInterval(() => { if (!document.hidden && S.authed) refresh(true); }, 60_000);
