'use strict';
// Sahara Cartel site. Everything that comes from the server is inserted as text (never as HTML).

const RANKS = ['membru', 'asociat', 'angajat'];
const RANK_NAME = { angajat: 'Angajat', asociat: 'Asociat', membru: 'Membru' };
const TYPE_LABEL = { mina: 'Mină', task: 'Task', prezenta: 'Prezență eveniment', organizat: 'Eveniment organizat', voice: 'Voice', bonus: 'Bonus' };
const S = { state: null, authed: null, craft: null, week: 'curenta', weekData: null, order: new Map(), tab: '', ltab: 'puncte', anim: true, hub: null, hubLoading: false, accessDenied: null, security: null, securityLoading: false };
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s) => document.querySelector(s);

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'style') { for (const [p, x] of Object.entries(v)) { if (p.startsWith('--')) el.style.setProperty(p, x); else el.style[p] = x; } }
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

// ---- icons ---------------------------------------------------------------

const ICONS = {
  trophy: 'M7 3h10v2h3v3a4 4 0 0 1-4 4h-.3A5 5 0 0 1 13 14.9V18h3v3H8v-3h3v-3.1A5 5 0 0 1 8.3 12H8a4 4 0 0 1-4-4V5h3V3zm0 4H6v1c0 .7.4 1.4 1 1.7V7zm10 0v2.7c.6-.3 1-1 1-1.7V7h-1z',
  people: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zm7.5 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 19c0-3.3 3.1-6 7-6s7 2.7 7 6v1H2v-1zm15.9 1v-1c0-1.9-.8-3.6-2-4.9l.6-.1c3 0 5.5 2.2 5.5 5v1h-4.1z',
  tools: 'M14.5 2.5a5 5 0 0 0-4.6 7L3 16.4a2 2 0 0 0 0 2.8l1.8 1.8a2 2 0 0 0 2.8 0l6.9-6.9a5 5 0 0 0 6.7-6.2l-3 3-2.6-.5-.5-2.6 3-3a5 5 0 0 0-3.6-2.300zM5.5 17a1 1 0 1 1 0 2 1 1 0 0 1 0-2z',
  crown: 'M3 18h18v2.500H3V18zM2.5 7l5 4L12 4.5 16.5 11l5-4-1.7 9.500H4.200L2.5 7z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 8c0-3.9 3.6-7 8-7s8 3.1 8 7v1H4v-1z',
  flag: 'M5 3h2v18H5V3zm3 1h11l-2.5 4L19 12H8V4z',
  repeat: 'M17 2l4 4-4 4V7H8a3 3 0 0 0-3 3v1H3v-1a5 5 0 0 1 5-5h9V2zM7 22l-4-4 4-4v3h9a3 3 0 0 0 3-3v-1h2v1a5 5 0 0 1-5 5H7v3z',
  note: 'M6 2h9l5 5v15H6V2zm8 1.800V8h4.200L14 3.800zM9 12v1.600h8V12H9zm0 4v1.600h8V16H9z',
  check: 'M9.2 16.2 4.9 11.9 3 13.800l6.2 6.200L21 8.200l-1.9-1.900z',
  horn: 'M3 9.500v5h3l1.8 6h2.700l-1.6-6H11l7 4V5.500l-7 4H3zm17-.800v6.600a3.8 3.8 0 0 0 0-6.600z',
  plus: 'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5z',
  list: 'M4 5h16v2H4V5zm0 6h16v2H4v-2zm0 6h16v2H4v-2z',
  sliders: 'M4 6h9v2H4zM15 4h2v6h-2zM19 6h1v2h-1zM4 16h3v2H4zM9 14h2v6H9zM13 16h7v2h-7z',
  shield: 'M12 2l8 3v6c0 5-3.4 9-8 11-4.6-2-8-6-8-11V5l8-3z',
  hash: 'M9 3h2l-.500 5h4l.500-5h2l-.500 5H20v2h-3.700l-.400 4H19v2h-3.300l-.500 5h-2l.500-5h-4l-.500 5h-2l.500-5H4v-2h3.700l.400-4H5V8h3.300L9 3zm1.3 7-.400 4h4l.400-4h-4z',
  text: 'M4 4h16v3h-2V6h-5v12h2v2H9v-2h2V6H6v1H4V4z',
  cart: 'M3 4h2.600l.800 3H21l-2 8H8.200l.500 2H19v2H7.200L4.1 6H3V4zm5 17.500a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm9 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z',
};
const icon = (name, size = 20) => svg('svg', { class: 'ico', viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': 'true' }, svg('path', { d: ICONS[name], 'fill-rule': 'evenodd' }));
const lab = (ic, text, forId) => h('label', forId ? { for: forId } : null, icon(ic, 18), text);
// panel heading: round icon, gold title, one line under it, optional control on the right
const title = (ic, text, sub, side) => h('div', { class: 'title' }, h('span', { class: 'title-ico' }, icon(ic, 28)),
  h('div', { class: 'title-text' }, h('h2', { text }), sub ? h('p', { text: sub }) : null), side ? h('div', { class: 'side' }, side) : null);

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

// Browser-only helpers: no API changes, no permissions or Discord logic changed.
const preferenceCache = new Map();
function preferenceKey(type) {
  return `sahara-cartel:${type}:v1:${S.state?.me?.id || 'anonymous'}`;
}
function readPreference(type, fallback) {
  const key=preferenceKey(type);
  try { const data=localStorage.getItem(key); return data ? JSON.parse(data) : (preferenceCache.get(key) ?? fallback); }
  catch { return preferenceCache.get(key) ?? fallback; }
}
function writePreference(type, value) {
  const key=preferenceKey(type);
  preferenceCache.set(key,value);
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch { return false; }
}
function favoriteIds() {
  const data=readPreference('favorites', []);
  return new Set(Array.isArray(data) ? data.filter(x=>typeof x==='string') : []);
}
function toggleFavorite(id) {
  const favorites=favoriteIds();
  if(favorites.has(id)) favorites.delete(id); else favorites.add(id);
  writePreference('favorites', [...favorites]);
  if(typeof S.rosterApply==='function') S.rosterApply();
  return favorites.has(id);
}
function restoreCraftDraft() {
  if(!S.craft || !S.state) return;
  const catalog=new Set(S.craft.weapons.map(w=>w.name));
  const saved=readPreference('craft-draft', []);
  if(!Array.isArray(saved)) return;
  S.order.clear();
  for(const item of saved.slice(0,70)) {
    if(!Array.isArray(item) || !catalog.has(item[0])) continue;
    const q=Number(item[1]);
    if(Number.isInteger(q) && q>0 && q<=1000) S.order.set(item[0],q);
  }
}
function saveCraftDraft() { writePreference('craft-draft',[...S.order]); }
function downloadTextFile(filename, contents, mime='text/plain;charset=utf-8') {
  const url=URL.createObjectURL(new Blob([contents], {type:mime}));
  const a=h('a',{href:url,download:filename});
  document.body.append(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function exportBoardCsv(rows, week) {
  const escapeCsv=v => {
    let s=String(v??'');
    // Prevent formula injection when opened in spreadsheet software.
    if(/^[\s]*[=+@\-]/.test(s)) s="'"+s;
    return '"'+s.replace(/"/g,'""')+'"';
  };
  const lines=[['Loc','Membru','Rank','Puncte'],...rows.map((r,i)=>[i+1,r.name,RANK_NAME[r.rank]||r.rank,Number(r.t)||0])];
  downloadTextFile(`sahara-clasament-${String(week).replace(/[^0-9]/g,'')}.csv`, '\ufeff'+lines.map(line=>line.map(escapeCsv).join(',')).join('\r\n'),'text/csv;charset=utf-8');
  toast('Clasamentul a fost exportat.');
}
function exportCraftTxt() {
  if(!calcResult?.orders?.length) return;
  const fmt=(title,rows)=>[title,...(rows||[]).map(([name,qty])=>`- ${name}: ${qty}`),''].join('\n');
  const parts=['SAHARA CARTEL — COMANDĂ CRAFTING','',fmt('Arme', [...S.order].map(([name,qty])=>[name,qty])),fmt('Materiale necesare',calcResult.materials),fmt('Făcute pe parcurs',calcResult.onTheWay),fmt('Minereu de adunat',calcResult.ore),'ORDINEA DE CRAFT',...calcResult.order.map((step,i)=>`${i+1}. ${step.title}: ${step.text}`)];
  downloadTextFile('sahara-comanda-crafting.txt',parts.join('\n'));
  toast('Lista de crafting a fost descărcată.');
}

// Command palette opens as a compact overlay; Ctrl/Cmd+K also works from other pages.
let commandPreviousFocus=null, commandIndex=0, commandActions=[];
function closeCommand() {
  const dlg=$('#command-palette');
  if(dlg.hidden) return;
  dlg.hidden=true;
  document.body.classList.remove('command-open');
  if(commandPreviousFocus?.isConnected) commandPreviousFocus.focus();
}
function openCommand() {
  if(!S.authed || !S.state) return;
  closeDrawer();
  commandPreviousFocus=document.activeElement;
  $('#command-palette').hidden=false;
  document.body.classList.add('command-open');
  const input=$('#command-input');input.value='';
  renderCommandResults();input.focus();
}
function renderCommandResults() {
  if(!S.state) return;
  const term=$('#command-input').value.trim().toLocaleLowerCase('ro');
  const pages=[
    ...TABS.filter(([k])=>isVisibleTab(k)).map(([route,label])=>({title:label,sub:'Secțiune',kind:'page',go:()=>{location.hash='#/'+route;closeCommand();}})),
    ...HUB_TABS.filter(([key])=>canSeeHub(key)).map(([key,label])=>({title:label,sub:'Cartier / modul',kind:'page',go:()=>{location.hash='#/cartier/'+key;closeCommand();}})),
  ];
  const people=S.state.members.map(m=>({title:m.name,sub:RANK_NAME[m.rank]||'Membru',kind:'person',go:()=>{closeCommand();openProfile(m.id);}}));
  const entries=[...pages,...people].filter(item=>(item.title+' '+item.sub).toLocaleLowerCase('ro').includes(term)).slice(0,12);
  commandActions=entries;
  commandIndex=0;
  const list=$('#command-results');
  list.replaceChildren(...entries.map((item,i)=>h('button',{type:'button',class:'command-hit',role:'option','aria-selected':i===0?'true':'false',onclick:item.go},
    h('span',{class:'command-mark',text:item.kind==='page'?'◇':'♟'}),
    h('span',{class:'command-copy'},h('strong',{text:item.title}),h('small',{text:item.sub})),
    h('span',{class:'command-arrow',text:'↗'}))));
  if(!entries.length) list.append(h('p',{class:'command-empty',text:'Niciun rezultat. Încearcă alt nume.'}));
}
function shiftCommandSelection(delta) {
  if(!commandActions.length) return;
  commandIndex=(commandIndex+delta+commandActions.length)%commandActions.length;
  [...$('#command-results').querySelectorAll('.command-hit')].forEach((el,i)=>el.setAttribute('aria-selected',String(i===commandIndex)));
  $('#command-results').querySelectorAll('.command-hit')[commandIndex]?.scrollIntoView({block:'nearest'});
}
$('#quick-open').addEventListener('click',openCommand);
$('#command-backdrop').addEventListener('click',closeCommand);
$('#command-close').addEventListener('click',closeCommand);
$('#command-input').addEventListener('input',renderCommandResults);
$('#command-input').addEventListener('keydown',e=>{
  if(e.key==='ArrowDown'||e.key==='ArrowUp') {e.preventDefault();shiftCommandSelection(e.key==='ArrowDown'?1:-1);}
  else if(e.key==='Enter') {e.preventDefault();commandActions[commandIndex]?.go();}
});
document.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k') {e.preventDefault();$('#command-palette').hidden?openCommand():closeCommand();}
  if(e.key==='Escape'&&!$('#command-palette').hidden){e.preventDefault();closeCommand();}
});

let toastTimer;
function toast(msg, bad) {
  const t = $('#toast');
  t.textContent = msg; t.className = `toast${bad ? ' bad' : ''}`; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, bad ? 7000 : 4500);
}

// numbers count up from 0 (elements marked data-count, with data-pre / data-post around the number)
function countUp(root, delay = 0) {
  if (REDUCED) return;
  for (const el of root.querySelectorAll('[data-count]')) {
    const to = Number(el.dataset.count), pre = el.dataset.pre || '', post = el.dataset.post || '';
    const t0 = performance.now() + delay + Number(el.dataset.i || 0) * 55;
    el.textContent = `${pre}0${post}`;
    const step = (t) => {
      const k = Math.min(1, Math.max(0, (t - t0) / 1100)), e = 1 - (1 - k) ** 3;
      el.textContent = `${pre}${Math.round(to * e)}${post}`;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
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
  if (!r.ok) {
    S.authed = true; S.state = null;
    S.accessDenied = r.status === 403 ? await r.json().catch(()=>({error:'Acces refuzat.'})) : null;
    return render();
  }
  S.accessDenied = null;
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
  if (r.ok) { S.craft = r.data; restoreCraftDraft(); render(); if (S.order.size) runCalc(); }
}

// ---- shell ---------------------------------------------------------------

const TABS = [['clasament', 'Clasament', 'trophy'], ['banda', 'Banda', 'people'], ['crafting', 'Crafting', 'tools'], ['cartier', 'Cartier', 'shield'], ['lideri', 'Lideri', 'crown'], ['security', 'Securitate', 'shield']];
function route() { const t = location.hash.replace(/^#\/?/, '').split('/')[0]; return TABS.some(([k]) => k === t) ? t : 'clasament'; }

function shell() {
  const me = $('#me'), nav = $('#nav');
  $('#quick-open').hidden = !(S.authed && S.state);
  if (!S.authed || !S.state) { me.replaceChildren(); nav.replaceChildren(); me.dataset.key = nav.dataset.key = ''; return; }
  const m = S.state.me;
  if (me.dataset.key !== m.id) {
    me.dataset.key = m.id;
    me.replaceChildren(m.avatar ? h('img', { src: m.avatar, alt: '' }) : '', h('span', { text: m.name }), h('a', { href: '/auth/logout' }, 'Ieși'));
  }
  if (nav.dataset.key !== JSON.stringify([m.permissions,m.owner])) {
    nav.dataset.key = JSON.stringify([m.permissions,m.owner]);
    nav.replaceChildren(...TABS.filter(([k]) => isVisibleTab(k)).map(([k, label, ic]) => h('a', { href: `#/${k}`, 'data-k': k }, icon(ic, 22), h('span', { text: label }))));
  }
  const tab = route();
  for (const a of nav.children) {
    if (a.dataset.k === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    if (a.dataset.k === 'cartier') {
      const unread = S.hub?.notices?.filter((n) => !n.read)?.length || 0;
      let indicator = a.querySelector('.nav-unread');
      if (unread && !indicator) { indicator = h('b', { class: 'nav-unread' }); a.append(indicator); }
      if (indicator) { indicator.textContent = String(unread); indicator.hidden = !unread; }
    }
  }
}


// Website-only weekly summary. Reads the existing /api/state payload; no new endpoints.
function paintFamilySummary() {
  const bar = $('#family-summary');
  if (!bar) return;
  if (!S.authed || !S.state || !isVisibleTab('clasament')) { bar.hidden = true; bar.replaceChildren(); return; }
  const st = S.state, members = st.members || [];
  const mine = members.find((m) => m.id === st.me.id);
  const allPoints = members.reduce((n, m) => n + (Number(m.points) || 0), 0);
  const threshold = mine ? (Number(st.cfg.prag[mine.rank]) || 0) : 0;
  const pts = mine ? Number(mine.points) || 0 : 0;
  const remaining = threshold ? Math.max(0, threshold - pts) : 0;
  const fill = threshold ? Math.min(100, Math.max(0, (pts / threshold) * 100)) : 100;
  const stat = (label, value) => h('span', { class: 'summary-stat' }, h('small', { text: label }), h('strong', { text: value }));
  bar.replaceChildren(
    h('div', { class: 'summary-identity' }, h('span', { class: 'summary-calligraphy', lang: 'ar', text: 'الصحراء' }), h('span', { class: 'summary-wordmark', text: 'FAMILIA SAHARA' })),
    h('div', { class: 'summary-stats' },
      stat('SĂPTĂMÂNA', String(st.week.no).padStart(2, '0')),
      stat('MEMBRI', String(members.length).padStart(2, '0')),
      stat('PUNCTE ÎN TOTAL', allPoints.toLocaleString('ro-RO'))),
    mine ? h('div', { class: 'summary-progress' },
      h('span', { class: 'summary-progress-label', text: threshold ? (remaining ? `${remaining}p până la pragul tău` : 'Pragul tău este atins') : 'Rank fără prag' }),
      h('span', { class: 'summary-progress-track', role: 'img', 'aria-label': `Progresul tău: ${Math.round(fill)}%` }, h('span', { style: { width: `${fill}%` } }))) : null,
    h('div', { class: 'summary-actions' },
      mine ? h('button', { type: 'button', class: 'summary-profile', onclick: () => openProfile(mine.id) }, 'Profilul meu', h('span', { 'aria-hidden': 'true', text: '↗' })) : null,
      h('button', { type: 'button', class: 'summary-refresh', title: 'Actualizează datele', 'aria-label': 'Actualizează datele', onclick: () => refresh() }, '↻'))
  );
  bar.hidden = false;
}

// Identifies the logged-in Discord account on private-page screenshots.
// All text is added as textContent (never interpreted as HTML).
function paintWatermark() {
  const layer = $('#site-watermark');
  const grid = $('#site-watermark-grid');
  const stamp = $('#site-watermark-stamp');
  if (!layer || !grid || !stamp) return;
  const me = S.authed && S.state && S.state.me;
  const id = me && String(me.id || '');
  if (!id) {
    layer.hidden = true;
    stamp.hidden = true;
    grid.replaceChildren();
    layer.dataset.key = '';
    return;
  }
  const name = String(me.name || 'Membru Sahara').trim().slice(0, 34) || 'Membru Sahara';
  const key = `${id}:${name}`;
  if (layer.dataset.key !== key) {
    layer.dataset.key = key;
    const marks = [];
    for (let i = 0; i < 48; i++) {
      const mark = document.createElement('span');
      mark.className = 'site-watermark-mark';
      const account = document.createElement('span');
      account.textContent = `SAHARA · ${name}`;
      const identifier = document.createElement('small');
      identifier.textContent = `DISCORD ID ${id}`;
      mark.append(account, identifier);
      marks.push(mark);
    }
    grid.replaceChildren(...marks);
    stamp.replaceChildren();
    const title = document.createElement('strong');
    title.textContent = `SAHARA · ${name}`;
    const meta = document.createElement('small');
    meta.textContent = `COPIE PERSONALIZATĂ · ${id}`;
    stamp.append(title, meta);
  }
  layer.hidden = false;
  stamp.hidden = false;
}

function sheet(...kids) { return h('div', { class: 'sheet-wrap' }, h('section', { class: 'sheet' }, kids)); }

function render() {
  const view = $('#view');
  shell();
  paintFamilySummary();
  paintWatermark();
  if (S.authed === null) return view.replaceChildren();
  if (!S.authed) return view.replaceChildren(sheet(h('div', { class: 'login' },
    h('h2', { text: 'Doar pentru bandă' }),
    h('p', { text: 'Autentifică-te prin Discord pentru a trimite o cerere de acces. Proprietarul aprobă fiecare membru și îi alege permisiunile.' }),
    h('a', { class: 'btn big', href: '/auth/login' }, 'Intră cu Discord'))));
  if (!S.state) {
    if (S.accessDenied) return view.replaceChildren(sheet(h('div',{class:'login access-pending'},
      h('span',{class:'access-pending-mark',text:'☪'}),
      h('h2',{text:S.accessDenied.code==='access_denied'?'Acces refuzat':S.accessDenied.code==='not_in_family'?'Acces doar pentru Familia Sahara':'Cerere în așteptare'}),
      h('p',{text:S.accessDenied.error || 'Proprietarul trebuie să aprobe accesul tău.'}),
      h('p',{class:'small muted',text:'Aprobarea se face individual. Până atunci nu poți consulta datele sau folosi funcțiile private.'}),
      h('a',{class:'btn alt',href:'/auth/logout'},'Schimbă contul Discord'),
      h('button',{class:'btn',type:'button',onclick:()=>refresh()},'↻ Verifică aprobarea'))));
    return view.replaceChildren(sheet(title('shield', 'Nu pot încărca datele', 'Botul nu răspunde acum. Reîncarcă pagina peste un minut.')));
  }
  const tab = route();
  if (!isVisibleTab(tab)) {
    const fallback = TABS.find(([k]) => isVisibleTab(k))?.[0];
    if (fallback) { if (location.hash !== '#/'+fallback) location.hash = '#/'+fallback; return; }
    return view.replaceChildren(sheet(title('shield','Nicio permisiune activă','Poți folosi portalul, dar proprietarul nu ți-a permis încă niciun modul.')));
  }
  document.title = `${TABS.find(([k]) => k === tab)[1]} - Sahara Cartel`;
  const pages = { clasament: pageBoard, banda: pageRoster, crafting: pageCraft, cartier: pageHub, lideri: pageLeaders, security: pageSecurity };
  const anim = S.anim && !REDUCED;
  S.anim = false;
  const keepScroll = S.tab === tab ? scrollY : 0;
  view.classList.toggle('anim', anim);
  view.replaceChildren(...[].concat(pages[tab]()));
  S.tab = tab;
  if (keepScroll && !anim) scrollTo(0, keepScroll);
  if (anim) countUp(view);
  if (tab === 'crafting') loadCraft();
  if (tab === 'cartier' && !S.hub && !S.hubLoading) loadHub();
}

// ---- leaderboard ---------------------------------------------------------

function pageBoard() {
  const st = S.state, cur = S.week === 'curenta' || !S.weekData;
  const rows = cur
    ? st.members.map((m) => ({ id: m.id, name: m.name, avatar: m.avatar, rank: m.rank, t: m.points })).sort((a, b) => b.t - a.t)
    : S.weekData.rows;
  const prag = cur ? st.cfg.prag : S.weekData.prag;
  const title_ = cur ? `Săptămâna ${st.week.no}` : `Săptămâna ${S.weekData.no}`;
  const sub = cur ? `Se închide peste ${countdown(st.week.end)}, duminică la miezul nopții.` : `Încheiată pe ${fmtDate(S.weekData.end - 1)}.`;
  const sel = h('select', { 'aria-label': 'Alege săptămâna', onchange: async (e) => { S.week = e.target.value; S.anim = true; if (S.week === 'curenta') render(); else await loadWeek(S.week); } },
    h('option', { value: 'curenta', selected: cur }, 'Săptămâna curentă'),
    st.archive.map((w) => h('option', { value: w.no, selected: !cur && String(S.week) === String(w.no) }, `Săptămâna ${w.no} (încheiată)`)));
  const held = (r) => { const p = prag[r.rank] || 0; return p && r.t >= p; };

  // the first three of the week
  const K = [1, 0, 2];
  const poster = (r, i) => h('div', { class: `slot s${i + 1}`, style: { '--k': K[i] } },
    h('button', { type: 'button', class: 'card', style: { '--k': K[i] }, onclick: () => openProfile(r.id) },
      h('span', { class: 'seal', text: i + 1 }),
      i === 0 ? h('span', { class: 'crown' }, icon('crown', 30)) : null,
      h('span', { class: 'photo' }, avatar(r, 120)),
      h('span', { class: 'nm', text: r.name }),
      h('span', { class: 'rk', text: `${RANK_NAME[r.rank]}${held(r) ? ', insigna ținută' : ''}` }),
      h('span', { class: 'reward' }, h('span', { 'data-count': r.t, 'data-i': i, text: r.t }), h('small', { text: 'puncte' }))),
    h('span', { class: 'ped', 'aria-hidden': 'true', text: ['I', 'II', 'III'][i] }));

  const rest = rows.slice(3);
  const ledger = h('ol', { class: 'board', start: 4 }, rest.map((r, j) => {
    const p = prag[r.rank] || 0, ok = held(r);
    return h('li', { style: { '--i': j } }, h('button', { type: 'button', onclick: () => openProfile(r.id) },
      h('span', { class: 'pos', text: j + 4 }), avatar(r),
      h('span', { class: 'who' }, h('b', { text: r.name }), h('span', { text: RANK_NAME[r.rank] })),
      h('span', { class: `meter${ok ? ' ok' : ''}${p ? '' : ' bare'}`, style: { '--i': j }, 'aria-label': p ? `${r.t} din ${p} puncte` : `${r.t} puncte` },
        p ? h('span', { class: 'track' }, h('span', { class: 'fill', style: { display: 'block', width: `${Math.min(100, (100 * r.t) / p)}%` } })) : null,
        h('span', { class: 'num', 'data-count': r.t, 'data-i': j + 3, 'data-post': p ? ` din ${p}${ok ? ', insigna ținută' : ''}` : ' puncte', text: p ? `${r.t} din ${p}${ok ? ', insigna ținută' : ''}` : `${r.t} puncte` }))));
  }));

  const body = rows.length
    ? [h('div', { class: 'podium' }, rows.slice(0, 3).map(poster)), rest.length ? ledger : null]
    : h('p', { class: 'empty muted', text: 'Nimeni nu e în evidență încă. Un lider poate adăuga oameni din secțiunea Lideri sau cu /add pe Discord.' });
  const boardTools=h('div',{class:'board-tools'},sel,
    st.me.leader ? h('button',{type:'button',class:'btn alt small board-export',onclick:()=>exportBoardCsv(rows, cur?st.week.no:S.weekData.no)},'↓ CSV') : null);
  return sheet(title('trophy', title_, sub, boardTools),
    h('p', { class: 'small muted', text: `Insigna de Membru se ține cu ${prag.membru} puncte pe săptămână, cea de Asociat cu ${prag.asociat}. Angajații nu au prag.` }),
    compareMembersPanel(rows,prag),
    body);
}

// Optional comparison uses only the rows for the selected week.
function compareMembersPanel(rows,prag) {
  if(rows.length<2) return null;
  const details=h('details',{class:'compare-members'});
  const options=()=>rows.map((r,i)=>h('option',{value:r.id,text:r.name,selected:false}));
  const left=h('select',{'aria-label':'Primul membru'},options());
  const right=h('select',{'aria-label':'Al doilea membru'},options());
  left.value=rows[0].id; right.value=rows[1].id;
  const result=h('div',{class:'compare-result'});
  const paint=()=>{
    const a=rows.find(r=>r.id===left.value),b=rows.find(r=>r.id===right.value);
    if(!a||!b) return;
    const max=Math.max(1,Number(a.t)||0,Number(b.t)||0);
    const item=(member)=>h('div',{class:'compare-line'},
      h('div',{class:'compare-name'},h('strong',{text:member.name}),h('span',{text:`${RANK_NAME[member.rank]||'Membru'} · ${Number(member.t)||0}p` })),
      h('div',{class:'compare-track'},h('span',{style:{width:`${Math.max(1,100*(Number(member.t)||0)/max)}%`}})));
    const diff=Math.abs((Number(a.t)||0)-(Number(b.t)||0));
    result.replaceChildren(item(a),item(b),h('p',{class:'compare-diff',text: a.id===b.id?'Alege doi membri diferiți.':diff===0?'Sunt la egalitate.':`${(Number(a.t)||0)>(Number(b.t)||0)?a.name:b.name} are ${diff} puncte în plus.`}));
  };
  left.addEventListener('change',paint);right.addEventListener('change',paint);
  details.append(h('summary',null,'⚖ Compară doi membri',h('span',{class:'compare-hint',text:'doar datele din clasament'})),
    h('div',{class:'compare-inner'},h('div',{class:'compare-selects'},left,right),result));
  paint();
  return details;
}

// ---- roster --------------------------------------------------------------

function pageRoster() {
  const st = S.state;
  const search = h('input', { id: 'roster-search', class: 'roster-search', type: 'text', placeholder: 'Caută un membru…', autocomplete: 'off', 'aria-label': 'Caută un membru' });
  const rankFilter = h('select', { id: 'roster-rank', class: 'roster-rank', 'aria-label': 'Filtrează după rank' },
    h('option', { value: 'all', text: 'Toate rangurile' }),
    ...RANKS.map((r) => h('option', { value: r, text: RANK_NAME[r] })));
  const favOnly=h('input',{type:'checkbox',id:'roster-fav-only'});
  const matches = h('span', { class: 'roster-matches', role: 'status', text: `${st.members.length} membri` });
  const tools = h('div', { class: 'roster-tools' },
    h('div', { class: 'roster-inputs' }, search, rankFilter, h('label',{class:'roster-favorites',for:'roster-fav-only'},favOnly,'★ Preferate')), matches);
  const blocks = RANKS.map((r) => {
    const people = st.members.filter((m) => m.rank === r).sort((a, b) => a.rankSince - b.rankSince);
    const [used, max] = st.seats[r];
    return h('div', { class: 'rank-block', 'data-rank': r },
      h('header', null, h('h3', { text: RANK_NAME[r] }),
        max ? h('span', { class: 'seats', role: 'img', 'aria-label': `${used} din ${max} locuri ocupate` }, Array.from({ length: Math.min(max, 40) }, (_, i) => h('span', { class: `seat${i < used ? ' used' : ''}`, style: { '--i': i } }, i < used ? badgeSvg(r, 18) : null))) : null,
        h('span', { class: 'small muted', text: max ? `${used} din ${max} locuri` : plural(used, 'angajat', 'angajați') })),
      people.length
        ? h('ul', { class: 'people' }, people.map((m, i) => h('li', { style: { '--i': i } },
          h('button', { type: 'button', class: 'person', 'data-name': m.name.toLocaleLowerCase('ro'), 'data-id': m.id, onclick: () => openProfile(m.id) },
            avatar(m), h('span', { class: 'who' }, h('b', { text: m.name }), h('span', { text: `în bandă ${dayText(daysSince(m.since))}` }), m.leaveUntil > Date.now() ? h('span', { class: 'tag', text: 'concediu' }) : null)))))
        : h('p', { class: 'small muted', text: 'Nimeni încă.' }));
  });
  const noMatches = h('p', { class: 'roster-no-matches muted', hidden: true, text: 'Niciun membru găsit. Încearcă alt nume sau rank.' });
  const apply = () => {
    const term = search.value.trim().toLocaleLowerCase('ro');
    const rank = rankFilter.value;
    const favorites=favoriteIds();
    let total = 0;
    for (const block of blocks) {
      let visible = 0;
      for (const person of block.querySelectorAll('.person')) {
        const show = (rank === 'all' || rank === block.dataset.rank) && person.dataset.name.includes(term) && (!favOnly.checked || favorites.has(person.dataset.id));
        person.closest('li').hidden = !show;
        if (show) visible++;
      }
      // Empty ranks remain visible only in the unfiltered view, as before.
      block.hidden = (!!term || rank !== 'all' || favOnly.checked) ? visible === 0 : false;
      total += visible;
    }
    matches.textContent = `${total} ${total === 1 ? 'membru' : 'membri'}`;
    noMatches.hidden = total !== 0;
  };
  search.addEventListener('input', apply);
  rankFilter.addEventListener('change', apply);
  favOnly.addEventListener('change',apply);
  S.rosterApply=apply;
  return sheet(title('people', 'Banda', `${plural(st.members.length, 'om', 'oameni')} în evidență. Apasă pe cineva ca să-i vezi profilul.`),
    tools, blocks, noMatches);
}

// ---- profile drawer ------------------------------------------------------

function closeDrawer() { $('#drawer').hidden = true; $('#scrim').hidden = true; document.body.style.overflow = ''; }
$('#scrim').addEventListener('click', closeDrawer);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });

// the rank as a badge: brass sheriff star (Membru), copper shield (Asociat), plain iron plate (Angajat)
let badgeN = 0;
function badgeSvg(rank, size) {
  const gid = `bg-${rank}-${++badgeN}`;
  const g = svg('svg', { class: 'badge', viewBox: '0 0 40 40', width: size, height: size, 'aria-hidden': 'true' });
  const defs = svg('defs', null, svg('linearGradient', { id: gid, x1: 0, y1: 0, x2: 1, y2: 1 },
    svg('stop', { offset: '0', 'stop-color': rank === 'membru' ? '#f0cd7a' : rank === 'asociat' ? '#d98a4a' : '#9a9184' }),
    svg('stop', { offset: '1', 'stop-color': rank === 'membru' ? '#a8761f' : rank === 'asociat' ? '#8d4a1c' : '#5f574c' })));
  g.append(defs);
  const fill = `url(#${gid})`, stroke = '#3a2412';
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
  if (prag) { g.append(svg('line', { x1: pad - 4, x2: W, y1: y(prag), y2: y(prag), stroke: '#d0563a', 'stroke-dasharray': '5 4', 'stroke-width': 1.4 }), svg('text', { x: 0, y: y(prag) + 4, 'text-anchor': 'start' }, `prag ${prag}`)); }
  weeks.forEach((w, i) => {
    const x = pad + i * ((W - pad) / weeks.length) + 4, held = prag && w.t >= (w.prag?.[w.rank] ?? prag);
    const bar = svg('rect', { x, y: y(w.t), width: bw, height: Math.max(2, H - 22 - y(w.t)), fill: held ? '#e2b455' : '#8f5a22', stroke: '#120a05', 'stroke-width': 1 });
    bar.style.setProperty('--i', i);
    g.append(bar,
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
  const favorite=h('button',{type:'button',class:'profile-favorite','aria-pressed':String(favoriteIds().has(m.id)),onclick:()=>{
    const active=toggleFavorite(m.id);
    favorite.setAttribute('aria-pressed',String(active));
    favorite.textContent=active?'★ Salvat la preferate':'☆ Adaugă la preferate';
  }},favoriteIds().has(m.id)?'★ Salvat la preferate':'☆ Adaugă la preferate');
  const kids = [
    h('div', { class: 'profile-head' }, avatar(m, 76),
      h('h2', { text: m.name }),
      favorite,
      h('p', { class: 'rank-line' }, badgeSvg(m.rank, 30), h('span', { text: RANK_NAME[m.rank] })),
      h('div', { class: 'flourish', 'aria-hidden': 'true' }, h('span', { text: '\u25c6' }))),
    h('dl', { class: 'facts' },
      h('dt', { text: 'În bandă' }), h('dd', { text: `${dayText(daysSince(m.since))}, din ${fmtDate(m.since)}` }),
      h('dt', { text: 'Rank' }), h('dd', { text: `${RANK_NAME[m.rank]} ${dayText(daysSince(m.rankSince))}` }),
      h('dt', { text: 'Săptămâna asta' }), h('dd', { 'data-count': m.points, 'data-post': prag ? ` din ${prag} puncte` : ' puncte', text: prag ? `${m.points} din ${prag} puncte` : `${m.points} puncte` })),
    prag ? h('div', { class: `meter${held ? ' ok' : ''}`, role: 'img', 'aria-label': `${m.points} din ${prag} puncte` },
      h('span', { class: 'track' }, h('span', { class: 'fill', style: { display: 'block', width: `${Math.min(100, (100 * m.points) / prag)}%` } })),
      h('span', { class: 'num', text: held ? 'Insigna ținută săptămâna asta' : `Mai sunt ${prag - m.points} puncte până la prag` })) : null,
  ];
  if (m.strikes) kids.push(h('p', { class: 'notice-line', text: `${plural(m.strikes, 'săptămână', 'săptămâni')} sub prag din ${st.cfg.toleranta} permise. La ${st.cfg.toleranta} pierde rank-ul${st.cfg.autoDemote ? '' : ' (retrogradarea e manuală)'}.` }));
  if (m.leaveUntil > Date.now()) kids.push(h('p', { class: 'notice-line', text: `În concediu până pe ${fmtDate(m.leaveUntil)}. Nu primește avertismente.` }));
  kids.push(h('h3', { text: 'Puncte săptămâna asta' }), breakdown.length ? h('ul', { class: 'breakdown' }, breakdown) : h('p', { class: 'small muted', text: 'Încă nimic.' }));
  kids.push(h('h3', { text: 'Ultimele săptămâni' }), historyChart(m));
  if (m.next) kids.push(h('h3', { text: `Avansare la ${RANK_NAME[m.next]}` }), h('p', { class: 'small', text: m.canPromote ? 'Îndeplinește condițiile și există loc liber.' : m.why }));
  if (canSee('idcard.manage') || canSee('members.manage')) kids.push(...[canSee('idcard.manage') ? idSection(m) : null, canSee('members.manage') ? leaderTools(m) : null].filter(Boolean));
  d.replaceChildren(closeBtn, h('div', { class: 'drawer-inner' }, h('div', { class: 'poster' }, ...kids)));
  d.hidden = false; $('#scrim').hidden = false; d.querySelector('.drawer-inner').scrollTop = 0;
  countUp(d, 650);
  closeBtn.focus();
}

// identity card: the in-game ID as a screenshot, kept as proof. Leaders only.
function idSection(m) {
  const file = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', hidden: true });
  const pick = h('button', { class: 'btn alt small', type: 'button', onclick: () => file.click() }, m.idCard ? 'Schimbă poza' : 'Adaugă poza');
  file.addEventListener('change', async () => {
    const f = file.files[0];
    if (!f) return;
    pick.disabled = true; pick.textContent = 'Se încarcă…';
    let blob = f;
    try { // shrink big screenshots in the browser, so the upload is small
      const bmp = await createImageBitmap(f), k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
      const cv = h('canvas', { width: Math.round(bmp.width * k), height: Math.round(bmp.height * k) });
      cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
      blob = await new Promise((ok) => cv.toBlob((b) => ok(b || f), 'image/jpeg', 0.86));
    } catch { /* send the original */ }
    const res = await fetch(`/api/idcard?u=${m.id}`, { method: 'POST', headers: { 'Content-Type': blob.type || 'application/octet-stream' }, body: blob }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    toast(data.msg || data.error || 'Nu am putut încărca poza.', !res?.ok);
    if (res?.ok) { await refresh(); openProfile(m.id); } else { pick.disabled = false; pick.textContent = m.idCard ? 'Schimbă poza' : 'Adaugă poza'; }
  });
  const src = m.idCard ? `/api/idcard?u=${m.id}&t=${m.idCard.at}` : null;
  return h('div', { class: 'idcard' },
    h('h3', { text: 'Carte de identitate' }),
    m.idCard
      ? [h('a', { href: src, target: '_blank', rel: 'noopener', 'aria-label': 'Deschide poza mare' }, h('img', { src, alt: `Cartea de identitate a lui ${m.name}`, loading: 'lazy' })),
        h('p', { class: 'small muted', text: `Adăugată pe ${fmtDate(m.idCard.at)}${m.idCard.byName ? ` de ${m.idCard.byName}` : ''}. O văd doar liderii.` })]
      : h('p', { class: 'small muted', text: 'Nu are încă. Pune un screenshot cu buletinul din joc, ca dovadă. Îl văd doar liderii.' }),
    h('p', null, pick, ' ', m.idCard ? h('button', { class: 'btn danger small', type: 'button', onclick: () => { if (confirm(`Ștergi cartea de identitate a lui ${m.name}?`)) act('/api/idcard/remove', { userId: m.id }, () => openProfile(m.id)); } }, 'Șterge') : null, file));
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
    h('h3', { text: 'Schimbă rank-ul' }),
    h('div', { class: 'row' }, h('div', null, rank), force ? h('div', { class: 'fit' }, force) : null),
    h('p', null, h('button', { class: 'btn alt', type: 'button', onclick: () => act('/api/rank', { userId: m.id, rank: rank.value, force: !!document.getElementById('r-force')?.checked }, () => openProfile(m.id)) }, 'Schimbă rank-ul')),
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
  if (!r || !r.orders?.length) return box.append(h('p', { class: 'small muted', text: 'Adaugă arme din listă. Cantitatea o poți scrie direct în căsuță.' }));
  const dl = (title, pairs) => pairs?.length ? [h('h3', { text: title }), h('dl', null, pairs.map(([n, q]) => [h('dt', { text: n }), h('dd', { text: q })]))] : [];
  box.append(...dl('Materiale necesare', r.materials), ...dl('Făcute pe parcurs', r.onTheWay), ...dl('Minereu de adunat', r.ore),
    h('h3', { text: 'Ordinea de craft' }), h('ol', null, r.order.map((o) => h('li', null, h('b', { text: o.title }), ` - ${o.text}`))),
    h('button', {class:'btn alt small craft-export',type:'button',onclick:exportCraftTxt}, '↓ Descarcă lista .txt'));
}

function setQty(name, q) {
  if (!(q > 0)) S.order.delete(name); else S.order.set(name, Math.min(1000, Math.floor(q)));
  saveCraftDraft();
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
      h('input', { type: 'number', inputmode: 'numeric', min: 1, max: 1000, value: q, 'aria-label': `Câte ${name}`, onchange: (e) => setQty(name, Number(e.target.value) || 1), onfocus: (e) => e.target.select() }),
      h('button', { type: 'button', 'aria-label': `Mai mult ${name}`, onclick: () => setQty(name, q + 1) }, '+'))));
  }
  box.append(h('p', null, h('button', { class: 'btn alt small', type: 'button', onclick: () => { S.order.clear(); setQty('', 0); } }, 'Golește comanda')));
  return box;
}

function pageCraft() {
  if (!S.craft) return sheet(title('tools', 'Crafting', 'Se încarcă rețetele…'));
  const q = h('input', { type: 'text', class: 'search', id: 'c-q', placeholder: 'Caută o armă', 'aria-label': 'Caută o armă', autocomplete: 'off' });
  const catalog = h('div', { id: 'catalog' });
  const paint = () => {
    const term = q.value.trim().toLowerCase();
    catalog.replaceChildren();
    for (const cat of S.craft.categories) {
      const items = S.craft.weapons.filter((w) => w.category === cat && (!term || w.name.toLowerCase().includes(term)));
      if (!items.length) continue;
      catalog.append(h('h3', { text: cat }), ...items.map((w, i) => h('div', { class: 'recipe', style: { '--i': Math.min(i, 12) } },
        h('b', null, w.name, w.badge ? h('span', { class: 'tag', text: w.badge }) : null),
        h('span', { class: 'ing', text: w.ingredients.map(([n, k]) => `${k} ${n}`).join(', ') }),
        h('button', { class: 'btn small', type: 'button', 'aria-label': `Adaugă ${w.name}`, onclick: () => setQty(w.name, (S.order.get(w.name) || 0) + 1) }, 'Adaugă'))));
    }
    if (!catalog.children.length) catalog.append(h('p', { class: 'muted', text: 'Nicio armă cu numele ăsta.' }));
  };
  q.addEventListener('input', paint); paint();
  queueMicrotask(() => { paintResult(); });
  return sheet(title('tools', 'Crafting', 'Adaugă armele, scrie câte vrei din fiecare și primești materialele, minereul și ordinea de craft.'),
    h('div', { class: 'craft' },
      h('div', null, q, catalog),
      h('aside', null, h('h3', { text: 'Comanda ta' }), orderList(), h('div', { id: 'result', class: 'result' }))));
}

// ---- leaders -------------------------------------------------------------

function picker({ title, multi, onChange, remote }) {
  const picked = new Map(), input = h('input', { type: 'text', class: 'search', placeholder: remote ? 'Caută pe server (min. 2 litere) sau lipește ID-ul' : 'Caută în bandă', autocomplete: 'off' });
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
  const el = h('div', null, lab('user', title), chips, input, sug, note);
  return { el, ids: () => [...picked.keys()], clear: () => { picked.clear(); paintChips(); } };
}

function pageLeaders() {
  const st = S.state;
  const give = picker({ title: 'Cine primește', multi: true, onChange: () => {} });
  const type = h('select', { id: 'p-type' }, st.types.map((t) => h('option', { value: t.value }, `${t.label}${t.pts != null ? ` (${t.pts} puncte)` : ''}`)));
  const qty = h('input', { type: 'number', id: 'p-qty', value: 1, min: -500, max: 500 });
  const qtyText = h('span', { text: 'De câte ori' }), qtyLabel = h('label', { for: 'p-qty' }, icon('repeat', 18), qtyText);
  type.addEventListener('change', () => { qtyText.textContent = type.value === 'bonus' ? 'Puncte (poate fi negativ)' : 'De câte ori'; });
  const note = h('input', { type: 'text', id: 'p-note', maxlength: 100, placeholder: 'Motiv, opțional' });

  const add = picker({ title: 'Persoana de adăugat', multi: false, remote: true, onChange: () => {} });
  const rank = h('select', { id: 'a-rank' }, ['angajat', 'asociat', 'membru'].map((r) => h('option', { value: r }, `${RANK_NAME[r]}${r === 'angajat' ? '' : ` (${st.seats[r][0]} din ${st.seats[r][1]} locuri)`}`)));

  const log = st.entries.length ? h('table', { class: 'log' },
    h('thead', null, h('tr', null, ['Când', 'Cui', 'Ce', 'Puncte', 'Notă', ''].map((t) => h('th', { text: t })))),
    h('tbody', null, st.entries.map((e) => h('tr', null, h('td', { text: fmtTime(e.at) }), h('td', { text: e.userName }), h('td', { text: `${e.label}${e.qty > 1 && e.type !== 'bonus' ? ` x${e.qty}` : ''}` }),
      h('td', { text: `${e.pts > 0 ? '+' : ''}${e.pts}` }), h('td', { text: e.note || '' }),
      h('td', null, h('button', { class: 'btn alt small', type: 'button', onclick: () => { if (confirm(`Anulezi #${e.id}: ${e.userName} ${e.pts > 0 ? '+' : ''}${e.pts} ${e.label}?`)) act('/api/undo', { id: e.id }); } }, 'Anulează'))))))
    : h('p', { class: 'small muted', text: 'Nu s-au dat puncte manual săptămâna asta.' });

  const tabs = [
    ...(canSee('points.manage') ? [['puncte', 'Puncte', 'trophy']] : []),
    ...(canSee('members.manage') ? [['banda', 'Bandă', 'plus']] : []),
    ...(canSee('announcements.manage') ? [['anunt', 'Anunț', 'horn']] : []),
    ...(canSee('config.manage') ? [['setari', 'Setări', 'sliders']] : []),
  ];
  if (!tabs.some(([k]) => k === S.ltab)) S.ltab = tabs[0]?.[0] || 'puncte';
  const bar = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Secțiuni pentru lideri' }, tabs.map(([k, label, ic]) =>
    h('button', { type: 'button', role: 'tab', 'aria-selected': String(S.ltab === k), onclick: () => { if (S.ltab !== k) { S.ltab = k; S.anim = true; render(); } } }, icon(ic, 18), label)));
  const panels = {
    puncte: () => [
      sheet(title('trophy', 'Dă puncte', 'Voice-ul se adaugă singur. Aici dai minat, task-uri, prezențe, evenimente organizate și bonusuri.'),
        give.el,
        h('div', { class: 'row' }, h('div', null, lab('flag', 'Activitate', 'p-type'), type), h('div', null, qtyLabel, qty), h('div', { class: 'grow' }, lab('note', 'Notă', 'p-note'), note)),
        h('p', { class: 'center' }, h('button', { class: 'btn big', type: 'button', onclick: async () => {
          const ok = await act('/api/give', { userIds: give.ids(), type: type.value, qty: Number(qty.value), note: note.value });
          if (ok) { give.clear(); note.value = ''; }
        } }, icon('check', 22), 'Dă puncte'))),
      sheet(title('list', 'Puncte date săptămâna asta'), h('div', { class: 'scroll' }, log))],
    banda: () => [
      sheet(title('plus', 'Adaugă în bandă', 'Caută omul pe server și alege rank-ul cu care intră. Rank-ul, concediul și cartea de identitate le schimbi din profilul lui, în pagina Banda.'), add.el,
        lab('shield', 'Rank', 'a-rank'), rank,
        h('p', { class: 'center' }, h('button', { class: 'btn', type: 'button', onclick: async () => {
          const id = add.ids()[0];
          if (!id) return toast('Alege mai întâi persoana.', true);
          if (await act('/api/add', { userId: id, rank: rank.value })) add.clear();
        } }, icon('plus', 20), 'Adaugă în bandă')))],
    anunt: () => [announceSheet()],
    setari: () => [configSheet()],
  };
  return [bar, ...panels[S.ltab]()];
}

// post an announcement (the parchment sheet from /anunt) in any channel the bot can write in
function announceSheet() {
  const ch = h('select', { id: 'an-ch', disabled: true }, h('option', { value: '' }, 'Se încarcă canalele…'));
  const ttl = h('input', { type: 'text', id: 'an-title', maxlength: 40, placeholder: 'ANUNȚ' });
  const count = h('span', { class: 'count', text: '0 din 900' });
  const txt = h('textarea', { id: 'an-text', maxlength: 900, placeholder: 'Scrie mesajul aici', oninput: () => { count.textContent = `${txt.value.length} din 900`; } });
  const ping = h('input', { type: 'checkbox', id: 'an-ping' });
  api('/api/channels').then((r) => {
    const list = r.ok ? r.data.channels : [];
    if (!list.length) { ch.replaceChildren(h('option', { value: '' }, 'Botul nu poate scrie în niciun canal')); return; }
    const groups = new Map();
    for (const c of list) { if (!groups.has(c.group)) groups.set(c.group, []); groups.get(c.group).push(c); }
    ch.replaceChildren(...[...groups].map(([g, cs]) => {
      const opts = cs.map((c) => h('option', { value: c.id, selected: c.def }, `# ${c.name}`));
      return g ? h('optgroup', { label: g }, opts) : opts;
    }).flat());
    ch.disabled = false;
  }).catch(() => {});
  const send = async (e) => {
    const name = ch.selectedOptions[0]?.textContent || '';
    if (!ch.value) return toast('Alege canalul.', true);
    if (!txt.value.trim()) return toast('Scrie mesajul anunțului.', true);
    if (!confirm(`Postezi anunțul în ${name}${ping.checked ? ', cu @everyone' : ''}?`)) return;
    const btn = e.currentTarget; btn.disabled = true;
    const r = await api('/api/announce', { channelId: ch.value, title: ttl.value, text: txt.value, ping: ping.checked }).catch(() => null);
    btn.disabled = false;
    if (!r) return;
    toast(r.data.msg || r.data.error || 'Ceva nu a mers.', !r.ok);
    if (r.ok) { txt.value = ''; ttl.value = ''; ping.checked = false; count.textContent = '0 din 900'; }
  };
  return sheet(title('horn', 'Postează un anunț', 'Botul îl pune în canalul ales, ca foaie de pergament semnată cu numele tău.'),
    h('div', { class: 'row' }, h('div', null, lab('hash', 'Canal', 'an-ch'), ch), h('div', null, lab('text', 'Titlu, opțional', 'an-title'), ttl)),
    h('label', { for: 'an-text' }, icon('note', 18), 'Mesaj', h('span', { class: 'grow' }), count), txt,
    h('label', { class: 'checks' }, ping, 'Dă ping la @everyone'),
    h('p', { class: 'center' }, h('button', { class: 'btn big', type: 'button', onclick: send }, icon('horn', 22), 'Postează anunțul')));
}

function configSheet() {
  const c = S.state.cfg, groups = [
    ['Puncte pe activitate', 'Câte puncte aduce fiecare lucru.', [['mina', 'O mină', c.values.mina], ['task', 'Un task', c.values.task], ['prezenta', 'Prezență la eveniment', c.values.prezenta], ['organizat', 'Eveniment organizat', c.values.organizat]]],
    ['Voice', 'Se adună singur cât stai pe voice cu cineva.', [['voice', 'Puncte pe oră', c.values.voice], ['plafon_voice', 'Maximum pe săptămână', c.caps.voice || 0]]],
    ['Insigne', 'Punctele de făcut pe săptămână și câte locuri sunt.', [['prag_membru', 'Prag Membru', c.prag.membru], ['prag_asociat', 'Prag Asociat', c.prag.asociat], ['locuri_membru', 'Locuri de Membru', c.slots.membru], ['locuri_asociat', 'Locuri de Asociat', c.slots.asociat]]],
    ['Retrogradare și promovare', 'Câte săptămâni contează înainte să se schimbe rank-ul.', [['toleranta', 'Săptămâni sub prag până la retrogradare', c.toleranta], ['saptamani_promovare', 'Săptămâni peste prag pentru promovare', c.promoWeeks]]],
  ];
  const inputs = [];
  const demote = h('input', { type: 'checkbox', id: 'cfg-demote', checked: c.autoDemote });
  const blocks = groups.map(([name, sub, fields], gi) => h('fieldset', { class: 'group' }, h('legend', { text: name }), h('p', { class: 'small muted', text: sub }),
    h('div', { class: 'cfg-grid' }, fields.map(([k, label, v]) => {
      const el = h('input', { type: 'number', id: `cfg-${k}`, value: v, min: 0, max: 1000 });
      inputs.push({ k, el });
      return h('div', null, h('label', { for: `cfg-${k}`, text: label }), el);
    })),
    gi === 3 ? h('label', { class: 'checks' }, demote, 'Retrogradare automată după toleranță') : null));
  return sheet(title('sliders', 'Setări', 'Valorile noi se aplică de acum. Punctele deja date rămân cum au fost.'),
    h('div', { class: 'groups' }, blocks),
    h('p', { class: 'center' }, h('button', { class: 'btn big', type: 'button', onclick: () => act('/api/config', { ...Object.fromEntries(inputs.map(({ k, el }) => [k, el.value])), retrogradare: demote.checked }) }, icon('check', 22), 'Salvează setările')));
}

// ---- go ------------------------------------------------------------------

window.addEventListener('hashchange', () => { closeDrawer(); S.anim = true; render(); scrollTo(0, 0); });
// ---- ambience: dust and embers, pointer parallax, lantern ------

function startDust() {
  const cv = $('#dust');
  if (!cv || REDUCED) return;
  const ctx = cv.getContext('2d');
  let W = 1, H = 1, running = false, last = 0;
  const size = () => { const r = cv.getBoundingClientRect(); W = cv.width = Math.max(1, Math.round(r.width)); H = cv.height = Math.max(1, Math.round(r.height)); };
  size(); addEventListener('resize', size);
  const spawn = (p, init) => {
    const ember = Math.random() < 0.55;
    Object.assign(p, { ember, r: ember ? 1 + Math.random() * 1.8 : 2 + Math.random() * 5, ph: Math.random() * 6.28, a: ember ? 0.5 + Math.random() * 0.5 : 0.05 + Math.random() * 0.1, hue: ember ? 28 + Math.random() * 22 : 36,
      vx: ember ? 6 + Math.random() * 14 : 18 + Math.random() * 40, vy: ember ? -(14 + Math.random() * 34) : -2 - Math.random() * 6 });
    p.x = init ? Math.random() * W : ember ? Math.random() * W : -10;
    p.y = init ? Math.random() * H : ember ? H + 10 : Math.random() * H;
    return p;
  };
  const parts = Array.from({ length: innerWidth < 600 ? 34 : 64 }, () => spawn({}, true));
  function frame(t) {
    if (!running) return;
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    const gust = Math.sin(t / 4200) * 0.5 + Math.sin(t / 1700) * 0.3 + 0.7;
    ctx.clearRect(0, 0, W, H); ctx.globalCompositeOperation = 'lighter';
    for (const p of parts) {
      p.ph += dt * (p.ember ? 5 : 1.2);
      p.x += (p.vx * gust + Math.sin(p.ph) * (p.ember ? 14 : 4)) * dt; p.y += p.vy * dt;
      if (p.x > W + 20 || p.y < -20) spawn(p, false);
      const rad = p.r * (p.ember ? 3.2 : 2), fl = p.ember ? 0.6 + 0.4 * Math.sin(p.ph * 2.3) : 1;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad);
      g.addColorStop(0, `hsla(${p.hue},95%,${p.ember ? 65 : 75}%,${p.a * fl})`); g.addColorStop(1, 'hsla(30,90%,50%,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, 6.283); ctx.fill();
    }
    requestAnimationFrame(frame);
  }
  const setRun = (v) => { if (v && !running) { running = true; last = performance.now(); requestAnimationFrame(frame); } else if (!v) running = false; };
  let inView = true;
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; setRun(inView && !document.hidden); }).observe($('#hero'));
  document.addEventListener('visibilitychange', () => setRun(inView && !document.hidden));
  setRun(true);
}

function startPointerFx() {
  if (REDUCED || !matchMedia('(pointer: fine)').matches) return;
  const par = document.querySelector('.parallax'), lantern = $('#lantern'), root = document.documentElement.style;
  let tx = 0, ty = 0, cx = 0, cy = 0;
  addEventListener('pointermove', (e) => {
    tx = (e.clientX / innerWidth - 0.5) * -2; ty = (e.clientY / innerHeight - 0.5) * -2;
    root.setProperty('--mx', `${e.clientX}px`); root.setProperty('--my', `${e.clientY}px`); lantern.classList.add('on');
  }, { passive: true });
  document.addEventListener('pointerleave', () => lantern.classList.remove('on'));
  (function loop() {
    cx += (tx - cx) * 0.06; cy += (ty - cy) * 0.06;
    par.style.transform = `translate3d(${(cx * 16).toFixed(2)}px, ${(cy * 9).toFixed(2)}px, 0)`;
    requestAnimationFrame(loop);
  })();
}

startDust(); startPointerFx();
refresh();
setInterval(() => { if (!document.hidden && S.authed) refresh(true); }, 60_000);
