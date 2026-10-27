// Animated welcome banner (GIF): western sunset, rising embers, glowing
// avatar ring and a gold shimmer on the title. Every animation is a function
// of t in [0,1), so the loop is seamless.
const path = require('path');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const { GIFEncoder, quantize, applyPalette } = require('gifenc');

const FONTS = path.join(__dirname, '..', '..', 'assets', 'fonts');
GlobalFonts.registerFromPath(path.join(FONTS, 'Rye-Regular.ttf'), 'Rye');
GlobalFonts.registerFromPath(path.join(FONTS, 'DejaVuSans-Bold.ttf'), 'DejaVu');

const W = 720, H = 270, FRAMES = 30, DELAY = 70;
const TAU = Math.PI * 2;

function rng(seed) { // deterministic, so every banner has the same particles
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = rng(1899);
const EMBERS = Array.from({ length: 46 }, () => ({
  x: rand() * W, y: rand() * H, speed: 1 + Math.floor(rand() * 2), size: 1 + rand() * 2.2,
  sway: 6 + rand() * 14, phase: rand(), hue: rand() < 0.5 ? '255,190,90' : '255,120,50',
}));

function fitText(ctx, text, font, maxWidth, startSize, minSize = 20) {
  let size = startSize;
  do { ctx.font = `${size}px ${font}`; size -= 2; } while (ctx.measureText(text).width > maxWidth && size > minSize);
  return ctx.font;
}

function drawBackground(ctx, t) {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#0e0a2a');
  sky.addColorStop(0.45, '#4a1747');
  sky.addColorStop(0.8, '#c8402e');
  sky.addColorStop(1, '#ff8a2b');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

  // pulsing sun
  const pulse = 1 + 0.06 * Math.sin(t * TAU);
  const sun = ctx.createRadialGradient(560, 232, 4, 560, 232, 150 * pulse);
  sun.addColorStop(0, 'rgba(255,236,170,0.95)');
  sun.addColorStop(0.25, 'rgba(255,170,70,0.55)');
  sun.addColorStop(1, 'rgba(255,100,40,0)');
  ctx.fillStyle = sun; ctx.fillRect(0, 0, W, H);

  // slow drifting haze
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) {
    const a = t * TAU + i * 2.1;
    const cx = W * (0.25 + 0.25 * i) + Math.cos(a) * 40, cy = 90 + Math.sin(a) * 25;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 120);
    g.addColorStop(0, ['rgba(255,60,140,0.16)', 'rgba(60,200,255,0.12)', 'rgba(255,140,40,0.14)'][i]);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  ctx.globalCompositeOperation = 'source-over';

  // mountains + cacti silhouettes
  ctx.fillStyle = '#1a0d22';
  ctx.beginPath(); ctx.moveTo(0, H);
  [[0, 205], [70, 175], [130, 200], [210, 160], [290, 205], [360, 185], [430, 215], [520, 190], [610, 212], [680, 180], [720, 200]]
    .forEach(([x, y]) => ctx.lineTo(x, y));
  ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#0d0615';
  ctx.beginPath(); ctx.moveTo(0, H);
  [[0, 240], [90, 228], [200, 244], [330, 232], [460, 246], [600, 230], [720, 242]].forEach(([x, y]) => ctx.lineTo(x, y));
  ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  for (const [x, h] of [[640, 46], [676, 32]]) { // cacti
    ctx.fillRect(x, 238 - h, 6, h);
    ctx.fillRect(x - 9, 238 - h * 0.65, 6, 4); ctx.fillRect(x - 9, 238 - h * 0.65 - 12, 4, 14);
    ctx.fillRect(x + 9, 238 - h * 0.5, 6, 4); ctx.fillRect(x + 11, 238 - h * 0.5 - 14, 4, 16);
  }
}

function drawEmbers(ctx, t) {
  for (const e of EMBERS) {
    const y = (((e.y - t * e.speed * H) % H) + H) % H;
    const x = e.x + Math.sin((t + e.phase) * TAU * e.speed) * e.sway;
    const twinkle = 0.45 + 0.55 * Math.abs(Math.sin((t * e.speed + e.phase) * TAU));
    const g = ctx.createRadialGradient(x, y, 0, x, y, e.size * 4);
    g.addColorStop(0, `rgba(${e.hue},${0.9 * twinkle})`);
    g.addColorStop(1, `rgba(${e.hue},0)`);
    ctx.fillStyle = g; ctx.fillRect(x - e.size * 4, y - e.size * 4, e.size * 8, e.size * 8);
  }
}

