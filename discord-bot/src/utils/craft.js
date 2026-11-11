// Crafting calculator (RedZone weapons). Data: assets/recipes.json
//   /craft <arma> [cantitate]    result in the chat (autocomplete)
//   craft <arma> [cantitate]     same, as text; the bot deletes your message
//   craft panou                  post the panel (admin)
// Panel buttons: Catalog (weapons per category, with arrows) and Calculator (several weapons at once).
// The answer has the same sections as the website: ORDER, MATERIALS, MADE ON THE WAY, ORE, CRAFT ORDER.
const fs = require('fs');
const banner = require('./panelBanner');
const path = require('path');
const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, PermissionFlagsBits,
  StringSelectMenuBuilder, TextInputBuilder, TextInputStyle, SlashCommandBuilder,
} = require('discord.js');
const adminlog = require('./adminlog');

const FILE = path.join(__dirname, '..', '..', 'assets', 'recipes.json');
const NO_PING = { parse: [], repliedUser: false };
const COLOR = 0xb3202a;
const MAX_QTY = 200;

// ---- data ---------------------------------------------------------------

let cache = { mtime: 0, weapons: [], processes: [], categories: [] };
function data() {
  try {
    const mtime = fs.statSync(FILE).mtimeMs;
    if (mtime !== cache.mtime) {
      const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
      const weapons = (raw.weapons || []).filter((w) => w?.name && Array.isArray(w.ingredients));
      cache = { mtime, weapons, processes: raw.processes || [], categories: raw.categories || [...new Set(weapons.map((w) => w.category))] };
    }
  } catch (err) { console.error('craft: could not read recipes.json:', err.message); }
  return cache;
}

const norm = (s) => String(s).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return d[a.length][b.length];
}

function score(w, q) {
  const name = norm(w.name);
  if (name === q) return 0;
  if (name.startsWith(q)) return 1;
  const qt = q.split(' '), nt = name.split(' ');
  if (qt.every((t) => name.includes(t))) return 2;
  let total = 0;
  for (const t of qt) {
    const best = Math.min(...nt.map((x) => (x.startsWith(t) ? 0 : lev(x, t))));
    if (best > (t.length > 4 ? 2 : 1)) return null;
    total += best;
  }
  return 3 + total;
}

function search(query) {
  const q = norm(query);
  if (!q) return [];
  return data().weapons
    .map((w) => ({ w, s: score(w, q) }))
    .filter((x) => x.s !== null)
    .sort((a, b) => a.s - b.s || a.w.name.localeCompare(b.w.name))
    .map((x) => x.w);
}

// best match for a typed name: exact wins, otherwise the first result
function resolve(query) {
  const found = search(query);
  const exact = found.filter((w) => norm(w.name) === norm(query));
  return exact[0] || found[0] || null;
}

// ---- calculator ---------------------------------------------------------

