'use strict';
// Run: node tests/smoke.js (does not require Discord token or online APIs)
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
process.env.DATA_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'gameportal-smoke-'));
process.env.PORT='30991';
const hub=require('../discord-bot/src/hub');
const {start,sign}=require('../discord-bot/src/web');
const site=start();
site.setBot({isAdmin:async()=>true,channels:()=>[],client:{application:{id:'123'}}});
const base='http://localhost:30991';
const ids=Array.from({length:5},(_,i)=>String(123456789012345670n+BigInt(i)));
async function req(route,obj,id=ids[0]){
  const opts={headers:{cookie:`sc=${sign({id,name:`Tester ${id.slice(-1)}`,exp:Date.now()+200000})}`}};
  if(obj!==undefined){opts.method='POST';opts.headers['Content-Type']='application/json';opts.body=JSON.stringify(obj);}
  const res=await fetch(base+route,opts),data=await res.json();return {status:res.status,...data};
}
async function test(){
  for(const id of ids)assert.equal((await req('/api/hub/profile',{tracking:true,public:true,dm:true,favorites:['Red Dead Redemption 2']},id)).ok,true);
  hub.addTime(ids[0],'game','Red Dead Redemption 2',7200000);
  assert.equal((await req('/api/hub/rankings?period=week')).players[0].ms,7200000);
  assert.equal((await req('/api/hub/profile')).profile.totalMs,7200000);
  const l=await req('/api/hub/lfg/create',{game:'Red Dead Redemption 2',message:'Gaming tonight',slots:5});assert.equal(l.ok,true);
  assert.equal((await req('/api/hub/lfg/join',{id:l.item.id,join:true},ids[1])).ok,true);
  assert.equal((await req('/api/hub/lfg')).items[0].members.length,2);
  const e=await req('/api/hub/event/create',{title:'Weekend showdown',game:'Red Dead Redemption 2',at:new Date(Date.now()+86400000).toISOString()});assert.equal(e.ok,true);
  assert.equal((await req('/api/hub/event/join',{id:e.item.id})).ok,true);
  const poll=await req('/api/hub/poll/create',{games:['CS2','Valorant'],days:7});assert.equal(poll.ok,true);
  assert.equal((await req('/api/hub/poll/vote',{id:poll.item.id,game:'CS2'})).ok,true);
  assert.equal((await req('/api/hub/polls')).items[0].votes.CS2,1);
  const release=await req('/api/hub/release/create',{game:'Example DLC',at:new Date(Date.now()+86400000).toISOString()});assert.equal(release.ok,true);
  assert.equal((await req('/api/hub/releases')).items.length,1);
  const tour=await req('/api/hub/tournament/create',{title:'Tournament',game:'CS2',capacity:8});assert.equal(tour.ok,true);
  for(const id of ids)assert.equal((await req('/api/hub/tournament/join',{id:tour.item.id},id)).ok,true);
  const started=await req('/api/hub/tournament/start',{id:tour.item.id});assert.equal(started.ok,true);
  assert.equal(started.item.bracket.length,7);
  let t=started.item;
  let safety=0;
  while(!t.winner&&safety++<12){
    const m=t.bracket.find(x=>x.a&&x.b&&!x.winner);assert(m,'expected playable match');
    const result=await req('/api/hub/tournament/result',{id:t.id,match:m.id,winner:m.a});assert.equal(result.ok,true);t=result.item;
  }
  assert(t.winner,'champion must be determined');
  const leaderboard=await req('/api/hub/rankings?kind=game');assert(leaderboard.games.length>0);
  const disabled=await req('/api/hub/profile',{tracking:false,public:true});assert.equal(disabled.profile.public,false);
  const erased=await req('/api/hub/erase',{});assert.equal(erased.ok,true);
  console.log('PASS: 26+ API and bracket assertions; privacy & Railway web boot OK');
}
test().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>site.server.close());
