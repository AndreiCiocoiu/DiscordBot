// /anunt: an admin writes the text in a box, the bot posts it in the announcements channel
// as a western parchment sheet, with a hidden @everyone (||@everyone|| = grey bar that still pings).
//   /anunt            ping everyone (default)
//   /anunt ping:false no ping
const path = require('path');
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const {
  ActionRowBuilder, AttachmentBuilder, ModalBuilder, PermissionFlagsBits, SlashCommandBuilder,
  TextInputBuilder, TextInputStyle, ChannelType,
} = require('discord.js');
const store = require('./store');
const adminlog = require('./adminlog');

const FONTS = path.join(__dirname, '..', '..', 'assets', 'fonts');
for (const [file, name] of [['Rye-Regular.ttf', 'Rye'], ['DejaVuSerif-Bold.ttf', 'DejaVuSerif']]) {
  try { if (!GlobalFonts.families.some((f) => f.family === name)) GlobalFonts.registerFromPath(path.join(FONTS, file), name); }
  catch (err) { console.warn('announce: font', file, err.message); }
}

const MAX_TEXT = 900, MAX_TITLE = 40;

const command = new SlashCommandBuilder().setName('anunt').setDescription('Postează un anunț în canalul de anunțuri (admin)')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setContexts(0)
  .addBooleanOption((o) => o.setName('ping').setDescription('Dă @everyone (implicit: da)'));

// small seeded random so the same sheet always looks the same
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function wrap(ctx, text, maxW) {
  const lines = [];
  for (const para of text.split('\n')) {
    if (!para.trim()) { lines.push(''); continue; }
    let line = '';
    for (const word of para.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width <= maxW) { line = test; continue; }
      if (line) lines.push(line);
      line = word;
      while (ctx.measureText(line).width > maxW) { // a very long word
        let cut = line.length - 1;
        while (cut > 1 && ctx.measureText(line.slice(0, cut)).width > maxW) cut--;
        lines.push(line.slice(0, cut)); line = line.slice(cut);
      }
    }
    lines.push(line);
  }
  return lines;
}

