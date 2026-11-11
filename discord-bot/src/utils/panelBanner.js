// The Sahara Cartel picture shown big at the bottom of every panel (crafting, razii, evenimente).
// Panels reference it as attachment://sahara.jpg; the file itself is uploaded only when a panel is SENT
// (later edits of the same message keep it, so withBanner() is not needed there).
const path = require('path');
const { AttachmentBuilder } = require('discord.js');

const FILE = path.join(__dirname, '..', '..', 'assets', 'sahara.jpg');
const URL = 'attachment://sahara.jpg';
const withBanner = (payload) => ({ ...payload, files: [new AttachmentBuilder(FILE, { name: 'sahara.jpg' })] });

module.exports = { URL, withBanner };
