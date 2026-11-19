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

function validate(user, b) {
  if (!cfg().recruitOpen) return { ok: false, msg: 'Recruitment is closed right now.' };
  const prev = mine(user.id);
  if (prev && prev.status === 'pending') return { ok: false, msg: 'You already have a pending application. You will get an answer on Discord.' };
  if (prev && prev.status === 'rejected' && Date.now() - prev.decided < 7 * 86400_000) return { ok: false, msg: 'You can apply again one week after the last answer.' };
  const steam = steamOf(b.steam), age = Math.round(Number(b.age));
  if (!steam) return { ok: false, msg: 'Add your Steam profile link or SteamID64 (it starts with 7656119).' };
  if (!(age >= 13 && age <= 99)) return { ok: false, msg: 'Enter your age.' };
  const why = clean(b.why, 1200);
  if (why.length < 30) return { ok: false, msg: 'Tell us a little about yourself (at least 30 characters).' };
  const a = { id: crypto.randomBytes(5).toString('hex'), discord: user.id, name: user.name, avatar: user.avatar || null, steam, tmp: clean(b.tmp, 80), age,
    games: ['ETS2', 'ATS'].filter((g) => (b.games || []).includes(g)), hours: clean(b.hours, 40), why, from: clean(b.from, 80), status: 'pending', at: Date.now() };
  if (!a.games.length) return { ok: false, msg: 'Pick what you play: ETS2, ATS or both.' };
  if (!b.rules) return { ok: false, msg: 'You need to agree to the company rules.' };
  return { ok: true, item: a };
}
function submit(user, b) {
  const r = validate(user, b); if (!r.ok) return r;
  db.applications.push(r.item); save();
  return { ok: true, msg: 'Application sent. Staff will reply on Discord.', item: r.item };
}
// before the form: can this person apply right now?
function canApply(uid) {
  if (!cfg().recruitOpen) return 'Recruitment is closed right now.';
  const prev = mine(uid);
  if (prev && prev.status === 'pending') return 'You already have a pending application. You will get an answer in your DMs.';
  if (prev && prev.status === 'rejected' && Date.now() - prev.decided < 7 * 86400_000) return `You can apply again <t:${Math.floor((prev.decided + 7 * 86400_000) / 1000)}:R>.`;
  return null;
}
function decide(id, staff, accept, note) {
  const a = db.applications.find((x) => x.id === String(id));
  if (!a) return { ok: false, msg: 'That application no longer exists.' };
  if (a.status !== 'pending') return { ok: false, msg: 'That application has already been answered.' };
  Object.assign(a, { status: accept ? 'accepted' : 'rejected', decided: Date.now(), by: staff.name, note: clean(note, 500) });
  save();
  return { ok: true, msg: accept ? `${a.name} was accepted.` : `${a.name} was declined.`, item: a };
}
module.exports = { submit, validate, canApply, decide, mine, steamOf };