// orders: [{ w, qty }]. Same logic as the website: the intermediate items (Otel, Arc, Suruburi, Teava)
// are crafted in whole batches (leftovers are shown), Fier/Cupru come from ore.
function calc(orders) {
  const { processes } = data();
  const need = new Map(), free = new Map();
  const add = (m, k, v) => m.set(k, (m.get(k) || 0) + v);
  for (const { w, qty } of orders) {
    for (const [n, k] of w.ingredients) {
      add(need, n, k * qty);
      const p = processes.find((x) => x.name === n);
      if (p?.free) add(free, n, Math.min(k, p.free) * qty); // e.g. each weapon already comes with one barrel
    }
  }
  const steps = [], ore = new Map();
  for (const p of processes) { // listed consumers-first, so every need is known when we get to it
    const n = (need.get(p.name) || 0) - (free.get(p.name) || 0);
    if (n <= 0) continue;
    const crafts = Math.ceil(n / p.yield), made = crafts * p.yield;
    steps.push({ p, crafts, made, left: made - n });
    for (const [i, k] of p.from) {
      add(need, i, k * crafts);
      if (/^minereu/i.test(i)) add(ore, i, k * crafts);
    }
  }
  steps.reverse();
  const inter = new Set(processes.filter((p) => p.intermediate).map((p) => p.name));
  const onTheWay = processes.filter((p) => p.intermediate && (need.get(p.name) || 0) > 0)
    .map((p) => [p.name, (need.get(p.name) || 0) - (free.get(p.name) || 0)])
    .reverse(); // Otel, Arc, Suruburi, Teava
  const head = ['Fier', 'Cupru', 'Carbune', 'Lemn'];
  const materials = [...need].filter(([n]) => !inter.has(n) && !/^minereu/i.test(n))
    .sort((a, b) => {
      const ia = head.indexOf(a[0]), ib = head.indexOf(b[0]);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
  return { steps, ore: [...ore].sort((a, b) => b[0].length - a[0].length || a[0].localeCompare(b[0])), materials, onTheWay };
}

const list = (pairs) => pairs.map(([n, q]) => `${n}: ${q}`).join('\n') || '-';

function calcEmbed(orders, who, notes = []) {
  const r = calc(orders);
  const parts = [];
  parts.push(`**COMANDA**\n${orders.map(({ w, qty }) => `- ${qty}x ${w.name}`).join('\n')}`);
  parts.push(`**MATERIALE NECESARE**\n${list(r.materials)}`);
  if (r.onTheWay.length) parts.push(`**FĂCUTE PE PARCURS**\n${list(r.onTheWay)}`);
  if (r.ore.length) parts.push(`**MINEREU DE ADUNAT**\n${list(r.ore)}`);
  const order = r.steps.map((s, i) => {
    const out = s.p.yield > 1 ? `iese ${s.made}${s.left ? `, rămân ${s.left}` : ''} - ` : '';
    return `${i + 1}. ${s.p.name} - ${s.crafts}x craft (${s.p.where}) - ${out}folosește ${s.p.from.map(([n, k]) => `${k * s.crafts} ${n}`).join(', ')}`;
  });
  orders.forEach(({ w, qty }) => {
    order.push(`${order.length + 1}. ${w.name} - ${qty}x craft - folosește ${w.ingredients.map(([n, k]) => `${k * qty} ${n}`).join(', ')}`);
  });
  parts.push(`**ORDINEA DE CRAFT**\n${order.join('\n')}`);
  let desc = parts.join('\n\n');
  if (desc.length > 4000) desc = `${desc.slice(0, 3990)}…`;
  const embed = new EmbedBuilder().setColor(COLOR).setTitle(orders.length === 1 ? `${orders[0].w.name} x${orders[0].qty}` : 'Calculator crafting').setDescription(desc);
  const foot = [who ? `Cerut de ${who}` : null, ...notes].filter(Boolean).join(' · ');
  if (foot) embed.setFooter({ text: foot.slice(0, 200) });
  return embed;
}

const calcPayload = (orders, who, notes) => ({ content: '', embeds: [calcEmbed(orders, who, notes)], components: [], files: [], attachments: [], allowedMentions: NO_PING });

const clampQty = (n) => Math.min(MAX_QTY, Math.max(1, Math.floor(Number(n) || 1)));

// "Revolver Cattleman 2", "2x cattleman", "carcano"
function parseLine(line) {
  const t = line.trim();
  if (!t) return null;
  let m = t.match(/^(.*\S)\s+x?(\d{1,3})x?$/i);
  if (m) return { name: m[1], qty: clampQty(m[2]) };
  m = t.match(/^(\d{1,3})\s*x?\s+(.+)$/i);
  if (m) return { name: m[2], qty: clampQty(m[1]) };
  return { name: t, qty: 1 };
}

// text -> merged orders (+ the lines that matched nothing)
function ordersFromText(text) {
  const map = new Map(), missing = [];
  for (const line of text.split(/\n|;/)) {
    const p = parseLine(line);
    if (!p) continue;
    const w = resolve(p.name);
    if (!w) { missing.push(p.name.slice(0, 40)); continue; }
    map.set(w.name, { w, qty: clampQty((map.get(w.name)?.qty || 0) + p.qty) });
  }
  return { orders: [...map.values()].slice(0, 10), missing };
}

const row = (...c) => new ActionRowBuilder().addComponents(...c);
const btn = (id, label, style = ButtonStyle.Secondary) => new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);

function weaponSelect(customId, weapons, placeholder) {
  return new StringSelectMenuBuilder().setCustomId(customId).setPlaceholder(placeholder)
    .addOptions(weapons.slice(0, 25).map((w) => ({
      label: w.name.slice(0, 100), value: w.name.slice(0, 100),
      description: `${w.badge ? `${w.badge} · ` : ''}${w.category}`.slice(0, 100),
    })));
}

// "/craft Revolver Cattleman 2" -> answer, or a pick list when the name is ambiguous
function lookup(query, qty, who) {
  const found = search(query);
  if (!found.length) return { content: `Nu am găsit **${query.slice(0, 60)}**. Încearcă alt nume sau deschide catalogul.`, embeds: [], components: [], files: [], attachments: [] };
  const exact = found.filter((w) => norm(w.name) === norm(query));
  if (exact.length === 1) return calcPayload([{ w: exact[0], qty }], who);
  if (found.length === 1) return calcPayload([{ w: found[0], qty }], who);
  const embed = new EmbedBuilder().setColor(COLOR).setTitle(`Care dintre ele? (x${qty})`)
    .setDescription(found.slice(0, 25).map((w) => `**${w.name}**`).join('\n'));
  return { content: '', embeds: [embed], components: [row(weaponSelect(`cr:pickq:${qty}`, found, 'Alege arma'))], files: [], attachments: [] };
}

// ---- panel + catalog ----------------------------------------------------

function panelPayload() {
  const embed = new EmbedBuilder().setColor(COLOR).setTitle('Crafting')
    .setDescription('**Catalog**: armele pe categorii, cu săgeți stânga/dreapta.\n**Calculator**: scrii armele și cantitățile și primești materialele, minereul de adunat și ordinea de craft.\nPoți folosi și `/craft Revolver Cattleman 2`.')
    .setImage(banner.URL).setFooter({ text: `${data().weapons.length} arme` });
  return { embeds: [embed], components: [row(btn('cr:open', 'Catalog', ButtonStyle.Success), btn('cr:calc', 'Calculator'))], allowedMentions: NO_PING };
}

function catalogPages() {
  const { categories, weapons } = data();
  return categories.map((c) => ({ cat: c, items: weapons.filter((w) => w.category === c) })).filter((p) => p.items.length);
}

async function catalogView(index) {
  const pages = catalogPages();
  if (!pages.length) return { content: 'Catalogul e gol.', embeds: [], components: [], files: [], attachments: [] };
  const i = Math.min(Math.max(0, Number(index) || 0), pages.length - 1);
  const pg = pages[i];
  const embed = new EmbedBuilder().setColor(COLOR).setTitle(pg.cat.toUpperCase()).setFooter({ text: `Pagina ${i + 1}/${pages.length} · ${pg.items.length} arme` });
  for (const w of pg.items) {
    embed.addFields({
      name: `${w.name}${w.badge ? `  [${w.badge}]` : ''}`.slice(0, 256),
      value: w.ingredients.map(([n, q]) => `${q}× ${n}`).join(' + ').slice(0, 1000),
    });
  }
  const catMenu = new StringSelectMenuBuilder().setCustomId('cr:cgc').setPlaceholder('Sari la o categorie')
    .addOptions(pages.slice(0, 25).map((p, k) => ({ label: p.cat, value: String(k), default: k === i })));
  const nav = row(
    btn(`cr:cg:${i - 1}`, '◀').setDisabled(i === 0),
    btn('cr:noop', `${i + 1}/${pages.length}`).setDisabled(true),
    btn(`cr:cg:${i + 1}`, '▶').setDisabled(i >= pages.length - 1),
    btn('cr:calc', 'Calculator', ButtonStyle.Success),
  );
  return { content: '', embeds: [embed], components: [row(catMenu), row(weaponSelect('cr:item', pg.items, 'Alege o armă: calculez materialele în chat')), nav], files: [], attachments: [] };
}

// ---- interactions -------------------------------------------------------

const nameOf = (i) => i.member?.displayName || i.user?.username;

const command = new SlashCommandBuilder().setName('craft').setDescription('Materiale, minereu și ordinea de craft pentru o armă').setContexts(0)
  .addStringOption((o) => o.setName('item').setDescription('Arma (ex: Revolver Cattleman)').setAutocomplete(true).setRequired(true))
  .addIntegerOption((o) => o.setName('cantitate').setDescription('Câte vrei să faci').setMinValue(1).setMaxValue(MAX_QTY));

function calcModal() {
  return new ModalBuilder().setCustomId('cr:m').setTitle('Calculator crafting').addComponents(
    row(new TextInputBuilder().setCustomId('orders').setLabel('Arme, una pe rând, cu cantitate')
      .setPlaceholder('Revolver Cattleman 2\nCarcano Rifle 1').setStyle(TextInputStyle.Paragraph).setMaxLength(400).setRequired(true)));
}

async function handleInteraction(interaction) {
  if (interaction.isAutocomplete?.() && interaction.commandName === 'craft') {
    const q = interaction.options.getFocused();
    const all = data().weapons;
    const found = q.trim() ? search(q) : [...all].sort((a, b) => a.name.localeCompare(b.name));
    await interaction.respond(found.slice(0, 25).map((w) => ({ name: `${w.name} (${w.category})`.slice(0, 100), value: w.name.slice(0, 100) }))).catch(() => {});
    return true;
  }
  if (interaction.isChatInputCommand?.() && interaction.commandName === 'craft') {
    await interaction.deferReply(); // public: everyone in the channel sees it
    await interaction.editReply(lookup(interaction.options.getString('item', true), clampQty(interaction.options.getInteger('cantitate') || 1), nameOf(interaction)));
    return true;
  }

  const id = interaction.customId;
  if (!id || !id.startsWith('cr:')) return false;
  const [, kind, a] = id.split(':');

  if (interaction.isButton() && (kind === 'calc' || kind === 'find')) { await interaction.showModal(calcModal()); return true; }
  if (interaction.isModalSubmit() && kind === 'm') {
    const { orders, missing } = ordersFromText(interaction.fields.getTextInputValue('orders'));
    if (!orders.length) { await interaction.reply({ content: `Nu am găsit nicio armă${missing.length ? ` (${missing.join(', ')})` : ''}.`, ephemeral: true }); return true; }
    await interaction.deferReply();
    await interaction.editReply(calcPayload(orders, nameOf(interaction), missing.length ? [`nu am găsit: ${missing.join(', ')}`] : []));
    return true;
  }
  if (interaction.isButton() && kind === 'open') {
    await interaction.deferReply({ ephemeral: true });
    await interaction.editReply(await catalogView(0));
    return true;
  }
  if (interaction.isStringSelectMenu() && kind === 'cat') { // old panels
    await interaction.deferReply({ ephemeral: true });
    await interaction.editReply(await catalogView(0));
    return true;
  }
  if (interaction.isButton() && kind === 'cg') { await interaction.update(await catalogView(Number(a))); return true; }
  if (interaction.isButton() && kind === 'pg') { await interaction.update(await catalogView(0)); return true; }
  if (interaction.isStringSelectMenu() && kind === 'cgc') { await interaction.update(await catalogView(Number(interaction.values[0]))); return true; }
  if (interaction.isButton() && kind === 'noop') { await interaction.deferUpdate(); return true; }

  if (interaction.isStringSelectMenu() && kind === 'pickq') { // ambiguous /craft: the list turns into the answer
    const w = data().weapons.find((x) => x.name === interaction.values[0]);
    if (!w) { await interaction.update({ content: 'Arma nu mai există.', embeds: [], components: [] }); return true; }
    await interaction.update(calcPayload([{ w, qty: clampQty(a) }], nameOf(interaction)));
    return true;
  }
  if (interaction.isStringSelectMenu() && (kind === 'item' || kind === 'pick')) {
    const w = data().weapons.find((x) => x.name === interaction.values[0]);
    if (!w) { await interaction.update({ content: 'Arma nu mai există.', embeds: [], components: [] }); return true; }
    const payload = calcPayload([{ w, qty: 1 }], nameOf(interaction));
    if (kind === 'pick') { await interaction.update(payload); return true; }
    // picked from the private catalog: post it in the chat, keep the catalog open for the next pick
    await interaction.deferUpdate();
    const ch = interaction.channel ?? (await interaction.client.channels.fetch(interaction.channelId).catch(() => null));
    const { attachments, ...pub } = payload;
    if (ch) await ch.send(pub).catch(() => interaction.followUp({ ephemeral: true, ...pub }).catch(() => {}));
    return true;
  }
  return true;
}

// ---- text trigger -------------------------------------------------------

const lastUse = new Map();

async function handleMessage(message, client) {
  if (message.author.bot || !message.guild) return;
  const m = message.content.trim().match(/^craft\s+(.+)$/i);
  if (!m) return;
  const arg = m[1].trim();

  if (arg.toLowerCase() === 'panou') {
    if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild)) return;
    await message.channel.send(banner.withBanner(panelPayload()));
    adminlog.action(client, message.guild.id, 'Craft: panou postat', `În ${message.channel}`, message.author.id);
    if (!(await message.delete().then(() => true).catch(() => false))) await message.react('✅').catch(() => {});
    return;
  }

  const now = Date.now();
  if (now - (lastUse.get(message.author.id) || 0) < 2000) return;
  lastUse.set(message.author.id, now);

  const who = message.member?.displayName || message.author.username;
  const p = parseLine(arg);
  const view = lookup(p.name, p.qty, who);
  const { attachments, content, ...rest } = view;
  const sent = await message.channel.send({ ...(content ? { content: `${message.author}: ${content}` } : {}), ...rest, allowedMentions: { parse: [], users: [] } }).catch(() => null);
  if (sent) await message.delete().catch(() => {}); // only the answer stays in the channel
}

module.exports = { command, handleInteraction, handleMessage, search, panelPayload, catalogView, calc, data };
