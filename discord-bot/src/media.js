// Pictures uploaded from the panel (convoy banners, announcements). Kept on the volume, served at /u/<name>,
// and attached straight to the Discord message, so Discord hosts its own copy.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DATA_DIR } = require('./store');

const DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(DIR, { recursive: true });
const MAX = 6 * 1024 * 1024;
const TYPES = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };
const NAME = /^[a-f0-9]{20}\.(png|jpg|webp|gif)$/;

function sniff(b) {
  if (b.length < 12) return null;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if (b.toString('ascii', 0, 4) === 'GIF8') return 'gif';
  return null;
}
// data: URL (what the browser sends) -> stored file
function store(dataUrl) {
  const m = String(dataUrl || '').match(/^data:image\/[a-z+]+;base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return { ok: false, msg: 'That is not a picture.' };
  const buf = Buffer.from(m[1], 'base64');
  if (buf.length > MAX) return { ok: false, msg: 'The picture is too big (6 MB at most).' };
  const ext = sniff(buf); if (!ext) return { ok: false, msg: 'Use a PNG, JPG, WebP or GIF picture.' };
  const name = `${crypto.randomBytes(10).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(DIR, name), buf);
  return { ok: true, url: `/u/${name}`, msg: 'Picture uploaded.' };
}
// '/u/<name>' -> absolute path of an existing upload, or null
function file(u) {
  const name = String(u || '').replace(/^\/u\//, '');
  if (!String(u || '').startsWith('/u/') || !NAME.test(name)) return null;
  const p = path.join(DIR, name);
  return fs.existsSync(p) ? p : null;
}
const isLocal = (u) => !!file(u);
const type = (p) => TYPES[path.extname(p).slice(1)] || 'application/octet-stream';
// a picture value from a form: an upload of ours or an https link
const image = (u) => (isLocal(u) ? String(u) : /^https:\/\/[^\s"'<>]{4,400}$/.test(String(u || '').trim()) ? String(u).trim() : '');

module.exports = { store, file, isLocal, type, image, DIR };
