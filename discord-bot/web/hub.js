'use strict';
// Community section (uses the lightweight DOM helpers in app.js; script is loaded before app.js).
const HUB_LINKS=[
  ['rankings','Leaderboard','Clasamente pentru Persona Non Grata, Discord și jocurile preferate','🏆'],
  ['analytics','Community Analytics','Statistici de gaming și activitate live','📊'],
  ['lfg','Find Your Squad','Găsește echipă pentru jocul tău','🎮'],
  ['evenimente','Events','Înscrieri, calendare și reminder-e','📅'],
  ['turnee','Tournament Hub','Bracket, bye-uri și rezultate','⚔️'],
  ['voturi','Game of the Week','Votează jocul săptămânii','🗳️'],
  ['lansari','Release Calendar','Urmărește lansări și DLC-uri','🚀'],
  ['recomandari','For You','Recomandări personalizate de jocuri','✨'],
  ['profil','Player Profile','Activitate, achievements, streak și notificări','👤'],
];
const hubHead=(title,desc)=>h('div',{class:'pagehead'},h('h1',{text:title}),h('p',{text:desc}));
const hubSec=(title,sub,contents)=>h('section',{class:'sec'},sectionHead(title,sub),contents);
const hrs=(ms)=>`${(Math.max(0,Number(ms)||0)/3600000).toLocaleString('ro-RO',{maximumFractionDigits:1})}h`;
const hubDate=(ms)=>new Date(ms).toLocaleString('ro-RO',{dateStyle:'medium',timeStyle:'short'});
const hubFetch=async(path)=>{const r=await api(path); if(!r.ok)throw Error(r.data.error||'Nu am putut încărca datele.');return r.data;};
const hubAct=async(path,body)=>{const r=await api(path,body);toast(r.data.msg||r.data.error||'Cerere nereușită.',!r.ok);if(r.ok)render();return r.ok;};
function hubLogin(){return empty('Conectează contul Discord','Ai nevoie de cont pentru a te înscrie, vota sau salva preferințele.',S.login?h('a',{class:'btn',href:'/auth/login'},'Intră cu Discord'):null);}
const hubFormField=(label,value='',type='text',required=false)=>{const el=h('input',{class:'field',type,value,required});return {el,wrap:h('label',{class:'hub-field'},h('span',{text:label}),el)};};
const hubTextarea=(label,placeholder='')=>{const el=h('textarea',{class:'field',placeholder,rows:'3',maxlength:'500'});return {el,wrap:h('label',{class:'hub-field'},h('span',{text:label}),el)};};
const hubBtn=(label,handler,cls='ghost')=>h('button',{class:`btn small ${cls}`,type:'button',onclick:handler},label);
const hubAdminBox=(title,items)=>S.admin?h('details',{class:'hub-form card sec'},h('summary',{text:`+ ${title}`}),...items):null;
function hubMembers(members){return h('div',{class:'hub-members'},(members||[]).slice(0,12).map(m=>h('span',{class:'hub-avatar',title:m.name},m.avatar?h('img',{src:m.avatar,alt:''}):m.name?.[0]||'?')));}
function hubPlayer(p,details){return h('a',{href:`#/profil?user=${p.id}`,class:'hub-player'},p.avatar?h('img',{src:p.avatar,alt:''}):h('span',{class:'hub-avatar',text:(p.name||'?').slice(0,1)}),h('span',null,h('b',{text:p.name}),details?h('small',{text:details}):null));}
const hubLink=(slug,label)=>h('a',{class:'btn small ghost',href:`#/${slug}`},label);
function hubGraph(data,valFn,labelFn){
  const max=Math.max(1,...data.map(valFn));
  return h('div',{class:'hub-bars',role:'list'},data.map(x=>h('div',{class:'hub-bar',role:'listitem',title:`${labelFn(x)} • ${hrs(valFn(x))}`},h('div',{style:{height:`${Math.max(4,valFn(x)/max*100)}%`}}),h('small',{text:labelFn(x)}))));
}
async function pageCommunity(){
  const d=await hubFetch('/api/hub/rankings?period=week');
  return [hubHead('Community Hub','Gaming, evenimente și statistici pentru comunitatea Persona Non Grata.'),
    h('div',{class:'hub-metrics sec'},
      [['Jucători în top',d.members],['Joacă acum',d.activeGames.length],['Pe server RedM',d.redmOnline],['Jocuri urmărite',d.games.length]].map(([name,value])=>h('div',{class:'hub-stat'},h('b',{text:value.toLocaleString('ro-RO')}),h('span',{text:name})))),
    h('div',{class:'hub-tiles sec'},HUB_LINKS.map(([slug,title,desc,emoji])=>h('a',{class:'hub-tile',href:`#/${slug}`},h('span',{class:'hub-emoji',text:emoji}),h('strong',{text:title}),h('span',{class:'muted',text:desc}),h('span',{class:'hub-arrow',text:'Deschide ↗'})))),
    hubSec('Playing Now','Doar membrii care au activat profilul public.',d.activeGames.length?h('div',{class:'hub-list'},d.activeGames.map(p=>h('div',{class:'hub-row'},hubPlayer(p),h('b',{text:p.game})))):empty('Încă nu apar jucători online','Tracking-ul jocurilor necesită opt-in și ENABLE_PRESENCE_TRACKING=1 pe bot.'))];
}
async function pageRankings(){
  const p=new URLSearchParams(location.hash.split('?')[1]||''),period=p.get('period')||'week',kind=p.get('kind')||'total';
  const d=await hubFetch(`/api/hub/rankings?period=${encodeURIComponent(period)}&kind=${encodeURIComponent(kind)}`);
  const chooser=(key,options)=>h('div',{class:'chips'},options.map(([v,label])=>h('a',{class:'chip',href:`#/rankings?period=${key==='period'?v:period}&kind=${key==='kind'?v:kind}`,'aria-pressed':String((key==='period'?period:kind)===v),text:label})));
  const max=d.players[0]?.ms||1;
  return [hubHead('Leaderboard','Clasamente după timpul de gaming înregistrat cu acordul membrilor.'),
    h('div',{class:'hub-controls sec'},chooser('period',[['week','7 zile'],['month','30 zile'],['all','All-time']]),chooser('kind',[['total','Gaming'],['redm','Persona Non Grata'],['game','Jocuri Discord'],['voice','Voice']])),
    h('section',{class:'sec hub-board'},d.players.length?d.players.map((u,i)=>h('div',{class:`hub-leader ${i<3?'hub-podium':''}`},h('span',{class:'hub-rank',text:`#${i+1}`}),hubPlayer(u,`${u.streak} zile streak`),h('div',{class:'hub-track'},h('i',{style:{width:`${Math.max(2,100*u.ms/max)}%`}})),h('b',{text:hrs(u.ms)}))):empty('Niciun jucător în clasament','Activează tracking-ul public din Profil și joacă pentru a acumula timp.')),
    hubSec('Most Played Games','Totalul jocurilor afișate de membrii publici.',d.games.length?h('div',{class:'hub-list'},d.games.slice(0,20).map((g,i)=>h('div',{class:'hub-row'},h('b',{text:`${i+1}. ${g.name}`}),h('span',{text:hrs(g.ms)})))):empty('Nu există date','Jocurile vor apărea după activarea Presence Tracking.'))];
}
async function pageAnalytics(){
  const d=await hubFetch('/api/hub/analytics?period=month');
  const days=Array.from({length:30},(_,i)=>{const x=new Date(Date.now()-(29-i)*86400000);return x.toISOString().slice(0,10)}).map(date=>d.daily.find(x=>x.date===date)||{date,ms:0});
  return [hubHead('Community Analytics','Activitate agregată a membrilor care au ales să fie vizibili în clasament.'),
    h('div',{class:'hub-metrics sec'},[['Membri participanți',d.members],['Jucători online',d.activeGames.length],['Pe Persona Non Grata',d.redmOnline],['Jocuri în top',d.games.length]].map(([name,n])=>h('div',{class:'hub-stat'},h('b',{text:n}),h('span',{text:name})))),
    hubSec('Ultimele 30 de zile','Ore de gaming înregistrate pe zi (UTC).',hubGraph(days,x=>x.ms,x=>x.date.slice(5))),
    hubSec('Jocurile comunității','Ce jocuri au acumulat cele mai multe ore.',d.games.length?h('div',{class:'hub-list'},d.games.slice(0,12).map(g=>h('div',{class:'hub-row'},h('strong',{text:g.name}),h('span',{text:hrs(g.ms)})))):empty('Încă nu există jocuri','Statistica se construiește după activarea tracking-ului.')),
    hubSec('Live Now','Activitate din Discord Presence.',d.activeGames.length?h('div',{class:'hub-list'},d.activeGames.map(p=>h('div',{class:'hub-row'},hubPlayer(p),h('span',{text:p.game})))):empty('Nimeni vizibil online','Discord Presence Intent trebuie configurat pentru statisticile jocurilor.'))];
}
async function pageProfile(){
  const query=new URLSearchParams(location.hash.split('?')[1]||''),id=query.get('user');
  if(!S.user && !id)return [hubHead('Player Profile','Profilul și setările tale de gaming.'),hubLogin()];
  const own=!id||id===S.user?.id;
  const d=await hubFetch(`/api/hub/profile?id=${encodeURIComponent(own?S.user.id:id)}`),p=d.profile;
  if(!p&&!own)return [hubHead('Profil privat','Jucătorul nu și-a activat profilul public.'),hubLink('rankings','Înapoi la clasament')];
  const top=p?.topGames||[],badgeNodes=(p?.badges||[]).map(b=>h('span',{class:'hub-badge',title:b.description},'🏅 ',b.name));
  const res=[hubHead(own?'Profilul meu':'Player Profile','Statistici, achievements și preferințe de joc.'),
    h('section',{class:'sec hub-card'},p?h('div',{class:'hub-profilehead'},p.avatar?h('img',{src:p.avatar,alt:''}):null,h('div',null,h('h2',{text:p.name}),h('p',{class:'muted',text:p.bio||'Fără descriere.'}))):h('h2',{text:S.user.name}),
    p?.tracking?h('div',{class:'hub-metrics'},[['Gaming',hrs(p.totalMs)],['Persona Non Grata',hrs(p.redmMs)],['Voice',hrs(p.voiceMs)],['Streak',`${p.streak} zile`]].map(([l,v])=>h('div',{class:'hub-stat'},h('b',{text:v}),h('span',{text:l})))):h('p',{class:'muted',text:'Tracking-ul este oprit.'}))];
  if(top.length){
    const entries=top.map(([name,ms])=>h('div',{class:'hub-row'},h('strong',{text:name}),h('span',{text:hrs(ms)})));
    res.push(hubSec('Top Games','Timpul jucat de când ai activat tracking-ul.',h('div',{class:'hub-list'},entries)));
  }
  res.push(hubSec('Achievements',`Insigne obținute: ${badgeNodes.length}`,h('div',{class:'hub-badges'},
    badgeNodes.length?badgeNodes:h('span',{class:'muted',text:'Începe să joci și să participi la evenimente pentru a debloca insigne.'}))));
  if(p?.daily?.length)res.push(hubSec('Istoricul activității','Ultimele 30 de zile înregistrate.',hubGraph(p.daily,x=>x.ms,x=>x.date.slice(5))));
  if(own){
    const desc=hubTextarea('Despre mine');desc.el.value=p?.bio||'';
    const f=hubFormField('Jocuri preferate (separate prin virgulă)',(p?.favorites||[]).join(', '));
    const tracking=h('input',{type:'checkbox',checked:!!p?.tracking}),pub=h('input',{type:'checkbox',checked:!!p?.public}),dm=h('input',{type:'checkbox',checked:!!p?.dm});
    res.push(h('section',{class:'sec hub-card'},h('h2',{text:'Privacy & Notifications'}),
      h('p',{class:'muted',text:'Datele nu sunt colectate retroactiv. Tracking-ul este voluntar. Poți opri participarea sau șterge datele oricând.'}),
      h('label',{class:'check'},tracking,'Înregistrează activitatea mea de gaming / voice / RedM'),
      h('label',{class:'check'},pub,'Afișează-mă în clasamente și în profilurile publice'),
      h('label',{class:'check'},dm,'Trimite-mi notificări private prin botul Discord'),
      desc.wrap,f.wrap,h('div',{class:'actions'},hubBtn('Salvează profilul',()=>hubAct('/api/hub/profile',{tracking:tracking.checked,public:pub.checked,dm:dm.checked,bio:desc.el.value,favorites:f.el.value.split(',').map(x=>x.trim())}),'mint'),
      hubBtn('Șterge toate datele Hub',()=>{if(confirm('Ștergi datele tale de gaming, notificările și participarea la clasamente?'))hubAct('/api/hub/erase',{});},'danger'))));
    const notices=(await hubFetch('/api/hub/me')).inbox||[];
    res.push(hubSec('Notification Inbox',`${notices.filter(x=>!x.read).length} necitite`,h('div',{class:'hub-list'},
      notices.length?notices.map(n=>h('div',{class:`hub-row ${n.read?'':'hub-unread'}`},h('div',null,h('strong',{text:n.text}),h('div',{class:'muted small',text:ago(n.at)})),n.link?h('a',{class:'btn small ghost',href:n.link.startsWith('/#/')?n.link.slice(1):n.link,target:n.link.startsWith('/')?'_self':'_blank',rel:'noopener'},'Deschide'):null)):empty('Nu ai notificări','Aici apar invitațiile LFG și reminder-ele de eveniment.'),
      notices.length?hubBtn('Marchează toate ca citite',()=>hubAct('/api/hub/read',{})):null)));
  }
  return res;
}
async function pageLfg(){
  const d=await hubFetch('/api/hub/lfg');const parts=[hubHead('Looking for Group','Găsește rapid membri cu care să joci. Grupurile expiră automat după trei zile.')];
  if(S.user){const game=hubFormField('Joc'),message=hubTextarea('Mesaj','Ex.: Căutăm doi jucători pentru seară.'),slots=hubFormField('Locuri (2–12)','4','number');
    parts.push(h('details',{class:'hub-form card sec'},h('summary',{text:'+ Caut coechipieri'}),game.wrap,message.wrap,slots.wrap,hubBtn('Publică',()=>hubAct('/api/hub/lfg/create',{game:game.el.value,message:message.el.value,slots:slots.el.value}),'mint')));
  }else parts.push(hubLogin());
  parts.push(hubSec('Grupuri active',`${d.items.length} grupuri`,d.items.length?h('div',{class:'hub-cards'},d.items.map(g=>h('article',{class:'hub-card'},
    h('span',{class:'hub-pill',text:g.game}),h('h3',{text:g.message}),h('p',{class:'muted small',text:`Creat de ${g.owner.name} • ${hubDate(g.at)}`}),
    h('div',{class:'hub-between'},hubMembers(g.members),h('b',{text:`${g.members.length}/${g.slots}`})),
    h('div',{class:'actions'},S.user?hubBtn(g.members.some(m=>m.id===S.user.id)?'Părăsește grupul':'Alătură-te',()=>hubAct('/api/hub/lfg/join',{id:g.id,join:!g.members.some(m=>m.id===S.user.id)}),'mint'):null,
      S.user&&(g.owner.id===S.user.id||S.admin)?hubBtn('Închide',()=>hubAct('/api/hub/lfg/close',{id:g.id}),'danger'):null)))):empty('Nu există grupuri active','Publică primul anunț și formează o echipă.')));
  return parts;
}
async function pageEvents(){
  const d=await hubFetch('/api/hub/events'),out=[hubHead('Gaming Events','Evenimente cu înscriere și reminder Discord înainte de start.')];
  if(S.admin){const title=hubFormField('Titlul evenimentului'),game=hubFormField('Joc'),date=hubFormField('Data și ora (fus orar local)','', 'datetime-local'),cap=hubFormField('Capacitate','32','number'),desc=hubTextarea('Detalii');
    out.push(hubAdminBox('Adaugă eveniment',[title.wrap,game.wrap,date.wrap,cap.wrap,desc.wrap,hubBtn('Publică evenimentul',()=>hubAct('/api/hub/event/create',{title:title.el.value,game:game.el.value,at:date.el.value?new Date(date.el.value).toISOString():'',capacity:cap.el.value,description:desc.el.value}),'mint')]));}
  out.push(hubSec('Upcoming Events',`${d.items.length} programate`,d.items.length?h('div',{class:'hub-cards'},d.items.map(e=>h('article',{class:'hub-card'},
    h('span',{class:'hub-pill',text:e.game}),h('h3',{text:e.title}),h('p',{class:'hub-when',text:hubDate(e.at)}),h('p',{class:'muted',text:e.description||'Evenimentul comunității.'}),
    h('div',{class:'hub-between'},hubMembers(e.going),h('b',{text:`${e.going.length}/${e.capacity} înscriși`})),
    h('div',{class:'actions'},S.user?hubBtn(e.going.some(m=>m.id===S.user.id)?'Retrage înscrierea':'Înscrie-mă',()=>hubAct('/api/hub/event/join',{id:e.id,join:!e.going.some(m=>m.id===S.user.id)}),'mint'):hubLink('profil','Login Discord'),
      S.admin?hubBtn('Șterge',()=>{if(confirm('Ștergi evenimentul?'))hubAct('/api/hub/remove',{kind:'events',id:e.id});},'danger'):null)))):empty('Niciun eveniment viitor','Administratorii pot adăuga primul eveniment.')));
  return out;
}
async function pagePolls(){
  const d=await hubFetch('/api/hub/polls'),out=[hubHead('Game of the Week','Comunitatea alege jocul următoarei săptămâni.')];
  if(S.admin){const title=hubFormField('Titlu','Game of the Week'),games=hubTextarea('Jocuri (unul pe linie)','CS2\nRed Dead Redemption 2\nValorant'),days=hubFormField('Durata votului (zile)','7','number');
    out.push(hubAdminBox('Pornește vot nou',[title.wrap,games.wrap,days.wrap,hubBtn('Creează votul',()=>hubAct('/api/hub/poll/create',{title:title.el.value,games:games.el.value.split('\n'),days:days.el.value}),'mint')]));}
  out.push(hubSec('Voting Booth','Un singur vot per membru, modificabil până la închidere.',d.items.length?h('div',{class:'hub-cards'},d.items.map(p=>{
    const total=Object.values(p.votes).reduce((a,b)=>a+b,0),closed=p.ends<Date.now();
    return h('article',{class:'hub-card'},h('h3',{text:p.title}),h('p',{class:'muted small',text:`${closed?'Închis':'Se închide'}: ${hubDate(p.ends)} • ${total} voturi`}),
      h('div',{class:'hub-list'},p.games.map(g=>h('div',{class:'hub-pollrow'},h('div',{class:'hub-between'},h('b',{text:g}),h('small',{text:`${p.votes[g]||0} (${total?Math.round((p.votes[g]||0)/total*100):0}%)`})),h('div',{class:'hub-track'},h('i',{style:{width:`${total?(p.votes[g]||0)/total*100:0}%`}})),
        S.user&&!closed?hubBtn(p.myVote===g?'Votul tău':'Votează',()=>hubAct('/api/hub/poll/vote',{id:p.id,game:g}),p.myVote===g?'mint':'ghost'):null))),S.admin?hubBtn('Șterge votul',()=>hubAct('/api/hub/remove',{kind:'polls',id:p.id}),'danger'):null);
  })):empty('Nu există voturi încă','Un admin poate propune 2–8 jocuri.')));
  return out;
}
async function pageReleases(){
  const d=await hubFetch('/api/hub/releases'),out=[hubHead('Release Calendar','Jocuri, DLC-uri și update-uri introduse de admini. Datele nu sunt sincronizate automat cu magazinele.')];
  if(S.admin){const game=hubFormField('Nume joc / DLC'),date=hubFormField('Data lansării','', 'datetime-local'),link=hubFormField('Link oficial (opțional)','','url');
    const kind=h('select',{class:'field'},['Joc','DLC','Update'].map(x=>h('option',{value:x,text:x})));
    out.push(hubAdminBox('Adaugă lansare',[game.wrap,h('label',{class:'hub-field'},'Tip',kind),date.wrap,link.wrap,hubBtn('Adaugă',()=>hubAct('/api/hub/release/create',{game:game.el.value,kind:kind.value,at:date.el.value?new Date(date.el.value).toISOString():'',link:link.el.value}),'mint')]));}
  out.push(hubSec('Coming Soon','Setează jocurile preferate în Profil pentru notificări potrivite.',d.items.length?h('div',{class:'hub-list'},d.items.map(r=>h('div',{class:'hub-row'},
    h('div',null,h('span',{class:'hub-pill',text:r.kind}),h('strong',{text:r.game}),h('p',{class:'muted small',text:hubDate(r.at)})),
    r.link?h('a',{class:'btn small ghost',href:r.link,target:'_blank',rel:'noopener'},'Website'):null,S.admin?hubBtn('Șterge',()=>hubAct('/api/hub/remove',{kind:'releases',id:r.id}),'danger'):null))):empty('Nicio lansare adăugată','Administratorii pot completa calendarul.')));
  return out;
}
async function pageTournaments(){
  const d=await hubFetch('/api/hub/tournaments'),out=[hubHead('Tournament Hub','Echipe, înscrieri, bracket automat cu bye-uri și rezultate oficiale.')];
  if(S.admin){const title=hubFormField('Nume turneu'),game=hubFormField('Joc'),cap=h('select',{class:'field'},[2,4,8,16,32].map(x=>h('option',{value:x,text:`${x} locuri`,selected:x===16})));
    out.push(hubAdminBox('Creează turneu',[title.wrap,game.wrap,h('label',{class:'hub-field'},'Capacitate',cap),hubBtn('Creează',()=>hubAct('/api/hub/tournament/create',{title:title.el.value,game:game.el.value,capacity:Number(cap.value)}),'mint')]));}
  out.push(hubSec('Turnee',`${d.items.length} create`,d.items.length?h('div',{class:'hub-cards'},d.items.map(t=>h('article',{class:'hub-card hub-tour'},
    h('span',{class:'hub-pill',text:t.game}),h('h3',{text:t.title}),h('p',{class:'muted small',text:t.started?'Bracket activ':`Înscrieri deschise • ${t.players.length}/${t.capacity} locuri`}),
    hubMembers(t.players),h('div',{class:'actions'},!t.started&&S.user?hubBtn(t.players.some(p=>p.id===S.user.id)?'Renunță':'Înscrie-mă',()=>hubAct('/api/hub/tournament/join',{id:t.id,join:!t.players.some(p=>p.id===S.user.id)}),'mint'):null,
      !t.started&&S.admin?hubBtn('Generează bracket',()=>hubAct('/api/hub/tournament/start',{id:t.id}),'mint'):null,
      S.admin?hubBtn('Șterge',()=>{if(confirm('Ștergi turneul?'))hubAct('/api/hub/remove',{kind:'tournaments',id:t.id});},'danger'):null),
    t.winner?h('div',{class:'hub-winner',text:`🏆 Câștigător: ${t.winner.name}`}):null,
    t.started?h('div',{class:'hub-bracket'},Array.from(new Set(t.bracket.map(x=>x.round))).map(round=>h('div',{class:'hub-round'},h('b',{text:`Runda ${round+1}`}),t.bracket.filter(m=>m.round===round).map(m=>h('div',{class:'hub-match'},
      h('div',{class:'hub-between'},h('span',{text:m.a?.name||'TBD'}),m.winner?.id===m.a?.id?h('span',{text:'✓'}):null),
      h('div',{class:'hub-between'},h('span',{text:m.b?.name||'BYE / TBD'}),m.winner?.id===m.b?.id?h('span',{text:'✓'}):null),
      !m.winner&&m.a&&m.b&&S.admin?h('div',{class:'actions'},hubBtn(`🏆 ${m.a.name}`,()=>hubAct('/api/hub/tournament/result',{id:t.id,match:m.id,winner:m.a.id})),hubBtn(`🏆 ${m.b.name}`,()=>hubAct('/api/hub/tournament/result',{id:t.id,match:m.id,winner:m.b.id}))):null))))):null))):empty('Niciun turneu','Administratorii pot crea primul bracket.')));
  return out;
}
async function pageRecommendations(){const d=await hubFetch('/api/hub/recommendations');
  return [hubHead('For You','Oferte selectate pe baza favoritelor tale, jocurilor populare în comunitate și recenziilor. Recomandări euristice, nu AI generativ.'),
    S.user?h('div',{class:'hub-tip sec'},'Adaugă jocuri preferate din ',hubLink('profil','Profil'),' ca să rafinezi sugestiile.'):hubLogin(),
    hubSec('Recommended Games',null,d.items?.length?h('div',{class:'grid'},d.items.map((g,i)=>h('div',{class:'hub-dealwrap'},h('div',{class:'hub-reason',text:g.reasons}),dealCard(g,i)))):empty('Nu pot încărca recomandări','Verifică sursa de oferte și reîncearcă.'))];
}
function hubPriceGraph(points) {
  const vals=points.filter(x=>Number.isFinite(x.price)).slice(-80);
  if(!vals.length)return null;
  const hi=Math.max(1,...vals.map(x=>x.price));
  return h('section',{class:'hub-pricehistory'},
    h('h3',{text:'Price History · GamePortal'}),
    h('p',{class:'muted small',text:'Prețul minim observat între magazine, la vizitele în GamePortal. Nu reprezintă istoricul complet dinaintea colectării.'}),
    h('div',{class:'hub-bars hub-pricebars'},vals.map(p=>h('div',{class:'hub-bar',title:`${hubDate(p.at)}: ${money(p.price)}`},h('div',{style:{height:`${Math.max(4,100*p.price/hi)}%`}})))),
    h('p',{class:'muted small',text:`${hubDate(vals[0].at)} – ${hubDate(vals[vals.length-1].at)} • ${vals.length} observații`})
  );
}
const hubPages={comunitate:pageCommunity,rankings:pageRankings,analytics:pageAnalytics,lfg:pageLfg,evenimente:pageEvents,turnee:pageTournaments,voturi:pagePolls,lansari:pageReleases,recomandari:pageRecommendations,profil:pageProfile};
