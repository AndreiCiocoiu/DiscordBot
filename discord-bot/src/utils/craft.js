// Crafting lookup (no slash commands):
//   craft <item>      text trigger, answers with the recipe (anyone)
//   craft panou       post the panel with categories + search (admin)
// Recipes live in assets/recipes.json. Optional picture per item: assets/craft/<slug>.png|jpg|webp
// where <slug> is the item name in lowercase with dashes (e.g. cadru-pistol.png).
const fs = require('fs');
const path = require('path');
const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, PermissionFlagsBits,
  StringSelectMenuBuilder, TextInputBuilder, TextInputStyle, AttachmentBuilder,
} = require('discord.js');
const adminlog = require('./adminlog');

const FILE = path.join(__dirname, '..', '..', 'assets', 'recipes.json');
const IMG_DIR = path.join(__dirname, '..', '..', 'assets', 'craft');
const NO_PING = { parse: [], repliedUser: false };
const COLOR = 0xc8923a;
const PAGE = 25;

// ---- data ---------------------------------------------------------------

let cache = { mtime: 0, recipes: [], categories: [] };
function data() {
  try {
    const mtime = fs.statSync(FILE).mtimeMs;
    if (mtime !== cache.mtime) {
      const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
      const recipes = (raw.recipes || []).filter((r) => r?.name && Array.isArray(r.ingredients));
      const cats = [...new Set([...(raw.categories || []), ...recipes.map((r) => r.category || 'Diverse')])]
        .filter((c) => recipes.some((r) => (r.category || 'Diverse') === c));
      cache = { mtime, recipes, categories: cats };
    }
  } catch (err) { console.error('craft: could not read recipes.json:', err.message); }
  return cache;
}

const norm = (s) => String(s).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const slug = (s) => norm(s).replace(/ /g, '-');

function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return d[a.length][b.length];
}

// score: lower is better, null = no match
function score(recipe, q) {
  const name = norm(recipe.name);
  if (name === q) return 0;
  if (name.startsWith(q)) return 1;
  const qt = q.split(' ');
  const nt = name.split(' ');
  if (qt.every((t) => name.includes(t))) return 2;
  // typo tolerance, word by word
  let total = 0;
  for (const t of qt) {
    const best = Math.min(...nt.map((w) => (w.startsWith(t) ? 0 : lev(w, t))));
    if (best > (t.length > 5 ? 2 : 1)) return null;
    total += best;
  }
  return 3 + total;
}

function search(query) {
  const q = norm(query);
  if (!q) return [];
  return data().recipes
    .map((r) => ({ r, s: score(r, q) }))
    .filter((x) => x.s !== null)
    .sort((a, b) => a.s - b.s || a.r.name.localeCompare(b.r.name))
    .map((x) => x.r);
}

// ---- rendering ----------------------------------------------------------

function imageFor(recipe) {
  for (const ext of ['png', 'jpg', 'jpeg', 'webp']) {
    const f = path.join(IMG_DIR, `${slug(recipe.name)}.${ext}`);
    if (fs.existsSync(f)) return { file: f, name: `${slug(recipe.name)}.${ext}` };
  }
  return null;
}

function recipePayload(recipe) {
  const lines = recipe.ingredients.map(([n, q]) => `**${n}** x${q}`).join('\n');
  const embed = new EmbedBuilder().setColor(COLOR).setTitle(recipe.name)
    .addFields({ name: 'Ingrediente', value: lines || '-' });
  const details = [];
  if (recipe.category) details.push(`Categorie: ${recipe.category}`);
  if (recipe.level !== undefined) details.push(`Nivel rețetă: ${recipe.level}`);
  if (recipe.points !== undefined) details.push(`Puncte rețetă: ${recipe.points}`);
  if (recipe.time) details.push(`Timp craft: ${recipe.time}`);
  embed.addFields({ name: 'Detalii', value: details.join('\n') });
  if (recipe.note) embed.setFooter({ text: recipe.note });
  const payload = { embeds: [embed], allowedMentions: NO_PING, files: [] };
  const img = imageFor(recipe);
  if (img) {
    payload.files.push(new AttachmentBuilder(img.file, { name: img.name }));
    embed.setThumbnail(`attachment://${img.name}`);
  }
  return payload;
}

const row = (...c) => new ActionRowBuilder().addComponents(...c);
const btn = (id, label, style = ButtonStyle.Secondary) => new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);

function itemSelect(customId, recipes, placeholder) {
  return new StringSelectMenuBuilder().setCustomId(customId).setPlaceholder(placeholder)
    .addOptions(recipes.slice(0, PAGE).map((r) => ({ label: r.name.slice(0, 100), value: r.name.slice(0, 100), description: r.ingredients.map(([n, q]) => `${n} x${q}`).join(', ').slice(0, 100) })));
}

