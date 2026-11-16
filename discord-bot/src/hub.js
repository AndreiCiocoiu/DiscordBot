// GamePortal deal-first companion modules: activity rankings, events, LFG and alerts.
// Stored on the existing Railway persistent volume; no external database credential required.
const crypto = require('crypto');
const { db, save } = require('./store');
const H = db.hub ||= { users: {}, events: [], lfg: [], polls: [], releases: [], tournaments: [], inbox: {}, priceHistory: {}, bridgeLast: {}, excluded: {} };
for (const [k,v] of Object.entries({ users:{}, events:[], lfg:[], polls:[], releases:[], tournaments:[], inbox:{}, priceHistory:{}, bridgeLast:{}, excluded:{} })) H[k] ||= v;
const uid = () => crypto.randomUUID();
const now = () => Date.now();
const clean = (v,n=100) => String(v||'').trim().slice(0,n);
const day = (t=now()) => new Date(t).toISOString().slice(0,10);
const isSnowflake = (id) => /^\d{16,22}$/.test(String(id));
const active = new Map(); // transient sessions; they cannot survive deploys
const redmActive = new Set();
const MAX_PROFILE_GAMES=12;
const MAX_DAYS=180;
function fail(msg) { return { ok:false, msg }; }
function ok(msg,extra={}) { return { ok:true, msg, ...extra }; }
function user(id) { return H.users[String(id)] || null; }
// Members who appear in the configured community are counted automatically.
// An explicit opt-out is always respected, including after a delete request.
function ensure(s) {
  if (!isSnowflake(s?.id)) return null;
  const id=String(s.id), first=!H.users[id], excluded=!!H.excluded[id];
  const u = H.users[id] ||= { name:clean(s.name,40)||'Jucător Discord', avatar:s.avatar||null,
    tracking:!excluded, public:!excluded, dm:false, bio:'', favorites:[], days:{}, registered:now() };
  if(s.name)u.name=clean(s.name,40)||u.name;
  if(s.avatar)u.avatar=s.avatar;
  if(excluded){u.tracking=false;u.public=false;}
  if(first)save();
  return u;
}
function observeMember(obj) {
  if (!obj || !isSnowflake(obj.id) || obj.bot || H.excluded[String(obj.id)]) return null;
  const s={id:String(obj.id), name:obj.globalName||obj.displayName||obj.username||obj.name,
    avatar:typeof obj.displayAvatarURL==='function'?obj.displayAvatarURL({size:64}):obj.avatar||null};
  return ensure(s);
}
function updateProfile(s,p) {
  if(!isSnowflake(s?.id)) return fail('Autentifică-te cu Discord.');
  if(p.tracking===true)delete H.excluded[s.id];
  const u=ensure(s); if (!u) return fail('Autentifică-te cu Discord.');
  if ('tracking' in p) { u.tracking=p.tracking===true; if (!u.tracking) { H.excluded[s.id]=true; u.public=false; active.delete(s.id); redmActive.delete(s.id); delete H.bridgeLast[s.id]; } else {delete H.excluded[s.id];u.public=true;} }
  if ('public' in p) u.public=u.tracking && p.public===true;
  if ('dm' in p) u.dm=p.dm===true;
  if ('bio' in p) u.bio=clean(p.bio,200);
  if ('favorites' in p) {
    if (!Array.isArray(p.favorites)) return fail('Jocuri preferate invalide.');
    u.favorites=[...new Set(p.favorites.map(x=>clean(x,60)).filter(Boolean))].slice(0,MAX_PROFILE_GAMES);
  }
  save(); return ok('Profilul a fost actualizat.',{profile:profile(s.id,s.id)});
}
function erase(id) {
  if (!user(id)) return fail('Nu există date de șters.');
  delete H.users[id]; delete H.inbox[id]; delete H.bridgeLast[id]; H.excluded[id]=true; active.delete(id); redmActive.delete(id);
  for (const l of H.lfg) { l.members=l.members.filter(x=>x!==id); if(l.owner===id) l.closed=true; }
  for (const e of H.events) e.going=e.going.filter(x=>x!==id);
  for (const p of H.polls) delete p.votes[id];
  for (const t of H.tournaments) {
    if(!t.started) t.players=t.players.filter(x=>x!==id);
    else if(t.players.includes(id)) {
      // Keep historical match results without retaining the removed Discord account ID.
      const anon=`anonymous-${uid()}`;
      t.players=t.players.map(x=>x===id?anon:x);
      for(const m of t.bracket)for(const key of ['a','b','winner'])if(m[key]===id)m[key]=anon;
      if(t.winner===id)t.winner=anon;
    }
  }
  save(); return ok('Datele au fost șterse și tracking-ul a fost dezactivat pentru contul tău.');
}
function addTime(id,type,key,ms,t=now()) {
  const u=user(id); if (!u?.tracking || ms<=0) return;
  if(!u.lifetime) {const previous=totals(u);u.lifetime={games:{...previous.games},voice:previous.voice,redm:previous.redm};}
  const d=day(t); const bucket=u.days[d] ||= { games:{}, voice:0, redm:0 };
  if (type==='game') { key=clean(key,65); if (!key) return; bucket.games[key]=(bucket.games[key]||0)+ms; u.lifetime.games[key]=(u.lifetime.games[key]||0)+ms; }
  else {bucket[type]=(bucket[type]||0)+ms;u.lifetime[type]=(u.lifetime[type]||0)+ms;}
  const keys=Object.keys(u.days).sort(); for (const old of keys.slice(0,-MAX_DAYS)) delete u.days[old];
  save();
}
function flushActive() {
  const t=now();
  for (const [id,state] of active) {
    if (!user(id)?.tracking) { active.delete(id); continue; }
    const delta=Math.max(0,Math.min(90_000,t-state.at));
    if (delta>0) { if(state.game) addTime(id,'game',state.game,delta,t); if(state.voice) addTime(id,'voice','',delta,t); }
    state.at=t;
  }
  for (const [id,t0] of Object.entries(H.bridgeLast)) { if(t-t0>120_000) { delete H.bridgeLast[id]; redmActive.delete(id); } }
}
function presence(id,game) {
  if (!isSnowflake(id) || !user(id)?.tracking) return;
  flushOne(id);
  const s=active.get(id)||{at:now(),game:'',voice:false};
  s.game=clean(game,65); s.at=now();
  if(!s.game&&!s.voice) active.delete(id); else active.set(id,s);
}
function voice(id,connected) {
  if (!isSnowflake(id) || !user(id)?.tracking) return;
  flushOne(id);
  const s=active.get(id)||{at:now(),game:'',voice:false}; s.voice=!!connected; s.at=now();
  if(!s.game&&!s.voice) active.delete(id); else active.set(id,s);
}
function flushOne(id) {
  const s=active.get(id); if(!s) return;
  const t=now(), ms=Math.min(Math.max(0,t-s.at),90_000);
  if(s.game) addTime(id,'game',s.game,ms,t); if(s.voice) addTime(id,'voice','',ms,t);
  s.at=t;
}
function redmHeartbeat(ids) {
  if (!Array.isArray(ids)||ids.length>512) return fail('Lista de jucători este invalidă.');
  const t=now(), currently=new Set();
  for(const id of new Set(ids.map(String))) {
    if(!isSnowflake(id)||H.excluded[id]) continue;
    if(!user(id))ensure({id});
    if(!user(id)?.tracking)continue;
    currently.add(id); const prev=H.bridgeLast[id];
    if(prev && t>prev && t-prev<=100_000) addTime(id,'redm','',t-prev,t);
    H.bridgeLast[id]=t; redmActive.add(id);
  }
  // stops counting on absence; the first heartbeat does not backfill time
  for(const id of Object.keys(H.bridgeLast)) if(!currently.has(id)) {delete H.bridgeLast[id];redmActive.delete(id);}
  save(); return ok('Heartbeat acceptat.',{online:currently.size});
}
function totals(u,since='') {
  const totals={games:{},voice:0,redm:0,days:0,byDay:{}};
  for(const [d,b] of Object.entries(u.days||{})) {
    if(since && d<since)continue;
    const ms=Object.values(b.games||{}).reduce((n,x)=>n+x,0)+(b.voice||0)+(b.redm||0);
    totals.byDay[d]=ms; if(ms>=60_000)totals.days++;
    totals.voice+=b.voice||0;totals.redm+=b.redm||0;
    for(const [g,v] of Object.entries(b.games||{}))totals.games[g]=(totals.games[g]||0)+v;
  }
  if(!since && u.lifetime) {totals.games={...u.lifetime.games};totals.voice=u.lifetime.voice||0;totals.redm=u.lifetime.redm||0;}
  totals.game=Object.values(totals.games).reduce((a,b)=>a+b,0);
  // RedM activity usually overlaps Discord's RDR2 presence. Don't add both and inflate hours.
  totals.total=Math.max(totals.game,totals.redm);
  return totals;
}
const threshold=(period)=>period==='week'?day(now()-6*86400000):period==='month'?day(now()-29*86400000):'';
function display(id) {const u=user(id);return {id,name:u?.name||'Jucător Discord',avatar:u?.avatar||null};}
function streak(u) {
  const days=new Set(Object.entries(u.days||{}).filter(([,d])=>Object.values(d.games||{}).reduce((a,b)=>a+b,0)+(d.redm||0)>=600_000).map(([k])=>k));
  let cur=0,t=Date.parse(`${day()}T00:00:00Z`);
  if(!days.has(day(t)))t-=86400000;
  while(days.has(day(t))&&cur<MAX_DAYS){cur++;t-=86400000;}
  return cur;
}
function badges(id) {
  const u=user(id);if(!u)return [];
  const x=totals(u), hours=x.total/3600000, results=[];
  for(const [h,title] of [[1,'First Hour'],[10,'Night Owl'],[50,'Veteran'],[100,'Legend'],[500,'No-Life Elite']])if(hours>=h)results.push({id:`hours-${h}`,name:title,description:`${h}h de gaming înregistrate`});
  const s=streak(u);for(const n of [3,7,30])if(s>=n)results.push({id:`streak-${n}`,name:`${n}-Day Streak`,description:`${n} zile la rând cu minimum 10 minute`});
  const joined=H.events.filter(e=>e.going.includes(id)).length;
  for(const n of [1,5,15])if(joined>=n)results.push({id:`events-${n}`,name:`Event Hero ${n}`,description:`Înscris la ${n} evenimente`});
  return results;
}
function profile(id,viewerId) {
  const u=user(id); if(!u)return null;
  if(id!==viewerId&&(!u.public||!u.tracking))return null;
  const t=totals(u), r=Object.entries(t.games).sort((a,b)=>b[1]-a[1]).slice(0,10);
  return {...display(id),bio:u.bio,favorites:u.favorites,tracking:u.tracking,public:u.public,dm:id===viewerId?u.dm:undefined,
    totalMs:t.total,voiceMs:t.voice,redmMs:t.redm,gameMs:t.game,topGames:r,streak:streak(u),badges:badges(id),daily:Object.entries(t.byDay).sort().slice(-30).map(([date,ms])=>({date,ms}))};
}
function rankings(period='week',kind='total') {
  const since=threshold(period), rows=[];const games={};const hourly={};const daily={};let members=0;
  for(const [id,u] of Object.entries(H.users)) {
    if(!u.tracking||!u.public)continue;members++;
    const t=totals(u,since),ms=kind==='redm'?t.redm:kind==='voice'?t.voice:kind==='game'?t.game:t.total;
    if(ms>0)rows.push({...display(id),ms,redm:t.redm,voice:t.voice,game:t.game,streak:streak(u)});
    for(const [name,ms]of Object.entries(t.games))games[name]=(games[name]||0)+ms;
    for(const [d,n]of Object.entries(t.byDay))daily[d]=(daily[d]||0)+n;
  }
  rows.sort((a,b)=>b.ms-a.ms);const popular=Object.entries(games).sort((a,b)=>b[1]-a[1]).slice(0,25).map(([name,ms])=>({name,ms}));
  return {players:rows.slice(0,100),games:popular,members,activeGames:[...active.entries()].filter(([id,a])=>user(id)?.public&&!!a.game).map(([id,a])=>({...display(id),game:a.game})),redmOnline:[...redmActive].filter(id=>user(id)?.public).length,
    daily:Object.entries(daily).sort().slice(-30).map(([date,ms])=>({date,ms}))};
}
function notify(id,text,link='') {
  const u=user(id);if(!u)return;
  const arr=H.inbox[id] ||= [];
  arr.unshift({id:uid(),text:clean(text,280),link:clean(link,200),at:now(),read:false,dmSent:false});
  if(arr.length>60)arr.length=60;save();
}
function inbox(id){return (H.inbox[id]||[]).slice(0,40);}
function markRead(id){for(const n of H.inbox[id]||[])n.read=true;save();return ok('Notificările au fost marcate ca citite.');}
async function sendDms(send) {
  let count=0;
  for(const [id,notes]of Object.entries(H.inbox)) {
    if(!user(id)?.dm)continue;
    for(const n of notes.filter(x=>!x.dmSent).slice(0,5)) {
      // mark before send so failed or closed DMs won't cause repeated sends every 5 minutes
      n.dmSent=true;save();
      await send(id,n.text,n.link).catch(()=>{});
      if(++count>=30)return;
    }
  }
}
function listItems(type) {
  if(type==='lfg')return H.lfg.filter(x=>!x.closed&&x.expires>now()).sort((a,b)=>b.at-a.at).slice(0,80);
  if(type==='events')return H.events.filter(x=>x.at>now()-86400000).sort((a,b)=>a.at-b.at).slice(0,100);
  if(type==='polls')return H.polls.slice().sort((a,b)=>b.created-a.created).slice(0,20);
  if(type==='releases')return H.releases.filter(x=>x.at>now()-86400000).sort((a,b)=>a.at-b.at).slice(0,100);
  if(type==='tournaments')return H.tournaments.slice().sort((a,b)=>b.created-a.created).slice(0,50);
  return [];
}
const allowedUrl=(v)=>{try{const u=new URL(v);return ['https:','http:'].includes(u.protocol)?u.href.slice(0,240):'';}catch{return ''}};
const validDate=(n,min=now()-86400000,max=now()+366*86400000)=>Number.isFinite(n)&&n>=min&&n<=max;
function createEvent(s,p,admin){if(!admin)return fail('Doar adminii pot crea evenimente.');
  const title=clean(p.title,90),at=Date.parse(p.at),game=clean(p.game,60);
  if(title.length<3||!validDate(at)||!game)return fail('Completează titlul, jocul și o dată validă.');
  const e={id:uid(),title,game,description:clean(p.description,500),at,capacity:Math.min(256,Math.max(2,Number(p.capacity)||32)),going:[],by:display(s.id),reminded:false};
  H.events.push(e);if(H.events.length>300)H.events.splice(0,H.events.length-300);
  for(const [id,u]of Object.entries(H.users)) if(u.favorites.some(x=>x.toLowerCase()===game.toLowerCase())&&id!==s.id)notify(id,`Eveniment nou pentru ${game}: ${title}`,`/#/evenimente`);
  save();return ok('Eveniment creat.',{item:e});
}
function eventJoin(id,p){const e=H.events.find(x=>x.id===p.id);if(!e||e.at<now())return fail('Eveniment indisponibil.');
  e.going=e.going.filter(x=>x!==id);if(p.join!==false){if(e.going.length>=e.capacity)return fail('Evenimentul este plin.');e.going.push(id);}
  save();return ok(p.join===false?'Te-ai retras.':'Te-ai înscris.',{item:e});
}
function lfgCreate(s,p){const game=clean(p.game,60),message=clean(p.message,280),slots=Math.min(12,Math.max(2,Number(p.slots)||4));
  if(game.length<2||message.length<3)return fail('Introdu jocul și un mesaj.');
  if(H.lfg.filter(x=>x.owner===s.id&&!x.closed&&x.expires>now()).length>=3)return fail('Ai deja trei grupuri active.');
  const l={id:uid(),game,message,owner:s.id,members:[s.id],slots,at:now(),expires:now()+3*86400000,closed:false};H.lfg.unshift(l);H.lfg=H.lfg.slice(0,400);
  for(const [id,u]of Object.entries(H.users))if(id!==s.id&&u.favorites.some(x=>x.toLowerCase()===game.toLowerCase()))notify(id,`Cineva caută echipă pentru ${game}.`,`/#/lfg`);
  save();return ok('Grupul a fost publicat.',{item:l});
}
function lfgJoin(id,p){const l=H.lfg.find(x=>x.id===p.id);if(!l||l.closed||l.expires<=now())return fail('Grupul nu mai este activ.');
  l.members=l.members.filter(x=>x!==id);if(p.join!==false){if(l.members.length>=l.slots)return fail('Grupul este plin.');l.members.push(id);if(id!==l.owner)notify(l.owner,`${display(id).name} s-a alăturat grupului tău pentru ${l.game}.`,'/#/lfg');}
  save();return ok(p.join===false?'Ai ieșit din grup.':'Te-ai alăturat grupului.',{item:l});
}
function lfgClose(id,p,admin){const l=H.lfg.find(x=>x.id===p.id);if(!l||(!admin&&l.owner!==id))return fail('Nu ai permisiune.');l.closed=true;save();return ok('Grup închis.');}
function createPoll(p,admin){if(!admin)return fail('Doar adminii pot porni voturi.');
  if(!Array.isArray(p.games))return fail('Jocuri invalide.');
  const games=[...new Set(p.games.map(x=>clean(x,60)).filter(Boolean))].slice(0,8);
  if(games.length<2)return fail('Adaugă cel puțin două jocuri.');
  const days=Math.min(14,Math.max(1,Number(p.days)||7));const poll={id:uid(),title:clean(p.title,80)||'Game of the Week',games,votes:{},created:now(),ends:now()+days*86400000};H.polls.unshift(poll);H.polls=H.polls.slice(0,30);save();return ok('Votul a fost creat.',{item:poll});
}
function vote(id,p){const poll=H.polls.find(x=>x.id===p.id);if(!poll||poll.ends<now())return fail('Votul este închis.');
  if(!poll.games.includes(p.game))return fail('Joc invalid.');poll.votes[id]=p.game;save();return ok('Vot înregistrat.',{item:poll});}
