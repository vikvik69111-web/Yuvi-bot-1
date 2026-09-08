const { EmbedBuilder } = require("discord.js");
const Warning = require("../models/Warning");
const GuildConfig = require("../models/GuildConfig");

async function getGuildConfig(guildId) {
  return GuildConfig.findOne({ guildId }) || new GuildConfig({ guildId });
}

async function addWarning(guildId, userId, moderatorId, reason) {
  const warning = await Warning.create({
    guildId,
    userId,
    moderatorId,
    reason
  });

  return warning;
}

async function getWarnings(guildId, userId) {
  return Warning.find({ guildId, userId }).sort({ createdAt: -1 });
}

async function getModLogChannel(guild) {
  const config = await getGuildConfig(guild.id);
  return config.logging?.channelId ? guild.channels.cache.get(config.logging.channelId) : null;
}

async function sendModLog(guild, message, type = "moderation") {
  const channel = await getModLogChannel(guild);
  if (!channel || !channel.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setColor(type === "warning" ? "Yellow" : "Blurple")
    .setDescription(message)
    .setTimestamp();

  await channel.send({ embeds: [embed] });
}

module.exports = {
  getGuildConfig,
  addWarning,
  getWarnings,
  getModLogChannel,
  sendModLog
};