function panelPayload() {
  const { categories, recipes } = data();
  const embed = new EmbedBuilder().setColor(COLOR).setTitle('Crafting')
    .setDescription('Caută o rețetă (**Caută**) sau alege o categorie din listă. Poți scrie și direct în chat: `craft cadru pistol`.')
    .setFooter({ text: `${recipes.length} rețete` });
  const rows = [];
  if (categories.length) {
    rows.push(row(new StringSelectMenuBuilder().setCustomId('cr:cat').setPlaceholder('Alege categoria')
      .addOptions(categories.slice(0, 25).map((c, i) => ({ label: c, value: String(i), description: `${recipes.filter((r) => (r.category || 'Diverse') === c).length} iteme` })))));
  }
  rows.push(row(btn('cr:find', 'Caută', ButtonStyle.Success)));
  return { embeds: [embed], components: rows, allowedMentions: NO_PING };
}

function categoryView(catIdx, page) {
  const { categories, recipes } = data();
  const cat = categories[catIdx];
  if (!cat) return { content: 'Categoria nu mai există.', embeds: [], components: [] };
  const items = recipes.filter((r) => (r.category || 'Diverse') === cat).sort((a, b) => a.name.localeCompare(b.name));
  const pages = Math.max(1, Math.ceil(items.length / PAGE));
  const p = Math.min(Math.max(0, page), pages - 1);
  const slice = items.slice(p * PAGE, p * PAGE + PAGE);
  const embed = new EmbedBuilder().setColor(COLOR).setTitle(cat)
    .setDescription(slice.map((r) => `**${r.name}**: ${r.ingredients.map(([n, q]) => `${n} x${q}`).join(', ')}`).join('\n').slice(0, 4000) || '-')
    .setFooter({ text: `Pagina ${p + 1}/${pages} · ${items.length} iteme` });
  const rows = [row(itemSelect(`cr:item:${catIdx}`, slice, 'Alege un item pentru detalii'))];
  if (pages > 1) rows.push(row(btn(`cr:pg:${catIdx}:${p - 1}`, 'Înapoi').setDisabled(p === 0), btn(`cr:pg:${catIdx}:${p + 1}`, 'Înainte').setDisabled(p >= pages - 1)));
  return { content: '', embeds: [embed], components: rows };
}

function searchView(query) {
  const found = search(query);
  if (!found.length) return { content: `Nu am găsit **${query.slice(0, 60)}**. Încearcă alt nume sau alege din categorii.`, embeds: [], components: [], files: [] };
  if (found.length === 1) return { content: '', components: [], ...recipePayload(found[0]) };
  const embed = new EmbedBuilder().setColor(COLOR).setTitle(`Rezultate pentru „${query.slice(0, 60)}”`)
    .setDescription(found.slice(0, PAGE).map((r) => `**${r.name}**: ${r.ingredients.map(([n, q]) => `${n} x${q}`).join(', ')}`).join('\n').slice(0, 4000));
  return { content: '', embeds: [embed], components: [row(itemSelect('cr:pick', found, 'Alege un item pentru detalii'))], files: [] };
}

// ---- interactions -------------------------------------------------------

async function handleInteraction(interaction) {
  const id = interaction.customId;
  if (!id || !id.startsWith('cr:')) return false;
  const [, kind, a, b] = id.split(':');

  if (interaction.isButton() && kind === 'find') {
    await interaction.showModal(new ModalBuilder().setCustomId('cr:q').setTitle('Caută rețetă').addComponents(
      row(new TextInputBuilder().setCustomId('q').setLabel('Ce item cauți?').setPlaceholder('ex: cadru pistol').setStyle(TextInputStyle.Short).setMaxLength(60).setRequired(true))));
    return true;
  }
  if (interaction.isModalSubmit() && kind === 'q') {
    await interaction.reply({ ephemeral: true, ...searchView(interaction.fields.getTextInputValue('q')) });
    return true;
  }
  if (interaction.isStringSelectMenu() && kind === 'cat') {
    await interaction.reply({ ephemeral: true, ...categoryView(Number(interaction.values[0]), 0) });
    return true;
  }
  if (interaction.isButton() && kind === 'pg') {
    await interaction.update(categoryView(Number(a), Number(b)));
    return true;
  }
  if (interaction.isStringSelectMenu() && (kind === 'item' || kind === 'pick')) {
    const r = data().recipes.find((x) => x.name === interaction.values[0]);
    if (!r) { await interaction.update({ content: 'Rețeta nu mai există.', embeds: [], components: [] }); return true; }
    // new ephemeral message so the list stays available
    await interaction.reply({ ephemeral: true, ...recipePayload(r) });
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
    await message.channel.send(panelPayload());
    adminlog.action(client, message.guild.id, 'Craft: panou postat', `În ${message.channel}`, message.author.id);
    if (!(await message.delete().then(() => true).catch(() => false))) await message.react('✅').catch(() => {});
    return;
  }

  const now = Date.now();
  if (now - (lastUse.get(message.author.id) || 0) < 2000) return;
  lastUse.set(message.author.id, now);

  const view = searchView(arg);
  const { content, ...rest } = view;
  await message.reply({ ...(content ? { content } : {}), ...rest, allowedMentions: NO_PING }).catch(() => {});
}

module.exports = { handleInteraction, handleMessage, search, panelPayload, data };
