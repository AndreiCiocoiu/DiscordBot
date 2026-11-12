// Identity card (the in-game ID, as a screenshot) kept as proof for each gang member.
// Files live in <data>/ids/<guild>-<user>.<ext>; the member record keeps { ext, at, by, byName }.
// Only leaders can upload, see or delete them (website, profile drawer).
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, '..', '..', 'data');
const DIR = path.join(DATA_DIR, 'ids');
const MAX = 4 * 1024 * 1024;
const TYPES = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const safe = (s) => /^\d{5,22}$/.test(String(s));

// trust the bytes, not the header
function sniff(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length > 12 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  return null;
}
const fileOf = (guildId, uid, ext) => path.join(DIR, `${guildId}-${uid}.${ext}`);

function drop(guildId, uid) {
  if (!safe(uid)) return;
  for (const ext of Object.keys(TYPES)) { try { fs.unlinkSync(fileOf(guildId, uid, ext)); } catch { /* not there */ } }
}

function save(guildId, uid, buf) {
  if (!safe(uid)) return { ok: false, msg: 'ID invalid.' };
  if (!buf.length || buf.length > MAX) return { ok: false, msg: 'Poza e prea mare (maximum 4 MB).' };
  const ext = sniff(buf);
  if (!ext) return { ok: false, msg: 'Fișierul trebuie să fie o poză JPG, PNG sau WebP.' };
  fs.mkdirSync(DIR, { recursive: true });
  drop(guildId, uid);
  fs.writeFileSync(fileOf(guildId, uid, ext), buf);
  return { ok: true, ext };
}

function read(guildId, uid, ext) {
  if (!safe(uid) || !TYPES[ext]) return null;
  try { return { data: fs.readFileSync(fileOf(guildId, uid, ext)), type: TYPES[ext] }; } catch { return null; }
}

module.exports = { save, read, drop, MAX };