function render({ title, text, author }) {
  const W = 900, PADX = 96, TEXT_W = W - PADX * 2, LH = 34;
  const probe = createCanvas(10, 10).getContext('2d');
  probe.font = '23px DejaVuSerif';
  const lines = wrap(probe, text, TEXT_W);
  const H = Math.max(420, 190 + lines.length * LH + 150);
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const rand = rng(text.length * 7919 + lines.length * 131 + title.length);

  // torn sheet outline
  const M = 22;
  const edge = [];
  const jag = (n, f) => { for (let i = 0; i < n; i++) f(i / n); };
  const j = () => (rand() - 0.5) * 9;
  jag(60, (t) => edge.push([M + t * (W - 2 * M), M + j()]));
  jag(40, (t) => edge.push([W - M + j(), M + t * (H - 2 * M)]));
  jag(60, (t) => edge.push([W - M - t * (W - 2 * M), H - M + j()]));
  jag(40, (t) => edge.push([M + j(), H - M - t * (H - 2 * M)]));
  const outline = () => { ctx.beginPath(); edge.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); };

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 5;
  outline(); ctx.fillStyle = '#e6cf9a'; ctx.fill();
  ctx.restore();

  ctx.save();
  outline(); ctx.clip();
  const base = ctx.createLinearGradient(0, 0, W, H);
  base.addColorStop(0, '#efdcab'); base.addColorStop(0.5, '#e4cb94'); base.addColorStop(1, '#d9bd84');
  ctx.fillStyle = base; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 14; i++) { // stains
    const x = rand() * W, y = rand() * H, r = 50 + rand() * 150;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(140,95,40,${0.05 + rand() * 0.09})`); g.addColorStop(1, 'rgba(140,95,40,0)');
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < 2600; i++) { // grain
    ctx.fillStyle = `rgba(${rand() > 0.5 ? '90,60,25' : '255,245,210'},${0.03 + rand() * 0.05})`;
    ctx.fillRect(rand() * W, rand() * H, 1 + rand() * 2, 1 + rand() * 2);
  }
  const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.72); // burnt edges
  v.addColorStop(0, 'rgba(90,50,15,0)'); v.addColorStop(1, 'rgba(90,50,15,0.5)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);

  // double frame with corner brackets
  const INK = '#3a2412';
  ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.strokeRect(54, 54, W - 108, H - 108);
  ctx.lineWidth = 1.5; ctx.strokeRect(62, 62, W - 124, H - 124);
  const corner = (x, y, sx, sy) => {
    ctx.save(); ctx.translate(x, y); ctx.scale(sx, sy);
    ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 30); ctx.lineTo(0, 0); ctx.lineTo(30, 0); ctx.stroke();
    ctx.beginPath(); ctx.arc(12, 12, 4, 0, Math.PI * 2); ctx.fillStyle = INK; ctx.fill();
    ctx.restore();
  };
  corner(54, 54, 1, 1); corner(W - 54, 54, -1, 1); corner(54, H - 54, 1, -1); corner(W - 54, H - 54, -1, -1);
  ctx.fillStyle = '#6b4a2a'; // nails
  for (const [x, y] of [[40, 40], [W - 40, 40], [40, H - 40], [W - 40, H - 40]]) {
    ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,230,180,0.5)'; ctx.beginPath(); ctx.arc(x - 2, y - 2, 2, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#6b4a2a';
  }

  // title
  ctx.textAlign = 'center'; ctx.fillStyle = INK;
  let size = 54;
  do { ctx.font = `${size}px Rye`; size -= 2; } while (ctx.measureText(title).width > W - 220 && size > 24);
  ctx.fillText(title, W / 2, 148);
  // divider with a star
  ctx.lineWidth = 2; ctx.strokeStyle = INK;
  ctx.beginPath(); ctx.moveTo(150, 178); ctx.lineTo(W / 2 - 22, 178); ctx.moveTo(W / 2 + 22, 178); ctx.lineTo(W - 150, 178); ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 5 : 12; ctx.lineTo(W / 2 + Math.cos(a) * r, 178 + Math.sin(a) * r); }
  ctx.closePath(); ctx.fillStyle = INK; ctx.fill();

  // body
  ctx.textAlign = 'left'; ctx.font = '23px DejaVuSerif'; ctx.fillStyle = '#2b180a';
  let y = 232;
  for (const line of lines) { if (line) ctx.fillText(line, PADX, y); y += LH; }

  // signature
  if (author) {
    ctx.textAlign = 'right'; ctx.font = '26px Rye'; ctx.fillStyle = INK;
    ctx.fillText(author.slice(0, 28), W - PADX, H - 92);
  }
  ctx.restore();
  return canvas.toBuffer('image/png');
}

// ---- posting ------------------------------------------------------------

function findAnnounceChannel(guild) {
  const id = store.cfg(guild.id).announceId;
  const byId = id ? guild.channels.cache.get(id) : null;
  if (byId) return byId;
  const { nameKey } = require('./serverText');
  return guild.channels.cache.find((c) => c.type === ChannelType.GuildText && ['anunturi', 'anunt'].includes(nameKey(c.name))) || null;
}

const modal = (ping) => new ModalBuilder().setCustomId(`an:m:${ping ? 1 : 0}`).setTitle('Anunț nou').addComponents(
  new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('title').setLabel('Titlu (opțional)').setPlaceholder('ANUNȚ')
    .setStyle(TextInputStyle.Short).setMaxLength(MAX_TITLE).setRequired(false)),
  new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('text').setLabel('Mesajul')
    .setStyle(TextInputStyle.Paragraph).setMaxLength(MAX_TEXT).setRequired(true)),
);

async function handleInteraction(interaction, client) {
  const isCmd = interaction.isChatInputCommand?.() && interaction.commandName === 'anunt';
  const isModal = interaction.isModalSubmit?.() && interaction.customId?.startsWith('an:m:');
  if (!isCmd && !isModal) return false;

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({ content: 'Doar adminii pot posta anunțuri.', ephemeral: true });
    return true;
  }
  if (isCmd) {
    const ping = interaction.options.getBoolean('ping') ?? true;
    const ch = findAnnounceChannel(interaction.guild);
    if (!ch) {
      await interaction.reply({ content: 'Nu am canal de anunțuri. Intră în canalul dorit și scrie `server aici anunturi` (sau `server setup`).', ephemeral: true });
      return true;
    }
    await interaction.showModal(modal(ping));
    return true;
  }

  const ping = interaction.customId.endsWith(':1');
  const title = (interaction.fields.getTextInputValue('title') || '').trim().toUpperCase() || 'ANUNȚ';
  const text = interaction.fields.getTextInputValue('text').trim();
  await interaction.deferReply({ ephemeral: true });
  const ch = findAnnounceChannel(interaction.guild);
  if (!ch) { await interaction.editReply('Nu mai găsesc canalul de anunțuri.'); return true; }
  try {
    const author = interaction.member?.displayName || interaction.user.username;
    const png = render({ title, text, author });
    await ch.send({
      content: ping ? '||@everyone||' : undefined,
      files: [new AttachmentBuilder(png, { name: 'anunt.png', description: `${title}: ${text}`.slice(0, 1000) })],
      allowedMentions: ping ? { parse: ['everyone'] } : { parse: [] },
    });
    adminlog.action(client, interaction.guildId, 'Anunț postat', `${ping ? 'Cu @everyone' : 'Fără ping'} în ${ch}\n**${title}**\n${text.slice(0, 500)}`, interaction.user.id);
    await interaction.editReply(`Postat în ${ch}.`);
  } catch (err) {
    console.error('announce error:', err);
    await interaction.editReply(`Nu a mers: ${err.message}. Botul are nevoie de Send Messages, Attach Files și Mention Everyone în canalul de anunțuri.`);
  }
  return true;
}

module.exports = { command, handleInteraction, render };
