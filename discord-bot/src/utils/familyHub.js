'use strict';
// Sahara Family Hub v7 — independent, persistent website collaboration features.
// This module deliberately does not touch the existing points, ranking, raids, or crafting logic.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIR = process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, '..', '..', 'data');
const FILE = path.join(DIR, 'family-hub.json');
fs.mkdirSync(DIR, { recursive: true });
const MAX_ITEMS = { war: 90, contracts: 120, treasury: 600, orders: 200, events: 120, polls: 100, feed: 160 };
const UNITS = ['aur', 'bani', 'fier', 'lemn', 'cupru', 'carbune', 'otel', 'alte'];
const STATUSES = { war: ['planned', 'active', 'done', 'cancelled'], orders: ['new', 'in_progress', 'ready', 'delivered', 'cancelled'] };
const NEW = () => ({ war: [], contracts: [], treasury: [], orders: [], events: [], polls: [], feed: [], notices: {}, dmQueue: [], sentDm: [] });
let db;
try { db = JSON.parse(fs.readFileSync(FILE, 'utf8')); if (!db || typeof db !== 'object' || !db.guilds || typeof db.guilds !== 'object') throw Error('invalid'); }
catch (err) {
  if (err.code !== 'ENOENT' && fs.existsSync(FILE)) { try { fs.copyFileSync(FILE, `${FILE}.corrupt-${Date.now()}.bak`); } catch {} }
  db = { version: 1, guilds: {} };
}
function dataFor(guildId) {
  const g = db.guilds[guildId] ||= NEW();
  for (const key of Object.keys(MAX_ITEMS)) if (!Array.isArray(g[key])) g[key] = [];
  if (!g.notices || typeof g.notices !== 'object') g.notices = {};
  if (!Array.isArray(g.dmQueue)) g.dmQueue = [];
  if (!Array.isArray(g.sentDm)) g.sentDm = [];
  return g;
}
function save() { const tmp = `${FILE}.${process.pid}.tmp`; fs.writeFileSync(tmp, JSON.stringify(db)); fs.renameSync(tmp, FILE); }
const text = (x, limit = 150) => String(x == null ? '' : x).trim().slice(0, limit);
const need = (x, max = 150) => { const s = text(x, max); if (s.length < 2) throw Error('Completează câmpurile obligatorii (minimum două caractere).'); return s; };
const amount = (x, max = 1000000) => { const n = Number(x); if (!Number.isSafeInteger(n) || n < 1 || n > max) throw Error('Cantitate invalidă.'); return n; };
const id = () => crypto.randomUUID();
const time = () => Date.now();
const future = (x, maxDays = 365) => { const t = Date.parse(String(x)); if (!Number.isFinite(t) || t <= time() || t > time() + maxDays * 86400000) throw Error(`Data trebuie să fie în viitor (maximum ${maxDays} zile).`); return t; };
const find = (items, key) => { const item = items.find((a) => a.id === key); if (!item) throw Error('Înregistrarea nu mai există.'); return item; };
const leaderOnly = (leader) => { if (!leader) throw Error('Această acțiune este rezervată liderilor.'); };
function append(g, key, item) { g[key].unshift(item); if (key !== 'treasury' && g[key].length > MAX_ITEMS[key]) g[key].length = MAX_ITEMS[key]; return item; }
function feed(g, s, kind, action, subject) { append(g, 'feed', { id: id(), at: time(), actor: s.id, actorName: text(s.name, 80), kind, action, subject: text(subject, 160) }); }
function notify(g, ids, label, description, target) {
  for (const uid of new Set(ids.filter(Boolean))) {
    const list = g.notices[uid] ||= [];
    const notice = { id: id(), at: time(), title: text(label, 80), text: text(description, 220), target: text(target, 60), read: false };
    list.unshift(notice);
    if (list.length > 90) list.length = 90;
    g.dmQueue ||= [];
    g.dmQueue.push({ ...notice, userId: uid, attempts: 0, nextAt: time() });
    if (g.dmQueue.length > 1500) g.dmQueue.splice(0, g.dmQueue.length - 1500);
  }
}
function notifyFamily(g, members, session, label, description, target) {
  notify(g, Object.keys(members).filter((key) => key !== session.id).slice(0, 500), label, description, target);
}
function owner(item, s, leader) { if (!leader && item.owner !== s.id) throw Error('Nu ai acces la acest element.'); }
function validId(x) { return typeof x === 'string' && /^[a-f0-9-]{36}$/.test(x); }
function hubView(g, session, permissions, members) {
  const allowed = (key) => permissions?.[`hub.${key}.view`] === true;
  const manager = (key) => permissions?.[`hub.${key}.manage`] === true;
  const polls = g.polls.map(({ ballots, ...p }) => {
    const counts = p.options.map((_, i) => Object.values(ballots || {}).filter((v) => v === i).length);
    return { ...p, counts, total: counts.reduce((a, b) => a + b, 0), myVote: Object.hasOwn(ballots || {}, session.id) ? ballots[session.id] : null };
  });
  const visibleOrders = manager('orders') ? g.orders : g.orders.filter((o) => o.owner === session.id);
  const treasury = g.treasury;
  const balances = Object.fromEntries(UNITS.map((u) => [u, treasury.filter((t) => t.unit === u).reduce((a, t) => a + t.delta, 0)]));
  const dossiers = Object.entries(members).map(([userId, m]) => ({ id: userId, name: text(m.name || userId, 80), rank: m.rank || 'angajat', since: m.since || null, rankSince: m.rankSince || null, points: m.points || 0, avatar: m.avatar || null, status: m.leaveUntil > time() ? 'concediu' : 'activ' }));
  return { war: allowed('war') ? g.war : [], contracts: allowed('contracts') ? g.contracts : [],
    treasury: allowed('treasury') ? treasury : [], balances: allowed('treasury') ? balances : {},
    orders: allowed('orders') ? visibleOrders : [], events: allowed('events') ? g.events : [],
    polls: allowed('polls') ? polls : [], feed: allowed('feed') ? g.feed : [],
    notices: allowed('notices') ? (g.notices[session.id] || []) : [], dossiers: allowed('dossiers') ? dossiers : [] };
}
const ACTION_PERMISSIONS = {
  'war.create': 'hub.war.manage', 'war.join': 'hub.war.view', 'war.status': 'hub.war.manage',
  'contract.create': 'hub.contracts.manage', 'contract.claim': 'hub.contracts.view',
  'contract.submit': 'hub.contracts.view', 'contract.review': 'hub.contracts.manage', 'contract.close': 'hub.contracts.manage',
  'treasury.add': 'hub.treasury.manage', 'order.create': 'hub.orders.view', 'order.status': 'hub.orders.view',
  'event.create': 'hub.events.manage', 'event.rsvp': 'hub.events.view', 'event.status': 'hub.events.manage',
  'poll.create': 'hub.polls.manage', 'poll.vote': 'hub.polls.view', 'poll.close': 'hub.polls.manage',
  'notice.read': 'hub.notices.view',
};
function handle({ guildId, session, permissions = {}, members, request, craftNames }) {
  const g = dataFor(guildId), s = session, b = request || {};
  // Membership and admission are checked by web.js on EVERY API request.
  const has = (key) => permissions[key] === true;
  const manage = (key) => has(`hub.${key}.manage`);
  const view = (key) => has(`hub.${key}.view`);
  if (!b.action) return { status: 200, body: hubView(g, s, permissions, members) };
  if (typeof b.action !== 'string' || !ACTION_PERMISSIONS[b.action]) return { status: 404, body: { error: 'Acțiune necunoscută.' } };
  if (!has(ACTION_PERMISSIONS[b.action])) return { status: 403, body: { error: 'Nu ai această permisiune în Cartier.' } };
  const a = b.action;
  try {
    let item;
    switch (a) {
      case 'war.create': {
        leaderOnly(manage('war'));
        const title = need(b.title, 90), at = future(b.at, 120), location = need(b.location, 100);
        item = append(g, 'war', { id: id(), title, at, location, description: text(b.description, 480), capacity: amount(b.capacity || 12, 100), state: 'planned', owner: s.id, participants: [], createdAt: time() });
        feed(g, s, 'war', 'a planificat operațiunea', item.title);
        notifyFamily(g, members, s, 'Nouă operațiune', item.title, 'war'); break;
      }
      case 'war.join': {
        item = find(g.war, b.id);
        if (!['planned', 'active'].includes(item.state)) throw Error('Operațiunea nu acceptă participanți.');
        item.participants ||= [];
        if (item.participants.includes(s.id)) item.participants = item.participants.filter((uid) => uid !== s.id);
        else { if (item.participants.length >= item.capacity) throw Error('Toate locurile sunt ocupate.'); item.participants.push(s.id); }
        feed(g, s, 'war', 'a modificat participarea la', item.title); break;
      }
      case 'war.status': {
        leaderOnly(manage('war')); item = find(g.war, b.id);
        if (!STATUSES.war.includes(b.state)) throw Error('Status invalid.');
        item.state = b.state; feed(g, s, 'war', 'a actualizat operațiunea', item.title);
        notify(g, item.participants, 'Operațiune actualizată', item.title, 'war'); break;
      }
      case 'contract.create': {
        leaderOnly(manage('contracts'));
        item = append(g, 'contracts', { id: id(), title: need(b.title, 100), description: need(b.description, 450), reward: text(b.reward, 70) || 'Recompensă stabilită de lider', capacity: amount(b.capacity || 6, 60), due: future(b.due, 120), owner: s.id, closed: false, claims: [], at: time() });
        feed(g, s, 'contract', 'a publicat contractul', item.title);
        notifyFamily(g, members, s, 'Contract nou', item.title, 'contracts'); break;
      }
      case 'contract.claim': {
        item = find(g.contracts, b.id);
        if (item.closed || time() > item.due) throw Error('Contractul este închis.');
        if (item.claims.some((x) => x.userId === s.id)) throw Error('Ai acceptat deja acest contract.');
        if (item.claims.length >= item.capacity) throw Error('Nu mai sunt locuri disponibile.');
        item.claims.push({ userId: s.id, state: 'claimed', at: time() });
        feed(g, s, 'contract', 'a acceptat contractul', item.title);
        notify(g, [item.owner], 'Contract acceptat', `${s.name}: ${item.title}`, 'contracts'); break;
      }
      case 'contract.submit': {
        item = find(g.contracts, b.id);
        const claim = item.claims.find((x) => x.userId === s.id);
        if (!claim || claim.state !== 'claimed') throw Error('Contractul nu este în lucru.');
        claim.state = 'submitted'; claim.note = text(b.note, 220); claim.submittedAt = time();
        feed(g, s, 'contract', 'a trimis spre verificare', item.title);
        notify(g, [item.owner], 'Contract de verificat', `${s.name}: ${item.title}`, 'contracts'); break;
      }
      case 'contract.review': {
        leaderOnly(manage('contracts')); item = find(g.contracts, b.id);
        const claim = item.claims.find((x) => x.userId === b.userId);
        if (!claim || claim.state !== 'submitted') throw Error('Nu există o solicitare de verificat.');
        if (!['approved', 'rejected'].includes(b.state)) throw Error('Decizie invalidă.');
        claim.state = b.state; claim.reviewedAt = time(); claim.reviewer = s.id;
        feed(g, s, 'contract', b.state === 'approved' ? 'a aprobat contractul' : 'a respins verificarea', item.title);
        notify(g, [claim.userId], b.state === 'approved' ? 'Contract aprobat' : 'Contract respins', item.title, 'contracts'); break;
      }
      case 'contract.close': {
        leaderOnly(manage('contracts')); item = find(g.contracts, b.id); item.closed = !!b.closed;
        feed(g, s, 'contract', item.closed ? 'a închis contractul' : 'a redeschis contractul', item.title); break;
      }
      case 'treasury.add': {
        leaderOnly(manage('treasury'));
        if (!UNITS.includes(b.unit)) throw Error('Tip de resursă invalid.');
        const n = amount(b.amount), delta = b.direction === 'out' ? -n : b.direction === 'in' ? n : NaN;
        if (!Number.isFinite(delta)) throw Error('Tip de tranzacție invalid.');
        const balance = g.treasury.filter((x) => x.unit === b.unit).reduce((sum, x) => sum + x.delta, 0);
        if (balance + delta < 0) throw Error('Sold insuficient pentru această retragere.');
        item = append(g, 'treasury', { id: id(), unit: b.unit, delta, note: need(b.note, 180), by: s.id, byName: text(s.name, 80), at: time() });
        feed(g, s, 'treasury', delta > 0 ? 'a depus în trezorerie' : 'a retras din trezorerie', `${n} ${b.unit}`); break;
      }
      case 'order.create': {
        const allowed = Array.isArray(craftNames) ? craftNames : [];
        const name = text(b.weapon, 160);
        if (!allowed.includes(name)) throw Error('Alege o armă existentă în catalogul de crafting.');
        item = append(g, 'orders', { id: id(), weapon: name, quantity: amount(b.quantity, 99), note: text(b.note, 240), owner: s.id, ownerName: text(s.name, 80), state: 'new', at: time(), updated: time(), by: s.id });
        feed(g, s, 'order', 'a plasat o comandă', `${item.quantity}× ${name}`);
        notify(g, Object.keys(members).filter((uid) => uid !== s.id).slice(0, 500), 'Comandă nouă în atelier', `${s.name}: ${item.quantity}× ${name}`, 'orders'); break;
      }
      case 'order.status': {
        item = find(g.orders, b.id); owner(item, s, manage('orders'));
        if (!STATUSES.orders.includes(b.state)) throw Error('Status invalid.');
        if (!manage('orders') && !(item.state === 'new' && b.state === 'cancelled')) throw Error('Doar liderii pot schimba acest status.');
        item.state = b.state; item.updated = time(); item.by = s.id;
        feed(g, s, 'order', 'a schimbat starea comenzii', `${item.weapon} · ${b.state}`);
        notify(g, [item.owner], 'Comandă actualizată', `${item.weapon}: ${b.state}`, 'orders'); break;
      }
      case 'event.create': {
        leaderOnly(manage('events'));
        item = append(g, 'events', { id: id(), title: need(b.title, 100), at: future(b.at, 120), location: text(b.location, 100) || 'Discord', description: text(b.description, 450), capacity: amount(b.capacity || 25, 200), status: 'open', owner: s.id, responses: {}, createdAt: time() });
        feed(g, s, 'event', 'a programat evenimentul', item.title);
        notifyFamily(g, members, s, 'Eveniment nou', item.title, 'events'); break;
      }
      case 'event.rsvp': {
        item = find(g.events, b.id);
        if (item.status !== 'open' || item.at < time()) throw Error('Înscrierile sunt închise.');
        if (!['going', 'maybe', 'none'].includes(b.answer)) throw Error('Răspuns invalid.');
        item.responses ||= {};
        if (b.answer === 'none') delete item.responses[s.id];
        else {
          const goingCount = Object.values(item.responses).filter((v) => v === 'going').length;
          if (b.answer === 'going' && item.responses[s.id] !== 'going' && goingCount >= item.capacity) throw Error('Nu mai sunt locuri libere.');
          item.responses[s.id] = b.answer;
        }
        feed(g, s, 'event', 'a confirmat participarea la', item.title); break;
      }
      case 'event.status': {
        leaderOnly(manage('events')); item = find(g.events, b.id);
        if (!['open', 'closed', 'cancelled'].includes(b.state)) throw Error('Status invalid.');
        item.status = b.state; feed(g, s, 'event', 'a actualizat evenimentul', item.title);
        notify(g, Object.keys(item.responses || {}), 'Eveniment actualizat', item.title, 'events'); break;
      }
      case 'poll.create': {
        leaderOnly(manage('polls'));
        const options = Array.isArray(b.options) ? b.options.map((o) => text(o, 90)).filter(Boolean) : [];
        if (options.length < 2 || options.length > 8 || new Set(options).size !== options.length) throw Error('Ai nevoie de 2–8 opțiuni diferite.');
        item = append(g, 'polls', { id: id(), title: need(b.title, 140), options, endsAt: future(b.endsAt, 45), owner: s.id, closed: false, ballots: {}, at: time() });
        feed(g, s, 'poll', 'a deschis votul', item.title);
        notifyFamily(g, members, s, 'Vot nou', item.title, 'polls'); break;
      }
      case 'poll.vote': {
        item = find(g.polls, b.id);
        if (item.closed || time() > item.endsAt) throw Error('Votul s-a încheiat.');
        const index = Number(b.option);
        if (!Number.isInteger(index) || index < 0 || index >= item.options.length) throw Error('Opțiune invalidă.');
        item.ballots ||= {};
        item.ballots[s.id] = index; feed(g, s, 'poll', 'a votat în', item.title); break;
      }
      case 'poll.close': {
        leaderOnly(manage('polls')); item = find(g.polls, b.id); item.closed = true;
        feed(g, s, 'poll', 'a închis votul', item.title); break;
      }
      case 'notice.read': {
        const notices = g.notices[s.id] || [];
        const targets = b.all ? notices : notices.filter((n) => n.id === b.id);
        for (const n of targets) n.read = true;
        break;
      }
      default: return { status: 404, body: { error: 'Acțiune necunoscută.' } };
    }
    save();
    return { status: 200, body: { ok: true, msg: 'Salvat.', hub: hubView(g, s, permissions, members) } };
  } catch (err) { return { status: 422, body: { ok: false, error: err.message || 'Date invalide.' } }; }
}

