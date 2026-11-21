// Pictures the bot draws for Discord: the banner under each delivery and the /top podium.
// If the drawing library cannot load (very old server), everything still works without the pictures.
const path = require('path');
const ROOT = path.join(__dirname, '..');
let C = null;
try {
  C = require('@napi-rs/canvas');
  C.GlobalFonts.registerFromPath(path.join(ROOT, 'assets/fonts/card/BigShoulders-900.ttf'), 'DU Display');
  C.GlobalFonts.registerFromPath(path.join(ROOT, 'assets/fonts/card/Archivo-600.ttf'), 'DU Body');
  C.GlobalFonts.registerFromPath(path.join(ROOT, 'assets/fonts/card/Archivo-800.ttf'), 'DU Body Bold');
} catch (err) { console.warn('Pictures off (canvas not available):', err.message); C = null; }

const CREAM = '#f3e6d0', AMBER = '#d9a47c', SAND = '#c8b296', DIM = '#a5927c', DARK = '#100c09';
const cache = {};
async function img(file) { if (!cache[file]) cache[file] = await C.loadImage(path.join(ROOT, file)); return cache[file]; }
async function remote(url) {
  if (!/^https:\/\//.test(url || '')) return null;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(3000), headers: { 'User-Agent': 'DieselUnionBot' } });
    if (!r.ok) return null;
    return await C.loadImage(Buffer.from(await r.arrayBuffer()));
  } catch { return null; }
}
const n0 = (n) => Math.round(n || 0).toLocaleString('en-GB');
// biggest font size (down to min) at which the text fits in maxW
function fit(ctx, text, family, size, maxW, min = 40) {
  for (let s = size; s >= min; s -= 2) { ctx.font = `${s}px "${family}"`; if (ctx.measureText(text).width <= maxW) return s; }
  return min;
}
function ellipsis(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text; while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
  return `${t}…`;
}
function arrow(ctx, x, y, size, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y - size * 0.055, size * 0.55, size * 0.11);
  ctx.beginPath(); ctx.moveTo(x + size * 0.42, y - size * 0.26); ctx.lineTo(x + size * 0.8, y); ctx.lineTo(x + size * 0.42, y + size * 0.26); ctx.closePath(); ctx.fill();
}

// 1200 x 400: the fleet photo, DELIVERED, the route big, km, cargo, weight, driver, truck
async function delivery(j) {
  if (!C) return null;
  const W = 1200, H = 400, cv = C.createCanvas(W, H), ctx = cv.getContext('2d');
  ctx.drawImage(await img('assets/cards/delivery-bg.jpg'), 0, 0, W, H);
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, 'rgba(16,12,9,.99)'); g.addColorStop(0.3, 'rgba(16,12,9,.97)'); g.addColorStop(0.55, 'rgba(16,12,9,.72)'); g.addColorStop(0.85, 'rgba(16,12,9,.1)'); g.addColorStop(1, 'rgba(16,12,9,.05)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = AMBER; ctx.font = '22px "DU Body Bold"'; ctx.fillText('DELIVERED', 52, 66);
  const from = String(j.from || '?').toUpperCase(), to = String(j.to || '?').toUpperCase();
  const s1 = fit(ctx, from, 'DU Display', 96, 600), s2 = fit(ctx, to, 'DU Display', 96, 520);
  const size = Math.min(s1, s2);
  ctx.font = `${size}px "DU Display"`; ctx.fillStyle = CREAM; ctx.fillText(from, 50, 80 + size * 0.86);
  arrow(ctx, 52, 80 + size * 1.42, size, AMBER);
  ctx.fillStyle = AMBER; ctx.fillText(to, 52 + size * 0.86, 80 + size * 1.82);
  ctx.font = '26px "DU Body"'; ctx.fillStyle = SAND;
  ctx.fillText(ellipsis(ctx, [`${n0(j.km)} km`, j.cargo, j.mass ? `${(j.mass / 1000).toFixed(1)} t` : null].filter(Boolean).join('  ·  '), 600), 52, 322);
  ctx.font = '21px "DU Body"'; ctx.fillStyle = DIM;
  ctx.fillText(ellipsis(ctx, [j.driverName, j.truck].filter(Boolean).join('  ·  '), 600), 52, 358);
  ctx.drawImage(await img('assets/img/logo-160.webp'), W - 92, H - 92, 66, 66);
  return cv.encode('png');
}

// 1200 x 600: title, sub-title and the top three on a podium
async function podium({ title, sub, rows }) {
  if (!C) return null;
  const W = 1200, H = 600, cv = C.createCanvas(W, H), ctx = cv.getContext('2d');
  ctx.drawImage(await img('assets/cards/podium-bg.jpg'), 0, 0, W, H);
  ctx.fillStyle = CREAM; ctx.font = '62px "DU Display"'; ctx.fillText(title.toUpperCase(), 48, 92);
  ctx.fillStyle = AMBER; ctx.font = '24px "DU Body"'; ctx.fillText(sub, 50, 130);
  ctx.drawImage(await img('assets/img/logo-160.webp'), W - 108, 34, 72, 72);
  const places = [[1, 230, 250, '#c4c4cc'], [0, 600, 185, '#ecb860'], [2, 970, 290, '#be7c54']];
  const pics = await Promise.all(rows.slice(0, 3).map((r) => remote(r.avatar)));
  for (const [k, x, top, col] of places) {
    const r = rows[k]; if (!r) continue;
    ctx.fillStyle = '#221912'; ctx.fillRect(x - 155, top + 150, 310, H - top - 150);
    ctx.fillStyle = col; ctx.fillRect(x - 155, top + 150, 310, 7);
    const R = 56, cy = top + 14 + R;
    ctx.save(); ctx.beginPath(); ctx.arc(x, cy, R, 0, Math.PI * 2); ctx.closePath();
    if (pics[k]) { ctx.clip(); ctx.drawImage(pics[k], x - R, cy - R, R * 2, R * 2); }
    else { ctx.fillStyle = '#3a291c'; ctx.fill(); ctx.fillStyle = col; ctx.font = '72px "DU Display"'; ctx.textAlign = 'center'; ctx.fillText(String(r.name || '?').trim()[0]?.toUpperCase() || '?', x, cy + 26); }
    ctx.restore();
    ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(x, cy, R, 0, Math.PI * 2); ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = CREAM; ctx.font = '27px "DU Body Bold"'; ctx.fillText(ellipsis(ctx, r.name || '?', 290), x, top + 198);
    ctx.fillStyle = col; ctx.font = '46px "DU Display"'; ctx.fillText(r.label, x, top + 252);
    ctx.fillStyle = 'rgba(243,230,208,.35)'; ctx.font = '22px "DU Body Bold"'; ctx.fillText(['1ST', '2ND', '3RD'][k], x, top + 286);
    ctx.textAlign = 'left';
  }
  return cv.encode('png');
}

module.exports = { delivery, podium, available: () => !!C };
