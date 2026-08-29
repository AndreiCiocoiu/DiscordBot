const { Events } = require('discord.js');
const { toSmallCaps } = require('../utils/fancyFont');
const { startMemeScheduler } = require('../utils/memeScheduler');

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    console.log(`Logged in as ${client.user.tag}`);
    client.user.setActivity(toSmallCaps('ti-am futut femeia'));
    startMemeScheduler(client);
  },
};