// A security decision also creates a private notification. Access refusals are sent only
// as a Discord DM (the denied member must not gain access to private site data).
function notifyAccess(guildId, userId, approved) {
  const g = dataFor(guildId);
  const uid = String(userId);
  const title = approved ? 'Acces Sahara aprobat' : 'Acces Sahara refuzat';
  const description = approved
    ? 'Cererea ta de acces a fost aprobată. Panoul poate fi folosit cât timp ești înregistrat în Familia Sahara.'
    : 'Accesul tău în panoul Sahara Cartel a fost refuzat sau revocat.';
  if (approved) {
    notify(g, [uid], title, description, 'notices');
    const job = g.dmQueue.find((x) => x.userId === uid && x.title === title);
    if (job) job.accessNotice = true;
  }
  else {
    const notice = { id: id(), at: time(), title, text: description, target: 'notices', userId: uid, attempts: 0, nextAt: time(), accessNotice: true };
    g.dmQueue.push(notice);
    if (g.dmQueue.length > 1500) g.dmQueue.splice(0, g.dmQueue.length - 1500);
  }
  save();
}

// Persistent delivery queue: website notices remain the source of truth. DM failures never undo the action.
// Limit attempts and record sent notice IDs to avoid repeat sends on normal retries and restarts.
let draining = false;
async function drainDm(guildId, sender, permitted, max = 8) {
  if (draining) return { sent: 0, skipped: 0 };
  draining = true;
  let sent = 0, skipped = 0;
  try {
    const g = dataFor(guildId);
    for (const job of [...g.dmQueue].slice(0, 120)) {
      if (sent + skipped >= max) break;
      if (job.nextAt > time()) continue;
      const found = g.dmQueue.findIndex((x) => x.id === job.id);
      if (found < 0) continue;
      if (g.sentDm.includes(job.id) || !(await permitted(job.userId, job))) {
        g.dmQueue.splice(found, 1); skipped++; save(); continue;
      }
      try {
        await sender(job.userId, job);
        g.sentDm.unshift(job.id);
        if (g.sentDm.length > 2000) g.sentDm.length = 2000;
        g.dmQueue.splice(found, 1);
        sent++;
      } catch (error) {
        job.attempts = (job.attempts || 0) + 1;
        // Discord blocks DM when user disallows private messages; do not keep retrying 403.
        const permanent = [50007, 10013, 50013].includes(Number(error?.code));
        if (permanent || job.attempts >= 3) { g.dmQueue.splice(found, 1); skipped++; }
        else job.nextAt = time() + Math.min(300000, job.attempts * 60000);
      }
      save();
    }
    return { sent, skipped };
  } finally { draining = false; }
}
module.exports = { handle, dataFor, drainDm, notifyAccess, FILE };