function drawAvatar(ctx, t, avatar, name) {
  const cx = 118, cy = H / 2, r = 70;
  const glow = 0.55 + 0.45 * Math.sin(t * TAU);

  ctx.save();
  ctx.shadowColor = `rgba(255,190,80,${0.5 + 0.4 * glow})`; ctx.shadowBlur = 26 + 12 * glow;
  ctx.beginPath(); ctx.arc(cx, cy, r + 5, 0, TAU); ctx.fillStyle = '#2a1230'; ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip();
  if (avatar) ctx.drawImage(avatar, cx - r, cy - r, r * 2, r * 2);
  else {
    ctx.fillStyle = '#6b2a5a'; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = '#ffe2a8'; ctx.font = `64px DejaVu`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText((name[0] || '?').toUpperCase(), cx, cy + 3);
  }
  ctx.restore();

  // rotating gold ring (dashes of different brightness)
  ctx.lineWidth = 4; ctx.lineCap = 'round';
  for (let i = 0; i < 12; i++) {
    const a0 = t * TAU + (i / 12) * TAU;
    const bright = 0.35 + 0.65 * ((Math.sin(a0 * 1) + 1) / 2);
    ctx.strokeStyle = `rgba(255,${190 + 40 * bright | 0},${90 + 90 * bright | 0},${0.35 + 0.65 * bright})`;
    ctx.beginPath(); ctx.arc(cx, cy, r + 10, a0, a0 + TAU / 12 - 0.18); ctx.stroke();
  }
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,215,140,0.9)';
  ctx.beginPath(); ctx.arc(cx, cy, r + 2, 0, TAU); ctx.stroke();
}

function drawText(ctx, t, { username, memberNumber, serverName }) {
  const x = 218, maxW = W - x - 36;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';

  // title with a gold shimmer sweeping across
  const title = 'BINE AI VENIT';
  ctx.font = '40px Rye';
  const tw = ctx.measureText(title).width;
  const pos = -0.25 + 1.5 * t; // band position (0..1 = across the text)
  const grad = ctx.createLinearGradient(x, 0, x + tw, 0);
  const stop = (p) => Math.max(0, Math.min(1, p));
  grad.addColorStop(0, '#f2b33d');
  grad.addColorStop(stop(pos - 0.12), '#f2b33d');
  grad.addColorStop(stop(pos), '#fffbe6');
  grad.addColorStop(stop(pos + 0.12), '#f2b33d');
  grad.addColorStop(1, '#f2b33d');
  ctx.save();
  ctx.shadowColor = 'rgba(255,150,40,0.85)'; ctx.shadowBlur = 14;
  ctx.fillStyle = grad; ctx.fillText(title, x, 96);
  ctx.restore();

  // decorative line
  const lg = ctx.createLinearGradient(x, 0, x + maxW, 0);
  lg.addColorStop(0, 'rgba(255,215,140,0.95)'); lg.addColorStop(1, 'rgba(255,215,140,0)');
  ctx.fillStyle = lg; ctx.fillRect(x, 108, maxW, 2);

  // username
  ctx.font = fitText(ctx, username, 'DejaVu', maxW, 44, 22);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
  ctx.fillStyle = '#ffffff'; ctx.fillText(username, x, 158);
  ctx.restore();

  // subtitle
  ctx.font = fitText(ctx, `Membrul #${memberNumber}  ·  ${serverName}`, 'DejaVu', maxW, 20, 13);
  ctx.fillStyle = 'rgba(255,236,200,0.92)';
  ctx.fillText(`Membrul #${memberNumber}  ·  ${serverName}`, x, 196);
}

function drawFrame(ctx, t, ctxData, avatar) {
  drawBackground(ctx, t);
  drawEmbers(ctx, t);
  drawAvatar(ctx, t, avatar, ctxData.username);
  drawText(ctx, t, ctxData);

  // pulsing frame
  const a = 0.55 + 0.35 * Math.sin(t * TAU);
  ctx.lineWidth = 3; ctx.strokeStyle = `rgba(255,205,110,${a})`;
  ctx.strokeRect(6, 6, W - 12, H - 12);
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,205,110,0.35)';
  ctx.strokeRect(12, 12, W - 24, H - 24);
}

// username, memberNumber, serverName, avatarBuffer (Buffer | null) -> GIF Buffer
async function renderWelcomeGif({ username, memberNumber, serverName, avatarBuffer }) {
  const avatar = avatarBuffer ? await loadImage(avatarBuffer).catch(() => null) : null;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const gif = GIFEncoder();
  const data = { username: username.slice(0, 40), memberNumber, serverName: serverName.slice(0, 40) };

  for (let i = 0; i < FRAMES; i++) {
    drawFrame(ctx, i / FRAMES, data, avatar);
    const { data: rgba } = ctx.getImageData(0, 0, W, H);
    const palette = quantize(rgba, 128, { format: 'rgb444' });
    const index = applyPalette(rgba, palette, 'rgb444');
    gif.writeFrame(index, W, H, { palette, delay: DELAY, repeat: i === 0 ? 0 : undefined });
    if (i % 5 === 4) await new Promise((r) => setImmediate(r)); // don't block the bot for the whole render
  }
  gif.finish();
  return Buffer.from(gif.bytes());
}

module.exports = { renderWelcomeGif, drawFrame, W, H, FRAMES };
