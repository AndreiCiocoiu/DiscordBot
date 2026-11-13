'use strict';
// Owner-only interface. Backend is the authority; hiding controls is never the permission check.
const ACCESS_MODS = ['war','contracts','dossiers','treasury','orders','events','polls','feed','notices'];
const canSee = (key) => !!S.state?.me?.permissions?.[key];
const canSeeHub = (key) => canSee(`hub.${key}.view`);
const isVisibleTab = (key) => {
  if (key === 'clasament') return canSee('board.view');
  if (key === 'banda') return canSee('roster.view');
  if (key === 'crafting') return canSee('craft.use');
  if (key === 'cartier') return ACCESS_MODS.some(canSeeHub);
  if (key === 'lideri') return ['points.manage','members.manage','idcard.manage','announcements.manage','config.manage'].some(canSee);
  if (key === 'security') return !!S.state?.me?.owner;
  return false;
};
async function loadSecurity(force = false) {
  if (S.securityLoading || (S.security && !force)) return;
  S.securityLoading = true;
  try {
    const r = await api('/api/access');
    if (!r.ok) throw Error(r.data.error || 'Nu am putut încărca cererile.');
    S.security = r.data; S.securityError = '';
  } catch (e) { S.securityError = e.message || 'Eroare de conexiune.'; }
  finally { S.securityLoading = false; if (route() === 'security') render(); }
}
async function saveAccess(id, status, permissions) {
  const r = await api('/api/access', { userId: id, status, permissions });
  if (!r.ok) return toast(r.data.error || 'Nu am putut salva.', true);
  S.security = null;
  toast('Accesul și permisiunile au fost actualizate.');
  loadSecurity(true);
}
function pageSecurity() {
  if (!S.state?.me?.owner) return sheet(title('shield', 'Acces restricționat', 'Doar proprietarul poate administra accesul.'));
  if (!S.security && !S.securityLoading) loadSecurity();
  const header = h('div', { class:'access-heading' },
    h('div', null, h('span', { class:'access-kicker', text:'SAHARA / CONTROLUL ACCESULUI' }),
      h('h2', { text:'Porțile familiei' }),
      h('p', { text:'Tu hotărăști cine intră și ce poate face. Fiecare schimbare se aplică imediat.' })),
    h('button', { type:'button', class:'btn alt small', onclick:()=>loadSecurity(true) }, '↻ Actualizează'));
  if (!S.security) return h('section', { class:'access-page' }, header,
    h('p', { class:'access-wait', text:S.securityError || 'Se încarcă cererile de acces…' }));
  const data = S.security, users = data.users || [];
  if (!S.securitySelected || !users.some(u=>u.id===S.securitySelected)) S.securitySelected = users[0]?.id || null;
  const selected = users.find(u=>u.id===S.securitySelected);
  const sections = [['pending','De aprobat'],['approved','Aprobați'],['denied','Blocați'],['owner','Proprietar']];
  const menu = h('div', { class:'access-users' }, sections.map(([status,title]) => {
    const people = users.filter(u=>u.status===status);
    if (!people.length) return null;
    return h('div', { class:'access-group' }, h('h3', { text:`${title} (${people.length})` }),
      people.map(u=>h('button', { type:'button', class:`access-user ${u.id===S.securitySelected?'chosen':''}`, onclick:()=>{S.securitySelected=u.id;render();} },
        u.avatar ? h('img', {src:u.avatar,alt:'',loading:'lazy'}) : h('span',{class:'access-avatar',text:(u.name||'?')[0].toUpperCase()}),
        h('span', { class:'access-user-copy' },h('strong',{text:u.name}),h('small',{text:u.inFamily?'Membru Sahara · '+u.id:'Nu este încă în bandă · '+u.id})),
        h('span',{class:'access-user-status',text:u.status==='pending'?'●':'›'}))));
  }));
  const editor = !selected ? h('div',{class:'access-empty',text:'Nu există cereri încă. Membrii trebuie să se autentifice cu Discord pentru a apărea aici.'}) :
    selected.status==='owner' ? h('section',{class:'access-editor'},h('h3',{text:selected.name}),h('p',{text:'Proprietarul are acces complet și nu poate fi blocat din acest panou.'})) : (() => {
      const switches = {};
      const sections = data.groups.map(([group,items]) => h('fieldset',{class:'access-fieldset'},
        h('legend',{text:group}),h('div',{class:'access-checks'},items.map(([key,label])=>{
          const box = h('input',{type:'checkbox',checked:selected.permissions[key]===true});
          switches[key] = box;
          return h('label',{class:'access-check'},box,h('span',{text:label}));
        }))));
      const current = () => Object.fromEntries(Object.entries(switches).map(([key,input])=>[key,input.checked]));
      const status = h('select',{'aria-label':'Stare acces'},
        [['pending','În așteptare'],['approved','Aprobat'],['denied','Blocat']].map(([value,label])=>h('option',{value,selected:selected.status===value,text:label})));
      const doSave = (target) => {
        if (target==='denied'&&!confirm(`Blochezi accesul lui ${selected.name}?`)) return;
        saveAccess(selected.id,target,current());
      };
      return h('section',{class:'access-editor'},
        h('span',{class:'access-kicker',text:'PERMISIUNI INDIVIDUALE'}),
        h('h3',{text:selected.name}),
        h('p',{text:'Schimbările sunt verificate pe server la fiecare cerere. Un utilizator aprobat trebuie să fie și membru înregistrat al familiei.'}),
        h('div',{class:'access-status-row'},h('label',{text:'Starea accesului'}),status),
        ...sections,
        h('div',{class:'access-controls'},
          h('button',{type:'button',class:'btn big',onclick:()=>doSave(status.value)},'Salvează permisiunile'),
          h('button',{type:'button',class:'btn alt',onclick:()=>doSave('approved')},'✓ Aprobă'),
          h('button',{type:'button',class:'btn alt',onclick:()=>doSave('denied')},'× Blochează')));
    })();
  const audit = h('details',{class:'access-audit'},h('summary',{text:'Jurnalul modificărilor de acces'}),
    ...(data.audit||[]).slice(0,40).map(x=>h('div',{class:'access-audit-row'},
      h('time',{text:new Date(x.at).toLocaleString('ro-RO')}),h('span',{text:x.action}),h('small',{text:x.target}))));
  return h('section',{class:'access-page'}, header,
    h('div',{class:'access-warning'},'Acces permis doar persoanelor aprobate și prezente în evidența familiei. Nu distribui tokenuri sau parole.',' '),
    h('div',{class:'access-layout'},menu,editor),audit);
}
async function toggleDirectMessages() {
  const prev = !!S.state?.me?.dm;
  const r = await api('/api/access/dm',{enabled:!prev});
  if (!r.ok) return toast(r.data.error || 'Nu am putut actualiza preferința.',true);
  S.state.me.dm = r.data.dm;
  toast(r.data.dm ? 'Notificări Discord DM activate.' : 'Notificări Discord DM dezactivate.');
  render();
}
