'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const id='123456789012345670',me={id,name:'Tester',avatar:null},t=Date.now();
const samplePlayer={...me,ms:3600000,streak:3};
const sampleBoard={members:1,activeGames:[{...me,game:'RDR2'}],redmOnline:1,games:[{name:'RDR2',ms:3600000}],players:[samplePlayer],daily:[{date:new Date().toISOString().slice(0,10),ms:3600000}]};
const sampleProfile={...me,tracking:true,public:true,dm:true,bio:'Hello',favorites:['RDR2'],totalMs:3600000,voiceMs:50000,redmMs:0,gameMs:3600000,topGames:[['RDR2',3600000]],streak:3,badges:[{name:'First Hour',description:'1h'}],daily:sampleBoard.daily};
const hubData={
  rankings:sampleBoard, analytics:sampleBoard, profile:{profile:sampleProfile}, me:{inbox:[{text:'Test notification',at:t,read:false,link:'/#/evenimente'}]},
  events:{items:[{id:'e',title:'Event',game:'RDR2',at:t+3600000,description:'desc',going:[me],capacity:12}]},
  lfg:{items:[{id:'l',game:'RDR2',message:'Join now',owner:me,members:[me],slots:4,at:t}]},
  polls:{items:[{id:'p',title:'Poll',votes:{RDR2:1},games:['RDR2','CS2'],ends:t+86400000,myVote:'RDR2'}]},
  releases:{items:[{id:'r',game:'RDR2 DLC',kind:'DLC',at:t+86400000,link:'https://example.com'}]},
  tournaments:{items:[{id:'z',title:'Tournament',game:'RDR2',players:[me],capacity:4,started:true,winner:null,bracket:[{id:'0-0',round:0,a:me,b:null,winner:me},{id:'1-0',round:1,a:me,b:null,winner:null}]}]},
  recommendations:{items:[{gameId:'1',title:'RDR2',reasons:'Popular în comunitate'}]}
};
const ctx={
  S:{user:me,admin:true,login:true},location:{hash:''},Date,Math,Number,String,Object,Array,Set,URLSearchParams,
  h:(tag,attrs,...kids)=>({tag,attrs,children:kids.flat(Infinity),value:attrs?.value||'',checked:attrs?.checked||false}),
  api:async(path)=>({ok:true,data:hubData[(path.split('/')[3]||'').split('?')[0]]||{}}),
  toast:()=>{},render:()=>{},confirm:()=>true,
  sectionHead:()=>({tag:'head'}),empty:()=>({tag:'empty'}),ago:()=>'',money:(n)=>'$'+n,
  dealCard:()=>({tag:'deal'})
};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../discord-bot/web/hub.js'),'utf8'),ctx);
async function main(){
  const pages=vm.runInContext('hubPages',ctx);
  for(const [name,fn]of Object.entries(pages)){
    ctx.location.hash=`#/${name}`;
    const nodes=await fn();
    assert(Array.isArray(nodes)&&nodes.length>0,`page ${name} must render nodes`);
    console.log('PASS:',name,`(${nodes.length} sections)`);
  }
  assert.equal(typeof vm.runInContext('hubPriceGraph',ctx),'function');
}
main().catch(e=>{console.error(e);process.exit(1)});
