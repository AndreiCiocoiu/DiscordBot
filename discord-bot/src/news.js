// Announcements written by the admins on the site (and optionally mirrored to a Discord channel).
const crypto = require('crypto');
const { db, save } = require('./store');

const TAGS = { anunt: 'Anunț', update: 'Update', eveniment: 'Eveniment', giveaway: 'Giveaway', oferta: 'Ofertă' };
const clean = (s, n) => String(s ?? '').replace(/\r/g, '').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim().slice(0, n);
const okLink = (u) => { try { const x = new URL(String(u)); return x.protocol === 'https:' || x.protocol === 'http:' ? x.href.slice(0, 400) : ''; } catch { return ''; } };

const list = () => [...db.news].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.at - a.at);

function add(author, b) {
  const title = clean(b.title, 90), body = clean(b.body, 2000);
  if (title.length < 3) return { ok: false, msg: 'Scrie un titlu (minimum 3 litere).' };
  if (!body) return { ok: false, msg: 'Scrie textul anunțului.' };
  const item = { id: crypto.randomBytes(6).toString('hex'), title, body, tag: TAGS[b.tag] ? b.tag : 'anunt', link: okLink(b.link), image: okLink(b.image), pinned: !!b.pinned, at: Date.now(),
    by: { id: author.id, name: author.name, avatar: author.avatar || null } };
  db.news.unshift(item);
  if (db.news.length > 300) db.news.length = 300;
  save();
  return { ok: true, msg: 'Anunțul a fost publicat.', item };
}
function remove(id) {
  const i = db.news.findIndex((n) => n.id === String(id));
  if (i < 0) return { ok: false, msg: 'Anunțul nu mai există.' };
  db.news.splice(i, 1); save();
  return { ok: true, msg: 'Anunțul a fost șters.' };
}
function pin(id, on) {
  const n = db.news.find((x) => x.id === String(id));
  if (!n) return { ok: false, msg: 'Anunțul nu mai există.' };
  n.pinned = !!on; save();
  return { ok: true, msg: on ? 'Anunțul a fost fixat sus.' : 'Anunțul nu mai e fixat.' };
}

module.exports = { list, add, remove, pin, TAGS };
