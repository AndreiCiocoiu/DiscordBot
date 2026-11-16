require('dotenv').config();
const fs = require('fs');
const { DATA_DIR } = require('./src/store');
const web = require('./src/web');
const botMod = require('./src/bot');

process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err));
process.on('uncaughtException', (err) => console.error('Uncaught exception:', err));

function reportStorage() {
  let files = [];
  try { files = fs.readdirSync(DATA_DIR); } catch { /* not created yet */ }
  console.log(`Storage: ${DATA_DIR} (${files.length} files: ${files.join(', ') || 'none'})`);
  if (process.env.RAILWAY_ENVIRONMENT && !process.env.RAILWAY_VOLUME_MOUNT_PATH && !process.env.DATA_DIR) {
    console.warn('WARNING: no Railway Volume attached. Announcements, wishlists and settings are wiped on every restart. Add a Volume mounted at /app/data.');
  }
}

async function main() {
  reportStorage();
  const site = web.start();            // the website answers first, the bot connects after
  const bot = botMod.start();
  site.setBot(bot);
  // if Discord cannot be reached (wrong token, outage), the site stays up and the bot keeps trying
  const connect = () => bot.login().catch((err) => {
    console.error(`Discord login failed: ${err.message}. Trying again in 60 seconds.`);
    setTimeout(connect, 60_000);
  });
  await connect();
}

main().catch((err) => { console.error('Failed to start:', err); process.exit(1); });
