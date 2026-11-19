require('dotenv').config();
const fs = require('fs');
const { DATA_DIR } = require('./src/store');
const web = require('./src/web');
const botMod = require('./src/bot');

process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err));
process.on('uncaughtException', (err) => console.error('Uncaught exception:', err));

let files = []; try { files = fs.readdirSync(DATA_DIR); } catch { /* new */ }
console.log(`Storage: ${DATA_DIR} (${files.length} files: ${files.join(', ') || 'none'})`);
if (process.env.RAILWAY_ENVIRONMENT && !process.env.RAILWAY_VOLUME_MOUNT_PATH && !process.env.DATA_DIR) console.warn('WARNING: no Railway Volume attached. Data is wiped on every restart. Add a Volume mounted at /app/data.');
if (!process.env.TRUCKY_COMPANY_ID) console.warn('Trucky: TRUCKY_COMPANY_ID is not set (it can also be set on the site, Staff -> Settings).');

const site = web.start();
const bot = botMod.start();
site.setBot(bot);
const connect = () => bot.login().catch((err) => { console.error(`Discord login failed: ${err.message}. Trying again in 60 seconds.`); setTimeout(connect, 60_000); });
connect();
