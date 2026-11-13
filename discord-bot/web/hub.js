'use strict';
// Family Hub screens. Uses existing helpers (h, api, sheet, title, toast, S, etc.) in app.js.
// All new writes go through /api/hub; no Discord commands or points are modified.
const HUB_TABS = [
  ['war', 'War Room', '♜'],
  ['contracts', 'Contracte', '◈'],
  ['dossiers', 'Dosare', '♟'],
  ['treasury', 'Trezorerie', '✦'],
  ['orders', 'Comenzi', '⚒'],
  ['events', 'Calendar', '◷'],
  ['polls', 'Voturi', '◆'],
  ['feed', 'Jurnal', '☷'],
  ['notices', 'Notificări', '✧'],
];
const HUB_STATUS = {
  planned: 'Planificată', active: 'În desfășurare', done: 'Finalizată', cancelled: 'Anulată',
  new: 'Nouă', in_progress: 'În lucru', ready: 'Pregătită', delivered: 'Livrată',
  claimed: 'Acceptat', submitted: 'De verificat', approved: 'Aprobat', rejected: 'Respins',
  going: 'Particip', maybe: 'Poate', open: 'Deschis', closed: 'Închis',
};
const HUB_UNITS = [['aur', 'Aur'], ['bani', 'Bani'], ['fier', 'Fier'], ['lemn', 'Lemn'], ['cupru', 'Cupru'], ['carbune', 'Cărbune'], ['otel', 'Oțel'], ['alte', 'Altele']];
const hb = (tag, props, ...kids) => h(tag, props, ...kids);
const hubTab = () => HUB_TABS.some(([key]) => key === location.hash.split('/')[2] && canSeeHub(key)) ? location.hash.split('/')[2] : (HUB_TABS.find(([key]) => canSeeHub(key))?.[0] || 'notices');
const hubName = (id) => S.state?.members?.find((u) => u.id === id)?.name || (id === S.state?.me?.id ? S.state.me.name : 'Membru');
const hubDate = (ts) => ts ? new Intl.DateTimeFormat('ro-RO', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', timeZone: typeof tz === 'function' ? tz() : 'Europe/Bucharest' }).format(new Date(ts)) : '—';
const hubEmpty = (msg) => hb('div', { class:'hub-empty' }, hb('span', { class:'hub-empty-symbol', text:'◇' }), hb('strong', { text:'Momentan este liniște aici.' }), hb('p', { text:msg }));
const hubPill = (name) => hb('span', { class:`hub-pill ${['ready','approved','going','done','delivered'].includes(name) ? 'hub-good' : ''}` , text:HUB_STATUS[name] || name });
const hubMeta = (label, text) => hb('span', { class:'hub-meta-pair' }, hb('b', { text:label }), hb('span', { text:String(text ?? '—') }));
const hubLink = (title, label, handler, style = 'alt') => hb('button', { type:'button', class:`btn small ${style}`, onclick:handler }, title);
const hubButton = (title, onClick, css = '') => hb('button', { type:'button', class:`hub-action ${css}`, onclick:onClick }, title);

async function loadHub(force = false) {
  if (S.hubLoading || (S.hub && !force)) return;
  S.hubLoading = true;
  try {
    const response = await api('/api/hub');
    if (!response.ok) throw new Error(response.data.error || 'Nu am putut încărca panoul.');
    S.hub = response.data;
    S.hubError = '';
  } catch (error) { S.hubError = error.message || 'Conexiune indisponibilă.'; }
  finally { S.hubLoading = false; if (typeof route === 'function' && route() === 'cartier') { S.anim = false; render(); } }
}
async function hubAction(fields, opts = {}) {
  try {
    const response = await api('/api/hub', fields);
    if (!response.ok) return toast(response.data.error || response.data.msg || 'Acțiunea a fost respinsă.', true);
    S.hub = response.data.hub;
    S.anim = false;
    if (opts.next) { location.hash = `#/cartier/${opts.next}`; } else render();
    toast(opts.message || 'Salvat.');
    return true;
  } catch { toast('Nu am putut trimite cererea. Verifică conexiunea.', true); return false; }
}

function hubForm(titleText, schema, makeAction, help = '') {
  const inputs = {};
  const fields = schema.map((f) => {
    const node = f.type === 'textarea' ? hb('textarea', { name:f.name, rows:3, maxlength:f.max || 450, placeholder:f.placeholder || '' }) :
      f.type === 'select' ? hb('select', { name:f.name }, f.options.map(([v,label]) => hb('option', { value:v, text:label }))) :
      hb('input', { type:f.type || 'text', name:f.name, value:f.value == null ? '' : f.value, placeholder:f.placeholder || '', required:f.required !== false, min:f.min, max:f.max, maxlength:f.limit || 160, step:f.step });
    if (f.type === 'textarea' && f.required !== false) node.required = true;
    inputs[f.name] = node;
    return hb('div', { class:`hub-field ${f.wide ? 'hub-wide' : ''}` }, hb('label', { text:f.label }), node);
  });
  const btn = hb('button', { type:'submit', class:'btn', text:'Salvează' });
  const form = hb('form', { class:'hub-form', onsubmit:async (event) => {
    event.preventDefault();
    if (btn.disabled) return;
    btn.disabled = true;
    const v = Object.fromEntries(Object.entries(inputs).map(([k, input]) => [k, input.type === 'datetime-local' && input.value ? new Date(input.value).toISOString() : input.value]));
    const payload = makeAction(v);
    const ok = await hubAction(payload);
    btn.disabled = false;
    if (ok) form.reset();
  } }, hb('div', { class:'hub-form-grid' }, fields), help ? hb('p', { class:'small muted', text:help }) : null, hb('div', { class:'hub-form-footer' }, btn));
  return hb('details', { class:'hub-create' }, hb('summary', null, hb('span', { text:`+ ${titleText}` }), hb('span', { text:'Deschide formularul' })), form);
}
function hubEntry(item, body, actions) {
  return hb('article', { class:'hub-entry' },
    hb('header', { class:'hub-entry-header' },
      hb('div', { class:'hub-entry-copy' }, hb('span', { class:'hub-overline', text:item.kicker || 'SAHARA CARTEL' }), hb('h3', { text:item.title }), item.subtitle ? hb('p', { text:item.subtitle }) : null),
      item.state ? hubPill(item.state) : null),
    body,
    actions?.length ? hb('footer', { class:'hub-entry-actions' }, actions) : null);
}
const hubList = (children) => hb('div', { class:'hub-list' }, children);

function pageHub() {
  const current = hubTab();
  const metadata = HUB_TABS.find(([key]) => key === current);
  const leader = !!S.state?.me?.permissions?.[`hub.${current}.manage`];
  const count = (key) => S.hub?.[key]?.length || 0;
  const unread = S.hub?.notices?.filter((n) => !n.read)?.length || 0;
  const nav = hb('div', { class:'hub-tabs', role:'navigation', 'aria-label':'Module Cartier' }, HUB_TABS.filter(([key])=>canSeeHub(key)).map(([key,label,symbol]) =>
    hb('a', { href:`#/cartier/${key}`, class:`hub-tab ${current === key ? 'selected' : ''}`, 'aria-current': current === key ? 'page' : null, 'data-hub-key': key },
      hb('span', { class:'hub-tab-symbol', 'aria-hidden': 'true', text:'' }), hb('span', { class:'hub-tab-label', text:label }), key === 'notices' && unread ? hb('b', { class:'hub-tab-count', text:unread }) : null)));
  const intro = hb('div', { class:'hub-intro' },
    hb('div', null, hb('span', { class:'hub-arabic', lang:'ar', text:'مجلس الصحراء' }), hb('h2', { text:'Cartierul familiei' }),
      hb('p', { text:'Operațiuni, contracte, resurse și decizii. Totul la un loc.' })),
    hb('button', { type:'button', class:'hub-refresh', onclick:() => loadHub(true), 'aria-label':'Actualizează Cartierul' }, '↻ Actualizează'));
  const header = hb('div', { class:'hub-current' }, hb('div', null, hb('span', { class:'hub-overline', text:`SAHARA / ${metadata[1].toUpperCase()}` }),
    hb('h3', { text:metadata[1] })), hb('span', { class:'hub-count', text: current === 'notices' ? `${unread} necitite` : `${count(current === 'dossiers' ? 'dossiers' : current)} înregistrări` }));
  let content;
  if (!S.hub) content = S.hubError ? hubEmpty(S.hubError) : hubEmpty('Se încarcă informațiile…');
  else {
    const renderers = { war:hubWar, contracts:hubContracts, dossiers:hubDossiers, treasury:hubTreasury, orders:hubOrders, events:hubEvents, polls:hubPolls, feed:hubFeed, notices:hubNotices };
    content = renderers[current](S.hub, leader);
  }
  return [hb('section', { class:'hub-shell' }, intro, nav, header, content)];
}

function hubWar(data, leader) {
  const form = leader ? hubForm('Planifică o operațiune', [
    { name:'title', label:'Numele operațiunii', required:true, placeholder:'Ex. Transport la Blackwater' },
    { name:'at', label:'Data și ora', type:'datetime-local', required:true },
    { name:'location', label:'Locație', placeholder:'Ex. Caliga Hall' },
    { name:'capacity', label:'Locuri', type:'number', value:12, min:1, max:100 },
    { name:'description', label:'Plan și obiective', type:'textarea', wide:true, required:false, max:480 },
  ], (v) => ({ action:'war.create', ...v })) : null;
  const entries = data.war.map((o) => {
    const joined = o.participants?.includes(S.state.me.id);
    const active = ['planned','active'].includes(o.state);
    const b = hb('div', { class:'hub-entry-body' },
      hb('div', { class:'hub-metadata' }, hubMeta('Când',hubDate(o.at)),hubMeta('Locație',o.location),hubMeta('Echipă', `${o.participants?.length || 0} / ${o.capacity}`)),
      o.description ? hb('p', { text:o.description }) : null,
      hb('div', { class:'hub-people' }, (o.participants || []).map((uid) => hb('span', { class:'hub-person-tag', text:hubName(uid) }))));
    const acts = [active ? hubButton(joined ? '✓ Renunță la participare' : '+ Mă înscriu', () => hubAction({ action:'war.join', id:o.id })) : null];
    if (leader) acts.push(hb('select', { class:'hub-status-select', 'aria-label':`Status ${o.title}`, onchange:(e) => hubAction({action:'war.status', id:o.id, state:e.target.value}) },
      [['planned','Planificată'],['active','În desfășurare'],['done','Finalizată'],['cancelled','Anulată']].map(([k,v]) => hb('option', { value:k, selected:o.state===k, text:v }))));
    return hubEntry({ title:o.title, subtitle:'Operațiune organizată de lideri', kicker:'WAR ROOM / OPERAȚIUNE', state:o.state }, b, acts.filter(Boolean));
  });
  return hb('div', null, form, entries.length ? hubList(entries) : hubEmpty('Liderii pot planifica prima operațiune și pot deschide înscrierile.'));
}

function hubContracts(data, leader) {
  const form = leader ? hubForm('Publică un contract', [
    { name:'title',label:'Titlul contractului',placeholder:'Ex. Livrare de materiale' },
    { name:'due',label:'Termen limită',type:'datetime-local' },
    { name:'capacity',label:'Număr maxim de participanți',type:'number',value:6,min:1,max:60 },
    { name:'reward',label:'Recompensă (text)',placeholder:'Ex. 50 aur / 15 puncte manual',required:false },
    { name:'description',label:'Obiectiv și instrucțiuni',type:'textarea',wide:true,max:450 },
  ], (v) => ({ action:'contract.create', ...v }), 'Punctele nu se acordă automat. Liderii le pot acorda din panoul Puncte după aprobare.') : null;
  const entries = data.contracts.map((c) => {
    const mine = c.claims.find((x) => x.userId === S.state.me.id);
    const closed = c.closed || c.due < Date.now();
    const body = hb('div', { class:'hub-entry-body' },
      hb('div', { class:'hub-metadata' }, hubMeta('Termen',hubDate(c.due)),hubMeta('Recompensă',c.reward),hubMeta('Locuri',`${c.claims.length}/${c.capacity}`)),
      hb('p', { text:c.description }),
      c.claims.length ? hb('div', { class:'hub-participants' }, c.claims.map((x) =>
        hb('div', { class:'hub-claim' }, hb('span', { text:hubName(x.userId) }),hubPill(x.state),
          leader && x.state === 'submitted' ? hb('span', { class:'hub-inline-actions' },
            hubButton('Aprobă',()=>hubAction({action:'contract.review',id:c.id,userId:x.userId,state:'approved'})),
            hubButton('Respinge',()=>hubAction({action:'contract.review',id:c.id,userId:x.userId,state:'rejected'}))) : null))) : null);
    const acts = [];
    if (!mine && !closed && c.claims.length < c.capacity) acts.push(hubButton('Acceptă contractul',()=>hubAction({ action:'contract.claim',id:c.id })));
    if (mine?.state === 'claimed') acts.push(hubButton('Trimite spre verificare',()=>hubAction({action:'contract.submit',id:c.id,note:''})));
    if (mine && mine.state !== 'claimed') acts.push(hubPill(mine.state));
    if (leader) acts.push(hubButton(c.closed ? 'Redeschide' : 'Închide contractul',()=>hubAction({action:'contract.close',id:c.id,closed:!c.closed})));
    return hubEntry({title:c.title, subtitle:closed ? 'Contract închis' : 'Deschis pentru membri',kicker:'CONTRACT BOARD',state:closed?'closed':'open'},body,acts);
  });
  return hb('div', null, form, entries.length ? hubList(entries) : hubEmpty('Publică o misiune nouă și membrii o vor putea accepta.'));
}

function hubDossiers(data) {
  const people = [...data.dossiers].sort((a,b) => a.name.localeCompare(b.name,'ro'));
  const selected = people.find((p) => p.id === S.hubDossier) || people.find((p) => p.id === S.state.me.id) || people[0];
  if (!selected) return hubEmpty('Nu sunt membri înregistrați încă.');
  const mine = S.state.members.find((m) => m.id === selected.id) || selected;
  const needed = Number(S.state.cfg.prag[mine.rank]) || 0;
  const amount = Number(mine.points) || 0;
  const progress = needed ? Math.min(100,Math.round(amount / needed * 100)) : 100;
  const activity = data.feed.filter((f) => f.actor === selected.id).slice(0, 8);
  const select = hb('select', { class:'hub-dossier-select', 'aria-label':'Alege un membru', onchange:e=>{S.hubDossier=e.target.value;S.anim=false;render();} },
    people.map((m) => hb('option', { value:m.id,selected:m.id===selected.id,text:`${m.name} · ${RANK_NAME[m.rank] || m.rank}` })));
  const stats = hb('div', { class:'hub-dossier-stats' },
    hubMeta('Rang', RANK_NAME[mine.rank] || mine.rank),
    hubMeta('Puncte curente', amount),
    hubMeta('În bandă', mine.since ? hubDate(mine.since) : '—'),
    hubMeta('Status', mine.status || (mine.leaveUntil > Date.now() ? 'concediu' : 'activ')));
  const progressBar = hb('div', { class:'hub-member-progress' },hb('div', null,hb('span', {text:'Progres prag săptămânal'}),hb('strong', {text:needed ? `${amount} / ${needed}` : 'Fără prag'})),
    hb('span', {class:'hub-member-track'},hb('span',{style:{width:`${progress}%`}})));
  const countEvents = data.events.filter((e) => e.responses?.[mine.id] === 'going').length;
  const countContracts = data.contracts.filter((c) => c.claims.some((x) => x.userId === mine.id && x.state === 'approved')).length;
  const countWar = data.war.filter((w) => w.participants?.includes(mine.id)).length;
  return hb('div', { class:'hub-dossier' },
    hb('div', {class:'hub-dossier-picker'},hb('label',{text:'Alege membrul'}),select),
    hb('div',{class:'hub-dossier-identity'},avatar(mine,92),hb('div',null,hb('span',{class:'hub-overline',text:'MEMBER DOSSIER / SAHARA CARTEL'}),hb('h3',{text:mine.name}),hb('p',{text:`${RANK_NAME[mine.rank] || mine.rank} · ${mine.status || 'activ'}`})),
      hubButton('Deschide profilul',()=>openProfile(mine.id))),
    stats, progressBar,
    hb('div',{class:'hub-dossier-figures'},hubMeta('Operațiuni înscrise',countWar),hubMeta('Evenimente confirmate',countEvents),hubMeta('Contracte aprobate',countContracts)),
    hb('h3',{class:'hub-subheading',text:'Activitate recentă'}),
    activity.length ? hubList(activity.map((f)=>hb('div',{class:'hub-feed-row'},hb('span',{class:'hub-feed-time',text:hubDate(f.at)}),hb('p',{text:`${f.action} ${f.subject}`})))) : hubEmpty('Nu există activitate nouă în acest modul pentru membrul selectat.'));
}

function hubTreasury(data, leader) {
  const balances = hb('div',{class:'hub-balance-grid'},HUB_UNITS.map(([code,label])=>hb('div',{class:'hub-balance','data-unit':code},hb('span',{text:label}),hb('strong',{text:Number(data.balances[code]||0).toLocaleString('ro-RO')}))));
  const form = leader ? hubForm('Înregistrează o tranzacție', [
    {name:'direction',label:'Tip',type:'select',options:[['in','Depunere'],['out','Retragere']]},
    {name:'unit',label:'Resursă',type:'select',options:HUB_UNITS},
    {name:'amount',label:'Cantitate',type:'number',min:1,max:1000000,value:1},
    {name:'note',label:'Motiv / proveniență',placeholder:'Ex. Materiale colectate la mină',wide:true},
  ],v=>({action:'treasury.add',...v})) : null;
  const ledger = data.treasury.slice(0,60).map((t)=>hb('div',{class:'hub-treasury-row'},
    hb('span',{class:`hub-amount ${t.delta>0?'positive':'negative'}`,text:`${t.delta>0?'+':''}${t.delta} ${t.unit}`}),
    hb('div',null,hb('strong',{text:t.note}),hb('small',{text:`${t.byName} · ${hubDate(t.at)}`}))));
  return hb('div',null,balances,form,hb('h3',{class:'hub-subheading',text:'Registrul de tranzacții'}),ledger.length?hubList(ledger):hubEmpty('Soldul începe de la zero. Liderii pot înregistra prima depunere.'));
}

function hubOrders(data, leader) {
  if (!S.craft) { if (!S.hubCraftPending) { S.hubCraftPending=true; loadCraft().finally(()=>{S.hubCraftPending=false;}); } }
  const weapons = S.craft?.weapons || [];
  const form = weapons.length ? hubForm('Plasează o comandă',[
    {name:'weapon',label:'Armă',type:'select',options:weapons.map((w)=>[w.name, w.name])},
    {name:'quantity',label:'Cantitate',type:'number',min:1,max:99,value:1},
    {name:'note',label:'Instrucțiuni (opțional)',type:'textarea',required:false,wide:true,max:240},
  ],v=>({action:'order.create',...v})) : hb('p',{class:'small muted',text:'Se încarcă rețetele din catalogul existent…'});
  const entries = data.orders.map((o)=>{
    const body = hb('div',{class:'hub-entry-body'},hb('div',{class:'hub-metadata'},hubMeta('Cerut de',o.ownerName),hubMeta('Cantitate',o.quantity),hubMeta('Plasată',hubDate(o.at))),o.note ? hb('p',{text:o.note}):null);
    const actions=[];
    if (leader) actions.push(hb('select',{class:'hub-status-select',onchange:e=>hubAction({action:'order.status',id:o.id,state:e.target.value}),'aria-label':`Schimbă status comanda ${o.weapon}`},
      [['new','Nouă'],['in_progress','În lucru'],['ready','Gata'],['delivered','Livrată'],['cancelled','Anulată']].map(([k,label])=>hb('option',{value:k,selected:k===o.state,text:label}))));
    else if (o.state==='new') actions.push(hubButton('Anulează comanda',()=>hubAction({action:'order.status',id:o.id,state:'cancelled'})));
    return hubEntry({title:`${o.quantity} × ${o.weapon}`,kicker:'ATELIER / COMANDĂ',state:o.state},body,actions);
  });
  return hb('div',null,form,hb('h3',{class:'hub-subheading',text:leader?'Toate comenzile':'Comenzile mele'}),entries.length?hubList(entries):hubEmpty('Când plasezi o comandă din catalog, aceasta apare aici și poate fi preluată de lideri.'));
}

function hubEvents(data, leader) {
  const form = leader ? hubForm('Adaugă în calendar',[
    {name:'title',label:'Eveniment',placeholder:'Ex. Antrenament de luptă'},
    {name:'at',label:'Data și ora',type:'datetime-local'},
    {name:'location',label:'Locație',placeholder:'Ex. Valentine',required:false},
    {name:'capacity',label:'Locuri',type:'number',min:1,max:200,value:25},
    {name:'description',label:'Descriere / reguli',type:'textarea',required:false,wide:true,max:450},
  ],v=>({action:'event.create',...v})) : null;
  const events = [...data.events].sort((a,b)=>a.at-b.at).map((e)=>{
    const current = e.responses?.[S.state.me.id] || 'none';
    const attending = Object.values(e.responses || {}).filter(x=>x==='going').length;
    const body = hb('div',{class:'hub-entry-body'},
      hb('div',{class:'hub-metadata'},hubMeta('Data',hubDate(e.at)),hubMeta('Locație',e.location),hubMeta('Participanți',`${attending}/${e.capacity}`)),
      e.description?hb('p',{text:e.description}):null);
    const acts=[];
    if(e.status==='open'&&e.at>Date.now()) for(const [key,label] of [['going','Particip'],['maybe','Poate'],['none','Renunță']])
      if(key!=='none'||current!=='none')acts.push(hubButton((current===key?'✓ ':'')+label,()=>hubAction({action:'event.rsvp',id:e.id,answer:key}),current===key?'active':''));
    if(leader) acts.push(hb('select',{class:'hub-status-select','aria-label':`Status ${e.title}`,onchange:ev=>hubAction({action:'event.status',id:e.id,state:ev.target.value})},
      [['open','Deschis'],['closed','Închis'],['cancelled','Anulat']].map(([k,v])=>hb('option',{value:k,selected:e.status===k,text:v}))));
    return hubEntry({title:e.title,kicker:'CALENDAR / EVENIMENT',state:e.status},body,acts);
  });
  return hb('div',null,form,events.length?hubList(events):hubEmpty('Liderii pot adăuga evenimente în calendar și pot urmări înscrierile.'));
}

function hubPolls(data, leader) {
  const form = leader ? hubForm('Deschide un vot',[
    {name:'title',label:'Întrebarea',placeholder:'Ex. Ce eveniment organizăm sâmbătă?',wide:true},
    {name:'endsAt',label:'Se închide',type:'datetime-local'},
    {name:'options',label:'Variante de răspuns (una pe rând)',type:'textarea',wide:true,placeholder:'Antrenament\nTurneu\nCursă',max:600},
  ],v=>({action:'poll.create',title:v.title,endsAt:v.endsAt,options:v.options.split('\n').map(x=>x.trim()).filter(Boolean)})) : null;
  const entries = data.polls.map((p)=>{
    const closed = p.closed || p.endsAt<=Date.now();
    const body = hb('div',{class:'hub-vote-options'},p.options.map((option,i)=>{
      const percentage = p.total ? Math.round((p.counts[i]/p.total)*100) : 0;
      return hb('button',{type:'button',class:`hub-vote-option ${p.myVote===i?'picked':''}`,disabled:closed,onclick:()=>hubAction({action:'poll.vote',id:p.id,option:i})},
        hb('span',{class:'hub-vote-bar',style:{width:`${percentage}%`}}),
        hb('span',{class:'hub-vote-text',text:`${p.myVote===i?'✓ ':''}${option}`}),
        hb('small',{text:`${p.counts[i]} · ${percentage}%`}));
    }),hb('div',{class:'hub-poll-foot'},hb('span',{text:`${p.total} voturi`}),hb('span',{text:`Până la ${hubDate(p.endsAt)}`})));
    const acts=leader&&!closed?[hubButton('Închide votul',()=>hubAction({action:'poll.close',id:p.id}))]:[];
    return hubEntry({title:p.title,kicker:'SISTEM DE VOT / FAMILIE',state:closed?'closed':'open'},body,acts);
  });
  return hb('div',null,form,entries.length?hubList(entries):hubEmpty('Liderii pot deschide primul vot al familiei.'));
}

function hubFeed(data) {
  const filters=[['all','Tot'],['war','Operațiuni'],['contract','Contracte'],['order','Comenzi'],['event','Evenimente'],['treasury','Trezorerie'],['poll','Voturi']];
  if(!filters.some(([k])=>k===S.hubFeedFilter))S.hubFeedFilter='all';
  const select=hb('select',{class:'hub-feed-filter','aria-label':'Filtrează jurnalul',onchange:e=>{S.hubFeedFilter=e.target.value;S.anim=false;render();}},filters.map(([k,v])=>hb('option',{value:k,selected:k===S.hubFeedFilter,text:v})));
  const entries=data.feed.filter((e)=>S.hubFeedFilter==='all'||e.kind===S.hubFeedFilter);
  return hb('div',null,hb('div',{class:'hub-filter-toolbar'},hb('span',{text:'Ultimele acțiuni înregistrate în Cartier'}),select),
    entries.length?hubList(entries.map((e)=>hb('div',{class:'hub-feed-row'},hb('span',{class:'hub-feed-time',text:hubDate(e.at)}),
      hb('span',{class:'hub-feed-indicator',text:'✧'}),hb('p',null,hb('strong',{text:hubName(e.actor)||e.actorName}),' ',e.action,' ',hb('b',{text:e.subject}))))):hubEmpty('Aici va apărea activitatea nouă din celelalte module.'));
}

function hubNotices(data) {
  const unread=data.notices.filter((n)=>!n.read).length;
  const mark=unread?hubButton('Marchează toate ca citite',()=>hubAction({action:'notice.read',all:true})) : null;
  const dmToggle=hubButton(S.state.me.dm ? '✉ Discord DM: ACTIVATE' : '✉ Discord DM: DEZACTIVATE',()=>toggleDirectMessages(),S.state.me.dm?'active':'');
  const list=data.notices.map((n)=>hb('button',{type:'button',class:`hub-notice ${n.read?'read':''}`,onclick:async()=>{
    if(!n.read)await hubAction({action:'notice.read',id:n.id});
    if(HUB_TABS.some(([key])=>key===n.target))location.hash=`#/cartier/${n.target}`;
  }},hb('span',{class:'hub-notice-dot',text:n.read?'○':'●'}),
    hb('span',{class:'hub-notice-copy'},hb('strong',{text:n.title}),hb('span',{text:n.text}),hb('small',{text:hubDate(n.at)})),hb('span',{class:'hub-notice-arrow',text:'↗'})));
  return hb('div',null,hb('div',{class:'hub-notices-tools'},dmToggle,mark),hb('p',{class:'hub-dm-explainer',text:'Dacă ai mesaje private activate în Discord, botul îți trimite acolo notificările importante. Poți dezactiva DM-urile oricând.'}),list.length?hubList(list):hubEmpty('Nu ai notificări noi. Vei vedea aici actualizări relevante din Cartier.'));
}
