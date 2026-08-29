const { Events } = require('discord.js');
const { toFraktur } = require('../utils/fancyFont');

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    console.log(`Logged in as ${client.user.tag}`);
    client.user.setActivity(`/setup · ${toFraktur('chill out')}`);
  },
};