function createRelease(p,admin){if(!admin)return fail('Doar adminii pot adăuga lansări.');
  const game=clean(p.game,90),at=Date.parse(p.at);if(game.length<2||!validDate(at))return fail('Introdu jocul și data lansării.');
  const item={id:uid(),game,at,kind:['Joc','DLC','Update'].includes(p.kind)?p.kind:'Joc',link:allowedUrl(p.link),reminded:false};
  H.releases.push(item);H.releases=H.releases.slice(-300);save();return ok('Lansare adăugată.',{item});
}
function remove(id,p,admin){if(!admin)return fail('Doar adminii pot șterge.');
  const lists={events:'events',polls:'polls',releases:'releases',tournaments:'tournaments'},k=lists[p.kind];if(!k)return fail('Tip invalid.');
  const len=H[k].length;H[k]=H[k].filter(x=>x.id!==p.id);if(H[k].length===len)return fail('Elementul nu există.');save();return ok('Eliminat.');
}
function createTournament(p,admin){if(!admin)return fail('Doar adminii pot crea turnee.');
  const title=clean(p.title,90),game=clean(p.game,60),capacity=Number(p.capacity)||16;
  if(title.length<3||game.length<2||![2,4,8,16,32].includes(capacity))return fail('Titlu, joc sau capacitate invalidă.');
  const t={id:uid(),title,game,capacity,created:now(),players:[],started:false,bracket:[],winner:null};H.tournaments.unshift(t);H.tournaments=H.tournaments.slice(0,80);save();return ok('Turneu creat.',{item:t});
}
function tournamentJoin(id,p){const t=H.tournaments.find(x=>x.id===p.id);if(!t||t.started)return fail('Înscrierile sunt închise.');
  t.players=t.players.filter(x=>x!==id);if(p.join!==false){if(t.players.length>=t.capacity)return fail('Turneul este plin.');t.players.push(id);}
  save();return ok(p.join===false?'Ai ieșit din turneu.':'Te-ai înscris.',{item:t});
}
function tournamentStart(p,admin){if(!admin)return fail('Doar adminii pot începe turnee.');
  const t=H.tournaments.find(x=>x.id===p.id);if(!t||t.started||t.players.length<2)return fail('Ai nevoie de cel puțin doi jucători și un turneu neînceput.');
  const size=2**Math.ceil(Math.log2(t.players.length)),rounds=Math.log2(size),bracket=[];
  for(let r=0;r<rounds;r++)for(let slot=0;slot<size/2**(r+1);slot++)bracket.push({id:`${r}-${slot}`,round:r,slot,a:null,b:null,winner:null});
  const first=bracket.filter(x=>x.round===0),count=first.length;
  for(let j=0;j<count;j++)first[j].a=t.players[j]||null;
  for(let j=count;j<t.players.length;j++)first[j-count].b=t.players[j];
  t.bracket=bracket;t.started=true;
  for(const m of first)if(m.a&&!m.b){m.winner=m.a;advance(t,m);}
  save();return ok('Bracket generat (bye-urile avansează automat).',{item:t});
}
function advance(t,m){const next=t.bracket.find(x=>x.round===m.round+1&&x.slot===Math.floor(m.slot/2));
  if(next){if(m.slot%2===0)next.a=m.winner;else next.b=m.winner;}
  else t.winner=m.winner;
}
function tournamentResult(p,admin){if(!admin)return fail('Doar adminii pot valida rezultate.');
  const t=H.tournaments.find(x=>x.id===p.id);const m=t?.bracket?.find(x=>x.id===p.match);if(!m||m.winner||!m.a||!m.b||![m.a,m.b].includes(p.winner))return fail('Meci invalid, deja finalizat sau fără ambii jucători.');
  m.winner=p.winner;advance(t,m);save();if(t.winner)notify(t.winner,`Ai câștigat turneul ${t.title}!`,'/#/turnee');return ok('Rezultat salvat.',{item:t});
}
function history(id){return (H.priceHistory[clean(id,60)]||[]).slice(-80);}
function sampleBest(gameId,price){
  gameId=clean(gameId,60);price=Number(price);
  if(!/^\d{1,9}$/.test(gameId)||!Number.isFinite(price)||price<0)return;
  const a=H.priceHistory[gameId] ||= [],t=now();
  if(!a.length||t-a[a.length-1].at>=6*3600000){a.push({at:t,price});if(a.length>180)a.shift();
    if(Object.keys(H.priceHistory).length>450)delete H.priceHistory[Object.keys(H.priceHistory)[0]];save();}
}
function samplePrice(gameId,g){
  if(!g?.deals?.length)return;
  const prices=g.deals.map(x=>Number(x.price)).filter(x=>Number.isFinite(x)&&x>=0);
  if(prices.length)sampleBest(gameId,Math.min(...prices));
}
function recommendations(id,dealsList){const u=user(id),prefs=(u?.favorites||[]).map(x=>x.toLowerCase()),rank=rankings('month').games;
  const popular=new Set(rank.slice(0,12).map(x=>x.name.toLowerCase()));
  const items=(dealsList||[]).filter(x=>x&&x.gameId).map(x=>{
    const title=x.title.toLowerCase(),matched=prefs.some(g=>g===title||g.length>=5&&(title.includes(g)||g.includes(title)));
    return {...x,reasons:matched?'Joc din favoritele tale':popular.has(title)?'Popular în comunitate':'Ofertă recomandată',score:(matched?100:0)+(popular.has(title)?40:0)+(x.steamPct||0)/10+(x.cut||0)/10};
  }).sort((a,b)=>b.score-a.score);
  return items.slice(0,12);
}
function reminders(){const t=now();for(const e of H.events)if(!e.reminded&&e.at>t&&e.at-t<=3600000){e.reminded=true;for(const id of e.going)notify(id,`Evenimentul „${e.title}” începe în mai puțin de o oră.`,'/#/evenimente');}
  for(const r of H.releases)if(!r.reminded&&r.at>t&&r.at-t<=86400000){r.reminded=true;for(const[id,u]of Object.entries(H.users))if(u.favorites.some(x=>r.game.toLowerCase().includes(x.toLowerCase())))notify(id,`${r.kind}: ${r.game} apare în următoarele 24 de ore.`,r.link||'/#/lansari');}save();}
function listPublicPeople(ids){return ids.map(display);}
module.exports={H,ensure,observeMember,user,updateProfile,erase,addTime,presence,voice,flushActive,redmHeartbeat,rankings,profile,totals,badges,streak,notify,inbox,markRead,sendDms,
  listItems,createEvent,eventJoin,lfgCreate,lfgJoin,lfgClose,createPoll,vote,createRelease,remove,createTournament,tournamentJoin,tournamentStart,tournamentResult,history,sampleBest,samplePrice,recommendations,reminders,listPublicPeople,display};
