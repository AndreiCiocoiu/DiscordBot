const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('guess')
    .setDescription('Play a number guessing game (1-100).'),

  async execute(interaction) {
    const target = Math.floor(Math.random() * 100) + 1;
    const maxAttempts = 6;

    await interaction.reply(
      `🎯 I'm thinking of a number between **1 and 100**. You have ${maxAttempts} guesses — type them in chat!`
    );

    const filter = (m) => m.author.id === interaction.user.id && /^\d+$/.test(m.content.trim());
    const collector = interaction.channel.createMessageCollector({ filter, max: maxAttempts, time: 60_000 });

    collector.on('collect', async (m) => {
      const guessNum = parseInt(m.content.trim(), 10);

      if (guessNum === target) {
        await m.reply(`🎉 Correct! It was **${target}**.`);
        collector.stop('won');
        return;
      }

      const hint = guessNum < target ? 'higher ⬆️' : 'lower ⬇️';
      await m.reply(`Nope — try ${hint}.`);
    });

    collector.on('end', async (_collected, reason) => {
      if (reason !== 'won') {
        await interaction.followUp(`⏱️ Game over! The number was **${target}**.`);
      }
    });
  },
};
