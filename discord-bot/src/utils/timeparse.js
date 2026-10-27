// Parses Romanian-style "when" text into a timestamp, in a given time zone.
//   "azi 21:00", "maine 20:30", "sambata 22:00", "28.10 21:00", "28.10.2026 21", "21:30"
const WEEKDAYS = { duminica: 0, luni: 1, marti: 2, miercuri: 3, joi: 4, vineri: 5, sambata: 6 };
const MAX_DAYS_AHEAD = 90;

function partsIn(ts, tz) {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p = Object.fromEntries(f.formatToParts(new Date(ts)).map((x) => [x.type, Number(x.value)]));
  return { y: p.year, m: p.month, d: p.day, h: p.hour, min: p.minute, s: p.second };
}

function offsetMs(ts, tz) {
  const p = partsIn(ts, tz);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - Math.floor(ts / 1000) * 1000;
}

// wall-clock time in tz -> UTC ms
function zonedToUtc(y, m, d, h, min, tz) {
  const guess = Date.UTC(y, m - 1, d, h, min);
  const first = guess - offsetMs(guess, tz);
  return guess - offsetMs(first, tz);
}

const validTz = (tz) => { try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch { return false; } };

function parseWhen(input, { tz = 'Europe/London', now = Date.now() } = {}) {
  let text = String(input || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, "").replace(/\s+/g, ' ').trim();
  if (!text) return { ok: false, reason: 'empty' };

  // time at the end: 21:00 / 21h30 / 21h / 21
  let hour, minute = 0;
  let m = text.match(/(\d{1,2})\s*[:h]\s*(\d{2})?\s*$/);
  if (m) { hour = Number(m[1]); minute = m[2] ? Number(m[2]) : 0; text = text.slice(0, m.index).trim(); }
  else if ((m = text.match(/(?:^|\s)(\d{1,2})\s*$/)) && text !== m[1]) { hour = Number(m[1]); text = text.slice(0, m.index).trim(); }
  else if ((m = text.match(/^(\d{1,2})$/))) { hour = Number(m[1]); text = ''; }
  if (hour === undefined) return { ok: false, reason: 'no-time' };
  if (hour > 23 || minute > 59) return { ok: false, reason: 'bad-time' };

  const today = partsIn(now, tz);
  const base = Date.UTC(today.y, today.m - 1, today.d);
  const addDays = (n) => { const dt = new Date(base + n * 86400000); return [dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()]; };
  let ymd;

  if (text === '' ) {
    ymd = addDays(0);
    if (zonedToUtc(...ymd, hour, minute, tz) <= now) ymd = addDays(1); // next time that hour happens
  } else if (text === 'azi' || text === 'astazi') ymd = addDays(0);
  else if (text === 'maine') ymd = addDays(1);
  else if (text === 'poimaine') ymd = addDays(2);
  else if (text in WEEKDAYS) {
    const todayDow = new Date(base).getUTCDay();
    let diff = (WEEKDAYS[text] - todayDow + 7) % 7;
    if (diff === 0 && zonedToUtc(...addDays(0), hour, minute, tz) <= now) diff = 7;
    ymd = addDays(diff);
  } else if ((m = text.match(/^(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?$/))) {
    const d = Number(m[1]), mo = Number(m[2]);
    let y = m[3] ? Number(m[3]) : today.y;
    if (y < 100) y += 2000;
    const check = new Date(Date.UTC(y, mo - 1, d));
    if (mo < 1 || mo > 12 || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return { ok: false, reason: 'bad-date' };
    if (!m[3] && zonedToUtc(y, mo, d, hour, minute, tz) <= now) y += 1; // date already passed this year
    ymd = [y, mo, d];
  } else return { ok: false, reason: 'bad-day' };

  const ts = zonedToUtc(...ymd, hour, minute, tz);
  if (ts <= now) return { ok: false, reason: 'past' };
  if (ts > now + MAX_DAYS_AHEAD * 86400000) return { ok: false, reason: 'too-far' };
  return { ok: true, ts };
}

const REASONS = {
  empty: 'Scrie când.',
  'no-time': 'Lipsește ora.',
  'bad-time': 'Ora nu e validă.',
  'bad-day': 'Nu înțeleg ziua.',
  'bad-date': 'Data nu e validă.',
  past: 'Momentul ăsta a trecut deja.',
  'too-far': `E prea departe (maxim ${MAX_DAYS_AHEAD} de zile).`,
};

module.exports = { parseWhen, validTz, zonedToUtc, REASONS };
