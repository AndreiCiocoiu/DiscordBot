const { EmbedBuilder } = require('discord.js');
const { toSmallCaps } = require('./fancyFont');

// Official Steam assets — a small square icon for the author row, and a
// wide banner image for visual weight, so news posts don't read as a wall
// of plain text.
const AION2_ICON =
  'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3393110/242e64994be906369974093269d88fb40065b10a/capsule_sm_120.jpg';
const AION2_BANNER =
  'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3393110/8ba6511e1889fd45561956e603d04fac1a89645e/header.jpg';

function buildAion2NewsEmbed(item) {
  const embed = new EmbedBuilder()
    .setAuthor({ name: toSmallCaps('AION 2 News'), iconURL: AION2_ICON })
    .setTitle(item.title)
    .setURL(item.url)
    .setColor(0x8a2be2)
    .setImage(AION2_BANNER)
    .setFooter({ text: item.feedName })
    .setTimestamp(item.date * 1000);

  const content = item.content?.slice(0, 1200);
  embed.setDescription(
    content
      ? `${content}${item.content.length > 1200 ? '…' : ''}\n\n[Read the full post](${item.url})`
      : `*No preview available.*\n\n[Read the full post](${item.url})`
  );

  return embed;
}

module.exports = { buildAion2NewsEmbed, AION2_ICON, AION2_BANNER };
