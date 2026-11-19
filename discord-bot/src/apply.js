// Recruitment: people apply on the site (logged in with Discord), staff accept or reject.
const crypto = require('crypto');
const { db, save, cfg } = require('./store');
const clean = (s, n) => String(s ?? '').replace(/\r/g, '').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim().slice(0, n);

function steamOf(v) {
  const s = String(v || '').trim();
  const m = s.match(/(?:profiles\/)?(7656119\d{10})/);
  return m ? m[1] : null;
}
const mine = (uid) => db.applications.filter((a) => a.discord === uid).sort((a, b) => b.at - a.at)[0] || null;

function submit(user, b) {
  if (!cfg().recruitOpen) return { ok: false, msg: 'Recrutările sunt închise acum.' };
  const prev = mine(user.id);
  if (prev && prev.status === 'pending') return { ok: false, msg: 'Ai deja o aplicare în așteptare. Primești răspuns pe Discord.' };
  if (prev && prev.status === 'rejected' && Date.now() - prev.decided < 7 * 86400_000) return { ok: false, msg: 'Poți aplica din nou la o săptămână după ultimul răspuns.' };
  const steam = steamOf(b.steam), age = Math.round(Number(b.age));
  if (!steam) return { ok: false, msg: 'Pune linkul profilului de Steam sau SteamID64 (începe cu 7656119).' };
  if (!(age >= 13 && age <= 99)) return { ok: false, msg: 'Scrie vârsta ta.' };
  const why = clean(b.why, 1200);
  if (why.length < 30) return { ok: false, msg: 'Spune-ne câteva cuvinte despre tine (minimum 30 de caractere).' };
  const a = { id: crypto.randomBytes(5).toString('hex'), discord: user.id, name: user.name, avatar: user.avatar || null, steam, tmp: clean(b.tmp, 80), age,
    games: ['ETS2', 'ATS'].filter((g) => (b.games || []).includes(g)), hours: clean(b.hours, 40), why, from: clean(b.from, 80), status: 'pending', at: Date.now() };
  if (!a.games.length) return { ok: false, msg: 'Alege ce joci: ETS2, ATS sau amândouă.' };
  if (!b.rules) return { ok: false, msg: 'Trebuie să fii de acord cu regulile VTC-ului.' };
  db.applications.push(a); save();
  return { ok: true, msg: 'Aplicarea a fost trimisă. Staff-ul îți răspunde pe Discord.', item: a };
}
function decide(id, staff, accept, note) {
  const a = db.applications.find((x) => x.id === String(id));
  if (!a) return { ok: false, msg: 'Aplicarea nu mai există.' };
  if (a.status !== 'pending') return { ok: false, msg: 'Aplicarea a primit deja răspuns.' };
  Object.assign(a, { status: accept ? 'accepted' : 'rejected', decided: Date.now(), by: staff.name, note: clean(note, 500) });
  save();
  return { ok: true, msg: accept ? `${a.name} a fost acceptat.` : `${a.name} a fost respins.`, item: a };
}
module.exports = { submit, decide, mine, steamOf };
