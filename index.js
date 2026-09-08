require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  Events,
  SlashCommandBuilder,
  REST,
  Routes,
  EmbedBuilder,
  PermissionFlagsBits,
  PermissionsBitField,
  ActivityType
} = require("discord.js");

const config = require("./src/config");
const moderationService = require("./src/services/moderation");
const session = require("express-session");
const rateLimit = require("express-rate-limit");
const GuildConfig = require("./src/models/GuildConfig");
const BotProfile = require("./src/models/BotProfile");
const Warning = require("./src/models/Warning");
const mongooseLib = require("mongoose");
const mongoose = mongooseLib;
const express = require("express");
const path = require("path");
const app = express();
const { writeBotStatus } = require("./src/bot-status");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const NITRO_EMOJI_ID = process.env.NITRO_EMOJI_ID || "";
const NITRO_EMOJI_NAME = process.env.NITRO_EMOJI_NAME || "nitro";
const DEFAULT_BOT_PROFILE = {
  botName: "Yuvi Bot",
  avatarUrl: "",
  bannerUrl: "",
  about: "Yuvi Bot — made for server protection, anti-nuke, anti-spam, moderation, security, logging and server management.",
  statusText: "Managing Server",
  activityType: "Playing",
  status: "online",
  rotationEnabled: false,
  rotationIntervalMs: 20000,
  rotatingStatuses: [
    "Managing Server",
    "Managing Server",
    "Managing Server",
    "Managing Server"
  ],
  supportServer: "",
  website: "",
  dashboardUrl: "",
  poweredBy: "Powered by Yuvi",
  branding: "Made by Yuvi"
};

const DEFAULT_OWNER_PROFILE = {
  name: "Yuvi",
  age: 14,
  role: "Server Owner & Bot Developer",
  focus: "Discord server development & bot making",
  description: "Yuvi is a passionate Discord server developer and bot creator focused on professional community management.",
  socialLinks: {
    website: "",
    github: "",
    instagram: "",
    discord: "",
    x: ""
  }
};

const OWNER_INFO = `This bot was made by Yuvi. He is 14 years old and is a passionate Discord bot developer and server developer. His Discord username is yuvi03094. He creates professional, smooth, and useful bots for communities and server management.`;

function getOwnerInfoText(profile = DEFAULT_OWNER_PROFILE) {
  const owner = { ...DEFAULT_OWNER_PROFILE, ...(profile || {}) };
  const social = owner.socialLinks || {};
  const socials = [
    social.website ? `Website: ${social.website}` : null,
    social.github ? `GitHub: ${social.github}` : null,
    social.instagram ? `Instagram: ${social.instagram}` : null,
    social.discord ? `Discord: ${social.discord}` : null,
    social.x ? `X: ${social.x}` : null
  ].filter(Boolean).join(" | ");

  return [
    `${owner.name} is the owner and bot developer of this bot.`,
    `${owner.name} ki age ${owner.age} hai.`,
    `${owner.name} mainly ${owner.focus} par focus karta hai.`,
    `Role: ${owner.role}.`,
    owner.description ? `${owner.description}` : "",
    socials ? `Social links: ${socials}` : ""
  ].filter(Boolean).join(" ");
}

function getNitroEmoji() {
  if (!NITRO_EMOJI_ID) {
    return "✨";
  }

  return `<:${NITRO_EMOJI_NAME}:${NITRO_EMOJI_ID}>`;
}

function isOwnerQuery(content) {
  if (!content) return false;

  const text = content.toLowerCase();
  const triggers = [
    "who is the owner",
    "who is owner",
    "who made you",
    "who created you",
    "who is your owner",
    "who is your developer",
    "who owns you",
    "your owner",
    "who is yuvi",
    "who is the developer",
    "bot kisne banaya",
    "bot ka malik kon",
    "owner info",
    "owner kon hai",
    "yuvi kaun hai",
    "who owns this bot"
  ];

  return triggers.some(trigger => text.includes(trigger));
}

async function ensureGuildConfig(guildId) {
  if (!guildId) return null;

  const existing = await GuildConfig.findOne({ guildId });
  if (existing) {     existing.about = "Yuvi Bot — made for server protection, anti-nuke, anti-spam, moderation, security, logging and server management.";     existing.statusText = "Managing Server";     existing.activityType = "Playing";     existing.rotationEnabled = false;     existing.rotatingStatuses = ["Managing Server"];     await existing.save();     return existing;   }

  const created = await GuildConfig.create({ guildId });
  return created;
}

async function getBotProfile() {
  const existing = await BotProfile.findOne({ profileId: "bot-profile" });
  if (existing) {     existing.about = "Yuvi Bot — made for server protection, anti-nuke, anti-spam, moderation, security, logging and server management.";     existing.statusText = "Managing Server";     existing.activityType = "Playing";     existing.rotationEnabled = false;     existing.rotatingStatuses = ["Managing Server"];     await existing.save();     return existing;   }

  const created = await BotProfile.create({
    profileId: "bot-profile",
    ...DEFAULT_BOT_PROFILE
  });
  return created;
}

function toActivityType(value) {
  const map = {
    Playing: ActivityType.Playing,
    Watching: ActivityType.Watching,
    Listening: ActivityType.Listening,
    Competing: ActivityType.Competing
  };
  return map[value] ?? ActivityType.Playing;
}

async function syncBotIdentity(profile) {
  if (!client.user || !profile) return;

  try {
    if (profile.botName && profile.botName.trim() && profile.botName.trim() !== client.user.username) {
      await client.user.setUsername(profile.botName.trim());
    }
  } catch (error) {
    console.warn("Bot username update skipped:", error.message || error);
  }

  try {
    if (profile.avatarUrl && profile.avatarUrl.startsWith("data:")) {
      await client.user.setAvatar(profile.avatarUrl);
    }
  } catch (error) {
    console.warn("Bot avatar update skipped:", error.message || error);
  }

  try {
    if (profile.bannerUrl && profile.bannerUrl.startsWith("data:") && typeof client.user.setBanner === "function") {
      await client.user.setBanner(profile.bannerUrl);
    }
  } catch (error) {
    console.warn("Bot banner update skipped:", error.message || error);
  }
}

async function applyBotPresence() {
  const profile = await getBotProfile();
  await syncBotIdentity(profile);

  const statuses = Array.isArray(profile.rotatingStatuses) && profile.rotatingStatuses.length
    ? profile.rotatingStatuses
    : [profile.statusText || DEFAULT_BOT_PROFILE.statusText];

  const currentText = profile.rotationEnabled ? statuses[0] : profile.statusText || DEFAULT_BOT_PROFILE.statusText;
  const finalText = currentText || DEFAULT_BOT_PROFILE.statusText;

  if (client.user) {
    client.user.setPresence({
      activities: [{
        name: finalText,
        type: toActivityType(profile.activityType || DEFAULT_BOT_PROFILE.activityType)
      }],
      status: profile.status || DEFAULT_BOT_PROFILE.status
    });
  }

  return profile;
}

let statusRotationIndex = 0;
let statusRotationTimer = null;

async function rotateBotPresence() {
  const profile = await getBotProfile();
  if (!profile.rotationEnabled || !Array.isArray(profile.rotatingStatuses) || profile.rotatingStatuses.length === 0) {
    return;
  }

  const statuses = profile.rotatingStatuses;
  const current = statuses[statusRotationIndex % statuses.length];
  statusRotationIndex += 1;

  if (client.user) {
    client.user.setPresence({
      activities: [{
        name: current,
        type: toActivityType(profile.activityType || DEFAULT_BOT_PROFILE.activityType)
      }],
      status: profile.status || DEFAULT_BOT_PROFILE.status
    });
  }
}

function startStatusRotation(profile = null) {
  if (statusRotationTimer) clearInterval(statusRotationTimer);

  const selectedProfile = profile || DEFAULT_BOT_PROFILE;
  const interval = Number(selectedProfile.rotationIntervalMs || process.env.STATUS_ROTATION_INTERVAL_MS || 20000);

  statusRotationTimer = setInterval(async () => {
    try {
      await rotateBotPresence();
    } catch (error) {
      console.error("Status rotation error:", error);
    }
  }, interval);
}

function normalizeMessageText(text) {
  return (text || "")
    .toLowerCase()
    .replace(/<@!?(\d+)>/g, " ")
    .replace(/[^a-z0-9\s?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getLevelFromMessages(messages = 0) {
  const total = Number(messages) || 0;
  return Math.max(1, Math.floor(Math.sqrt(total / 10)) + 1);
}

async function getWarningCount(guildId, userId) {
  if (!guildId || !userId) return 0;
  return Warning.countDocuments({ guildId, userId });
}

async function buildNaturalReply(message, guildConfig) {
  if (!message || !message.guild || !message.content) return null;

  const text = normalizeMessageText(message.content);
  const profile = guildConfig?.ownerProfile || DEFAULT_OWNER_PROFILE;
  const guildName = message.guild.name || "this server";
  const memberCount = message.guild.memberCount || 0;
  const channelCount = message.guild.channels.cache.size || 0;
  const roleCount = message.guild.roles.cache.size || 0;
  const botPing = client.ws?.ping || 0;
  const totalUsers = await UserStats.countDocuments({ guildId: message.guild.id });
  const stats = await UserStats.findOne({ guildId: message.guild.id, userId: message.author.id });
  const warningCount = await getWarningCount(message.guild.id, message.author.id);
  const level = getLevelFromMessages(stats?.messages || 0);
  const xp = stats?.messages || 0;

  const lower = text;

  if (/owner|malik|developer|bot kisne banaya|yuvi kaun|who owns this bot|who made you|who created you/.test(lower)) {
    return getOwnerInfoText(profile);
  }

  if (/(member count|members|kitne members|kitna members|server info|server ke kitne members|how many members)/.test(lower)) {
    return `Server: ${guildName} | Members: ${memberCount.toLocaleString()} | Channels: ${channelCount} | Roles: ${roleCount}`;
  }

  if (/(bot ka ping|ping kya hai|ping|latency)/.test(lower)) {
    return `Bot ka ping ${botPing}ms hai.`;
  }

  if (/(rules|rule|rules kaha hain|rules kahan hain|server rules)/.test(lower)) {
    const rulesChannel = message.guild.channels.cache.find(ch => /rules|rule/i.test(ch.name));
    return rulesChannel ? `Rules channel: ${rulesChannel}` : "Rules channel ko find nahi kiya gaya. Admin se check karna.";
  }

  if (/(ticket|ticket kaise banau|support ticket)/.test(lower)) {
    return "Ticket create karne ke liye /ticket use karo ya support channel me request bhejo. Admins ticket approve karte hain.";
  }

  if (/(giveaway|giveaway kab end|giveaway status)/.test(lower)) {
    return "Active giveaways ko dashboard ya giveaway commands ke through manage kiya jata hai. /giveaway ka use karo.";
  }

  if (/(level|xp|mera level|my level|level kya hai)/.test(lower)) {
    return `Aapka current level ${level} hai aur XP ${xp} hai.`;
  }

  if (/(warning|warnings|warn|kitni warnings|meri warnings)/.test(lower)) {
    if (message.member && !message.member.permissions.has("ViewAuditLog")) {
      return `Aapke ${warningCount} warnings hain.`;
    }
    return `Aapke ${warningCount} warnings hain.`;
  }

  if (/(help|available commands|commands batao|command list)/.test(lower)) {
    return "Main commands: /help, /stats, /ticket, /giveaway, /warn, /ban, /kick, /timeout. Normal message AI also owner, server info, ping, levels, warnings, tickets, and giveaway info support karta hai.";
  }

  if (/(bot banaya|kisne banaya|created you|who built you)/.test(lower)) {
    return `${profile.name} ne ye bot develop kiya hai.`;
  }

  if (/(server ke owner|server owner|server ka owner)/.test(lower)) {
    return `${profile.name} is the owner and bot developer for this server setup.`;
  }

  const customFaq = guildConfig?.aiChat?.customFaq || [];
  for (const faq of customFaq) {
    const [trigger, answer] = String(faq).split("->").map(part => part.trim());
    if (trigger && answer && lower.includes(normalizeMessageText(trigger))) {
      return answer;
    }
  }

  if (/(bot ka naam|bot kya hai|what is this bot|bot info|about this bot)/.test(lower)) {
    return `${client.user?.username || "Yuvi Bot"} ek Discord community bot hai jo server management, stats, tickets, giveaways aur AI info responses provide karta hai.`;
  }

  if (totalUsers === 0) {
    return null;
  }

  return null;
}

async function shouldRespondToNaturalMessage(message) {
  if (!message || !message.guild || message.author.bot || !message.content) return false;

  const text = normalizeMessageText(message.content);
  if (!text || text.length < 3) return false;

  const guildConfig = await ensureGuildConfig(message.guild.id);
  if (!guildConfig || guildConfig.aiChat?.enabled === false || guildConfig.aiChat?.normalMessageResponses === false) {
    return false;
  }

  const channelId = message.channel?.id;
  const allowedChannels = guildConfig.aiChat?.allowedChannels || [];
  const ignoredChannels = guildConfig.aiChat?.ignoredChannels || [];
  const ignoredRoles = guildConfig.aiChat?.ignoredRoles || [];

  if (ignoredChannels.includes(channelId)) return false;
  if (message.member && message.member.roles.cache.some(role => ignoredRoles.includes(role.id))) return false;
  if (allowedChannels.length && !allowedChannels.includes(channelId)) return false;

  const mentionOnly = Boolean(guildConfig.aiChat?.mentionOnlyMode);
  const hasMention = message.mentions.has(client.user);
  if (mentionOnly && !hasMention) return false;

  const matchedTrigger = (guildConfig.aiChat?.keywordTriggers || []).some(trigger => {
    return text.includes(normalizeMessageText(trigger));
  });

  const questionLike = /who|what|when|where|why|how|which|can|kya|kaun|kitne|kitna|batao|hai|h|info|help|ping|server|level|warning|ticket|giveaway|rules/.test(text);
  const hasSafeIntent = matchedTrigger || questionLike || hasMention;
  if (!hasSafeIntent) return false;

  const cooldownMs = Number(guildConfig.aiChat?.responseCooldown || 20) * 1000;
  const key = `${message.guild.id}:${message.author.id}`;
  const lastReply = lastAiReply.get(key) || 0;
  if (Date.now() - lastReply < cooldownMs) return false;

  return true;
}

// =========================
// MONGODB SCHEMA
// =========================

const userStatsSchema = new mongoose.Schema({
  userId: String,
  guildId: String,

  messages: {
    type: Number,
    default: 0
  },

  voiceTime: {
    type: Number,
    default: 0
  },

  warnings: {
    type: Number,
    default: 0
  },

  lastVoiceJoin: {
    type: Date,
    default: null
  }
});

const UserStats = mongoose.model("UserStats", userStatsSchema);

const memberAccessSchema = new mongoose.Schema({
  userId: String,
  guildId: String,
  isBlocked: {
    type: Boolean,
    default: false
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const MemberAccess = mongoose.model("MemberAccess", memberAccessSchema);

const logEntrySchema = new mongoose.Schema({
  guildId: String,
  userId: String,
  type: String,
  message: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const BotLog = mongoose.model("BotLog", logEntrySchema);

mongoose.set("strictQuery", true);

async function addLog(guildId, type, message, userId = null) {
  if (!guildId) return;

  try {
    await BotLog.create({
      guildId,
      userId,
      type,
      message
    });

    const logChannelId = process.env.LOG_CHANNEL_ID;
    if (!logChannelId || !client.isReady()) return;

    const channel = client.channels.cache.get(logChannelId) ||
      await client.channels.fetch(logChannelId).catch(() => null);

    if (channel && channel.isTextBased()) {
      await channel.send({
        content: `**[${type}]** ${message}`
      });
    }
  } catch (error) {
    console.error("Logging error:", error);
  }
}

// =========================
// MONGODB CONNECTION
// =========================

let mongoReconnectTimer = null;

async function connectMongo() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10,
      autoIndex: true
    });

    console.log("MongoDB connected successfully!");

    if (mongoReconnectTimer) {
      clearTimeout(mongoReconnectTimer);
      mongoReconnectTimer = null;
    }
  } catch (error) {
    console.error("MongoDB Error:", error.message);
    mongoReconnectTimer = setTimeout(connectMongo, 5000);
  }
}

writeBotStatus("offline", { reason: "starting" });
connectMongo();


// =========================
// BOT READY
// =========================

client.once(Events.ClientReady, async readyClient => {

  writeBotStatus("online", { username: readyClient.user.tag, ping: client.ws?.ping || 0 });

  console.log("=================================");
  console.log("Bot is online!");
  console.log("Logged in as: " + readyClient.user.tag);
  console.log("=================================");

  try {
    const profile = await getBotProfile();
    if (profile.rotationEnabled) {
      await rotateBotPresence();
      startStatusRotation(profile);
    } else {
      await applyBotPresence();
    }
  } catch (error) {
    console.error("Bot profile setup error:", error);
  }

});


// =========================
// MESSAGE TRACKING
// =========================

client.on(Events.MessageCreate, async message => {

  if (message.author.bot) return;

  if (message.guild) {
    const guildConfig = await ensureGuildConfig(message.guild.id);

    if (isOwnerQuery(message.content)) {
      await message.reply({
        content: getOwnerInfoText(guildConfig?.ownerProfile || DEFAULT_OWNER_PROFILE)
      });
      return;
    }

    if (await shouldRespondToNaturalMessage(message)) {
      const reply = await buildNaturalReply(message, guildConfig);
      if (reply) {
        lastAiReply.set(`${message.guild.id}:${message.author.id}`, Date.now());
        await message.reply({ content: reply });
        return;
      }
    }
  }

  if (!message.guild) return;

  try {
    const access = await MemberAccess.findOne({
      userId: message.author.id,
      guildId: message.guild.id
    });

    if (access && access.isBlocked) {
      return;
    }

    let stats = await UserStats.findOne({
      userId: message.author.id,
      guildId: message.guild.id
    });

    if (!stats) {
      stats = new UserStats({
        userId: message.author.id,
        guildId: message.guild.id
      });
    }

    stats.messages += 1;

    await stats.save();

  } catch (error) {

    console.error("Message tracking error:", error);

  }

});


// =========================
// VOICE TRACKING
// =========================

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {

  const member = newState.member || oldState.member;

  if (!member || member.user.bot) return;

  const userId = member.id;
  const guildId = member.guild.id;

  try {

    // Joined voice
    if (!oldState.channelId && newState.channelId) {

      await UserStats.findOneAndUpdate(
        {
          userId,
          guildId
        },
        {
          $set: {
            lastVoiceJoin: new Date()
          }
        },
        {
          upsert: true
        }
      );

    }

    // Left voice
    if (oldState.channelId && !newState.channelId) {

      const stats = await UserStats.findOne({
        userId,
        guildId
      });

      if (stats && stats.lastVoiceJoin) {

        const seconds = Math.floor(
          (Date.now() -
            new Date(stats.lastVoiceJoin).getTime()) / 1000
        );

        stats.voiceTime += seconds;
        stats.lastVoiceJoin = null;

        await stats.save();
      }

    }

    if (!oldState.channelId && newState.channelId) {
      await addLog(guildId, "voice", `${member.user.tag} joined a voice channel.`, member.id);
    }

    if (oldState.channelId && !newState.channelId) {
      await addLog(guildId, "voice", `${member.user.tag} left a voice channel.`, member.id);
    }

  } catch (error) {

    console.error("Voice tracking error:", error);

  }

});


// =========================
// SLASH COMMANDS
// =========================

const commands = [

  new SlashCommandBuilder()
    .setName("stats")
    .setDescription("View your or another user's statistics")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("Select a user")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("topmessages")
    .setDescription("View the message leaderboard"),

  new SlashCommandBuilder()
    .setName("topvoice")
    .setDescription("View the voice leaderboard"),

  new SlashCommandBuilder()
    .setName("coinflip")
    .setDescription("Flip a coin"),

  new SlashCommandBuilder()
    .setName("dice")
    .setDescription("Roll a dice"),

  new SlashCommandBuilder()
    .setName("rps")
    .setDescription("Play rock, paper, scissors")
    .addStringOption(option =>
      option
        .setName("choice")
        .setDescription("Choose rock, paper, or scissors")
        .setRequired(true)
        .addChoices(
          { name: "Rock", value: "rock" },
          { name: "Paper", value: "paper" },
          { name: "Scissors", value: "scissors" }
        )
    ),

  new SlashCommandBuilder()
    .setName("8ball")
    .setDescription("Ask the magic 8-ball a question")
    .addStringOption(option =>
      option
        .setName("question")
        .setDescription("Your question")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check bot latency"),

  new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("View server information"),

  new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("View user information")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("Select a user")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("View a user's avatar")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("Select a user")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("botinfo")
    .setDescription("View bot information"),

  new SlashCommandBuilder()
    .setName("help")
    .setDescription("View all available commands"),

  new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("Check warnings for a member")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("Member to check")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("lock")
    .setDescription("Lock a channel to stop messages")
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageChannels
    ),

  new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("Unlock a channel")
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageChannels
    ),

  new SlashCommandBuilder()
    .setName("slowmode")
    .setDescription("Set slowmode for this channel")
    .addIntegerOption(option =>
      option
        .setName("seconds")
        .setDescription("Seconds for slowmode")
        .setMinValue(0)
        .setMaxValue(21600)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageChannels
    ),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn a member")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("Member to warn")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("reason")
        .setDescription("Reason for warning")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ModerateMembers
    ),

  new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Delete messages")
    .addIntegerOption(option =>
      option
        .setName("amount")
        .setDescription("Number of messages")
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageMessages
    ),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a member")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("Member to kick")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("reason")
        .setDescription("Reason")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.KickMembers
    ),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a member")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("Member to ban")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("reason")
        .setDescription("Reason")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.BanMembers
    ),

  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Timeout a member")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("Member to timeout")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName("minutes")
        .setDescription("Timeout duration in minutes")
        .setMinValue(1)
        .setMaxValue(40320)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ModerateMembers
    )

].map(command => command.toJSON());


// =========================
// REGISTER COMMANDS
// =========================

let commandsRegistered = false;

async function registerCommands() {
  if (commandsRegistered) return;

  const rest = new REST({
    version: "10"
  }).setToken(process.env.TOKEN);

  try {
    console.log("Registering slash commands...");

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      {
        body: commands
      }
    );

    commandsRegistered = true;
    console.log("Slash commands registered!");
  } catch (error) {
    console.error("Command registration error:", error);
  }
}


// =========================
// INTERACTIONS
// =========================

client.on(Events.InteractionCreate, async interaction => {

  if (!interaction.isChatInputCommand()) return;

  try {
    if (interaction.guild) {
      const access = await MemberAccess.findOne({
        userId: interaction.user.id,
        guildId: interaction.guild.id
      });

      if (access && access.isBlocked) {
        return interaction.reply({
          content: "Your access to the bot has been disabled by the server admin.",
          ephemeral: true
        });
      }
    }

    // =====================
    // PING
    // =====================

    if (interaction.commandName === "coinflip") {
      const result = Math.random() < 0.5 ? "Heads" : "Tails";
      return interaction.reply({
        content: `${getNitroEmoji()} Coin flip: **${result}**`
      });
    }

    if (interaction.commandName === "dice") {
      const result = Math.floor(Math.random() * 6) + 1;
      return interaction.reply({
        content: `${getNitroEmoji()} Dice rolled: **${result}**`
      });
    }

    if (interaction.commandName === "rps") {
      const choices = ["rock", "paper", "scissors"];
      const userChoice = interaction.options.getString("choice").toLowerCase();
      const botChoice = choices[Math.floor(Math.random() * choices.length)];

      let outcome = "It’s a tie!";
      if (
        (userChoice === "rock" && botChoice === "scissors") ||
        (userChoice === "paper" && botChoice === "rock") ||
        (userChoice === "scissors" && botChoice === "paper")
      ) {
        outcome = "You win!";
      } else if (
        (botChoice === "rock" && userChoice === "scissors") ||
        (botChoice === "paper" && userChoice === "rock") ||
        (botChoice === "scissors" && userChoice === "paper")
      ) {
        outcome = "Bot wins!";
      }

      return interaction.reply({
        content: `${getNitroEmoji()} You chose **${userChoice}** and the bot chose **${botChoice}** — **${outcome}**`
      });
    }

    if (interaction.commandName === "8ball") {
      const replies = [
        "Yes definitely.",
        "No way.",
        "Ask again later.",
        "It is certain.",
        "Signs point to yes.",
        "Most likely.",
        "Better not tell you now.",
        "Outlook is good."
      ];
      const answer = replies[Math.floor(Math.random() * replies.length)];
      return interaction.reply({
        content: `${getNitroEmoji()} Magic 8-ball: **${answer}**`
      });
    }

    if (interaction.commandName === "ping") {

      const latency =
        Date.now() - interaction.createdTimestamp;

      return interaction.reply({
        content: `${getNitroEmoji()} Pong! ${latency}ms`
      });

    }


    // =====================
    // STATS
    // =====================

    if (interaction.commandName === "stats") {

      const user =
        interaction.options.getUser("user") ||
        interaction.user;

      const stats = await UserStats.findOne({
        userId: user.id,
        guildId: interaction.guild.id
      });

      const messages = stats ? stats.messages : 0;
      const voiceSeconds = stats ? stats.voiceTime : 0;

      const hours = Math.floor(voiceSeconds / 3600);

      const minutes =
        Math.floor((voiceSeconds % 3600) / 60);

      const embed = new EmbedBuilder()
        .setTitle("USER STATISTICS")
        .setThumbnail(user.displayAvatarURL())
        .addFields(
          {
            name: "User",
            value: user.username,
            inline: true
          },
          {
            name: "Messages",
            value: messages.toString(),
            inline: true
          },
          {
            name: "Voice Time",
            value: `${hours}h ${minutes}m`,
            inline: true
          }
        )
        .setTimestamp();

      return interaction.reply({
        embeds: [embed]
      });

    }


    // =====================
    // TOP MESSAGES
    // =====================

    if (interaction.commandName === "topmessages") {

      const users = await UserStats.find({
        guildId: interaction.guild.id
      })
        .sort({
          messages: -1
        })
        .limit(10);

      if (!users.length) {
        return interaction.reply(
          "No message statistics available yet."
        );
      }

      let description = "";

      for (let i = 0; i < users.length; i++) {

        const member =
          await interaction.guild.members
            .fetch(users[i].userId)
            .catch(() => null);

        const name =
          member
            ? member.user.username
            : "Unknown User";

        description +=
          `**${i + 1}. ${name}** — ${users[i].messages} messages\n`;
      }

      const embed = new EmbedBuilder()
        .setTitle("TOP MESSAGE LEADERBOARD")
        .setDescription(description)
        .setTimestamp();

      return interaction.reply({
        embeds: [embed]
      });

    }


    // =====================
    // TOP VOICE
    // =====================

    if (interaction.commandName === "topvoice") {

      const users = await UserStats.find({
        guildId: interaction.guild.id
      })
        .sort({
          voiceTime: -1
        })
        .limit(10);

      if (!users.length) {
        return interaction.reply(
          "No voice statistics available yet."
        );
      }

      let description = "";

      for (let i = 0; i < users.length; i++) {

        const member =
          await interaction.guild.members
            .fetch(users[i].userId)
            .catch(() => null);

        const name =
          member
            ? member.user.username
            : "Unknown User";

        const seconds = users[i].voiceTime;

        const hours =
          Math.floor(seconds / 3600);

        const minutes =
          Math.floor((seconds % 3600) / 60);

        description +=
          `**${i + 1}. ${name}** — ${hours}h ${minutes}m\n`;
      }

      const embed = new EmbedBuilder()
        .setTitle("TOP VOICE LEADERBOARD")
        .setDescription(description)
        .setTimestamp();

      return interaction.reply({
        embeds: [embed]
      });

    }


    // =====================
    // SERVER INFO
    // =====================

    if (interaction.commandName === "serverinfo") {

      const guild = interaction.guild;

      const embed = new EmbedBuilder()
        .setTitle("SERVER INFORMATION")
        .addFields(
          {
            name: "Server",
            value: guild.name,
            inline: true
          },
          {
            name: "Members",
            value: guild.memberCount.toString(),
            inline: true
          },
          {
            name: "Channels",
            value: guild.channels.cache.size.toString(),
            inline: true
          },
          {
            name: "Roles",
            value: guild.roles.cache.size.toString(),
            inline: true
          },
          {
            name: "Server ID",
            value: guild.id,
            inline: true
          }
        )
        .setTimestamp();

      if (guild.iconURL()) {
        embed.setThumbnail(guild.iconURL());
      }

      return interaction.reply({
        embeds: [embed]
      });

    }


    // =====================
    // USER INFO
    // =====================

    if (interaction.commandName === "userinfo") {

      const user =
        interaction.options.getUser("user") ||
        interaction.user;

      const member =
        await interaction.guild.members
          .fetch(user.id)
          .catch(() => null);

      const embed = new EmbedBuilder()
        .setTitle("USER INFORMATION")
        .setThumbnail(user.displayAvatarURL())
        .addFields(
          {
            name: "Username",
            value: user.username,
            inline: true
          },
          {
            name: "User ID",
            value: user.id,
            inline: true
          },
          {
            name: "Joined Discord",
            value:
              `<t:${Math.floor(
                user.createdTimestamp / 1000
              )}:D>`,
            inline: false
          }
        )
        .setTimestamp();

      if (member && member.joinedTimestamp) {

        embed.addFields({
          name: "Joined Server",
          value:
            `<t:${Math.floor(
              member.joinedTimestamp / 1000
            )}:D>`,
          inline: false
        });

      }

      return interaction.reply({
        embeds: [embed]
      });

    }


    // =====================
    // AVATAR
    // =====================

    if (interaction.commandName === "avatar") {

      const user =
        interaction.options.getUser("user") ||
        interaction.user;

      const embed = new EmbedBuilder()
        .setTitle(`${user.username}'s Avatar`)
        .setImage(
          user.displayAvatarURL({
            size: 1024
          })
        );

      return interaction.reply({
        embeds: [embed]
      });

    }


    // =====================
    // BOT INFO
    // =====================

    if (interaction.commandName === "botinfo") {

      const embed = new EmbedBuilder()
        .setTitle("YUVISTATS")
        .setDescription(BOT_BIO)
        .addFields(
          {
            name: "Servers",
            value: client.guilds.cache.size.toString(),
            inline: true
          },
          {
            name: "Users",
            value:
              client.guilds.cache
                .reduce(
                  (total, guild) =>
                    total + guild.memberCount,
                  0
                )
                .toString(),
            inline: true
          },
          {
            name: "Commands",
            value: commands.length.toString(),
            inline: true
          }
        )
        .setTimestamp();

      return interaction.reply({
        embeds: [embed]
      });

    }


    // =====================
    // HELP
    // =====================

    if (interaction.commandName === "help") {

      const embed = new EmbedBuilder()
        .setTitle("YUVISTATS COMMANDS")
        .setDescription(
          [
            "`/stats` — View user statistics",
            "`/topmessages` — Message leaderboard",
            "`/topvoice` — Voice leaderboard",
            "`/coinflip` — Flip a coin",
            "`/dice` — Roll a dice",
            "`/rps` — Play rock-paper-scissors",
            "`/8ball` — Ask the magic 8-ball",
            "`/ping` — Check bot latency",
            "`/serverinfo` — Server information",
            "`/userinfo` — User information",
            "`/avatar` — View avatar",
            "`/botinfo` — Bot information",
            "`/warn` — Warn a member",
            "`/warnings` — Check member warnings",
            "`/clear` — Delete messages",
            "`/kick` — Kick a member",
            "`/ban` — Ban a member",
            "`/timeout` — Timeout a member",
            "`/lock` — Lock a channel",
            "`/unlock` — Unlock a channel",
            "`/slowmode` — Set slowmode",
            "`/help` — Show this menu"
          ].join("\n")
        )
        .setTimestamp();

      return interaction.reply({
        embeds: [embed]
      });

    }


    // =====================
    // WARNINGS
    // =====================

    if (interaction.commandName === "warnings") {
      const user = interaction.options.getUser("user") || interaction.user;
      const stats = await UserStats.findOne({
        userId: user.id,
        guildId: interaction.guild.id
      });

      const warnings = stats ? stats.warnings : 0;

      const embed = new EmbedBuilder()
        .setTitle("WARNING COUNT")
        .setDescription(`${user} has **${warnings}** warning(s).`)
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }


    // =====================
    // LOCK / UNLOCK / SLOWMODE
    // =====================

    if (interaction.commandName === "lock") {
      const channel = interaction.channel;
      if (!channel || !channel.isTextBased()) {
        return interaction.reply({ content: "This command can only be used in a text channel.", ephemeral: true });
      }

      await channel.permissionOverwrites.edit(interaction.guild.id, {
        SendMessages: false
      });

      return interaction.reply({ content: `🔒 Locked ${channel}.` });
    }

    if (interaction.commandName === "unlock") {
      const channel = interaction.channel;
      if (!channel || !channel.isTextBased()) {
        return interaction.reply({ content: "This command can only be used in a text channel.", ephemeral: true });
      }

      await channel.permissionOverwrites.edit(interaction.guild.id, {
        SendMessages: null
      });

      return interaction.reply({ content: `🔓 Unlocked ${channel}.` });
    }

    if (interaction.commandName === "slowmode") {
      const seconds = interaction.options.getInteger("seconds");
      const channel = interaction.channel;

      if (!channel || !channel.isTextBased()) {
        return interaction.reply({ content: "This command can only be used in a text channel.", ephemeral: true });
      }

      await channel.setRateLimitPerUser(seconds, "Slowmode updated by moderation command");
      return interaction.reply({ content: `⏱️ Slowmode set to ${seconds} seconds for ${channel}.` });
    }


    // =====================
    // WARN
    // =====================

    if (interaction.commandName === "warn") {

      const user =
        interaction.options.getUser("user");

      const reason =
        interaction.options.getString("reason");

      const stats =
        await UserStats.findOneAndUpdate(
          {
            userId: user.id,
            guildId: interaction.guild.id
          },
          {
            $inc: {
              warnings: 1
            }
          },
          {
            upsert: true,
            new: true
          }
        );

      await addLog(
        interaction.guild.id,
        "moderation",
        `${user.tag} was warned. Reason: ${reason}`,
        user.id
      );

      const embed = new EmbedBuilder()
        .setTitle("MEMBER WARNED")
        .setDescription(
          `${user} has been warned.`
        )
        .addFields(
          {
            name: "Reason",
            value: reason
          },
          {
            name: "Total Warnings",
            value: stats.warnings.toString()
          }
        )
        .setTimestamp();

      return interaction.reply({
        embeds: [embed]
      });

    }


    // =====================
    // CLEAR
    // =====================

    if (interaction.commandName === "clear") {

      const amount =
        interaction.options.getInteger("amount");

      const deleted =
        await interaction.channel.bulkDelete(
          amount,
          true
        );

      await addLog(
        interaction.guild.id,
        "moderation",
        `${interaction.user.tag} cleared ${deleted.size} messages in ${interaction.channel.name}.`,
        interaction.user.id
      );

      return interaction.reply({
        content:
          `Deleted ${deleted.size} messages.`,
        ephemeral: true
      });

    }


    // =====================
    // KICK
    // =====================

    if (interaction.commandName === "kick") {

      const user =
        interaction.options.getUser("user");

      const reason =
        interaction.options.getString("reason") ||
        "No reason provided";

      const member =
        await interaction.guild.members.fetch(user.id);

      await member.kick(reason);
      await addLog(
        interaction.guild.id,
        "moderation",
        `${user.tag} was kicked. Reason: ${reason}`,
        user.id
      );

      return interaction.reply({
        content:
          `${user.tag} has been kicked.`
      });

    }


    // =====================
    // BAN
    // =====================

    if (interaction.commandName === "ban") {

      const user =
        interaction.options.getUser("user");

      const reason =
        interaction.options.getString("reason") ||
        "No reason provided";

      await interaction.guild.members.ban(
        user.id,
        {
          reason
        }
      );
      await addLog(
        interaction.guild.id,
        "moderation",
        `${user.tag} was banned. Reason: ${reason}`,
        user.id
      );

      return interaction.reply({
        content:
          `${user.tag} has been banned.`
      });

    }


    // =====================
    // TIMEOUT
    // =====================

    if (interaction.commandName === "timeout") {

      const user =
        interaction.options.getUser("user");

      const minutes =
        interaction.options.getInteger("minutes");

      const member =
        await interaction.guild.members.fetch(user.id);

      await member.timeout(
        minutes * 60 * 1000,
        "Moderation timeout"
      );
      await addLog(
        interaction.guild.id,
        "moderation",
        `${user.tag} was timed out for ${minutes} minutes.`,
        user.id
      );

      return interaction.reply({
        content:
          `${user.tag} has been timed out for ${minutes} minutes.`
      });

    }

  } catch (error) {

    console.error("Command error:", error);

    if (interaction.replied || interaction.deferred) {

      await interaction.followUp({
        content:
          "An error occurred while executing this command.",
        ephemeral: true
      });

    } else {

      await interaction.reply({
        content:
          "An error occurred while executing this command.",
        ephemeral: true
      });

    }

  }

});


// =========================
// LOGIN
// =========================

client.on(Events.Error, error => {
  writeBotStatus("offline", { reason: "discord-error" });
  console.error("Discord client error:", error);
});

client.on("warn", info => {
  console.warn("Discord warning:", info);
});

process.on("unhandledRejection", error => {
  console.error("Unhandled promise rejection:", error);
});

process.on("uncaughtException", error => {
  console.error("Uncaught exception:", error);
});

async function gracefulShutdown(signal) {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  writeBotStatus("offline", { reason: signal });

  try {
    await client.destroy();
  } catch (error) {
    console.error("Client destroy error:", error);
  }

  try {
    await mongoose.disconnect();
  } catch (error) {
    console.error("MongoDB disconnect error:", error);
  }

  process.exit(0);
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

client.login(process.env.TOKEN)
  .then(() => {
    console.log("Discord login successful.");
  })
  .catch(error => {
    console.error("Discord login failed:", error);
    writeBotStatus("offline", { reason: "login-failed" });
  });

setInterval(() => {
  writeBotStatus(client.isReady() ? "online" : "offline", {
    ping: client.ws?.ping || 0,
    reason: client.isReady() ? undefined : "not-ready"
  });
}, 10000);


// =========================
// REGISTER COMMANDS
// =========================

client.once(Events.ClientReady, async () => {
  await registerCommands();
});

const PORT = Number(process.env.PORT || 10000);
const lastAiReply = new Map();

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || "yuvi-bot-session-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: false
  }
}));

app.use("/api", rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." }
}));

app.use(express.static(path.join(__dirname, "public")));

function requireDashboardAuth(req, res, next) {
  if (!req.session || !req.session.dashboardUser) {
    return res.status(401).json({ error: "Authentication required." });
  }
  next();
}

async function canManageGuild(userId, guildId) {
  if (!guildId) return false;
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return false;

  try {
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return false;
    return member.permissions.has(PermissionFlagsBits.ManageGuild) ||
      member.permissions.has(PermissionFlagsBits.Administrator);
  } catch (error) {
    console.error("Guild permission check error:", error);
    return false;
  }
}

app.get("/", (req, res) => {
  res.redirect("/dashboard");
});

app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/dashboard/login", async (req, res) => {
  const demoMode = req.query.demo === "1";

  if (demoMode) {
    req.session.dashboardUser = {
      id: "demo-admin",
      username: "Demo Admin",
      avatar: null,
      isDemo: true
    };
    return res.redirect("/dashboard");
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.DISCORD_REDIRECT_URI || `http://localhost:${PORT}/dashboard/callback`;

  if (!clientId || !clientSecret) {
    req.session.dashboardUser = {
      id: "demo-admin",
      username: "Demo Admin",
      avatar: null,
      isDemo: true
    };
    return res.redirect("/dashboard");
  }

  const authUrl = new URL("https://discord.com/api/oauth2/authorize");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "identify guilds");
  res.redirect(authUrl.toString());
});

app.get("/dashboard/callback", async (req, res) => {
  const code = req.query.code;
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.DISCORD_REDIRECT_URI || `http://localhost:${PORT}/dashboard/callback`;

  if (!code || !clientId || !clientSecret) {
    return res.status(400).send("Discord OAuth setup is not configured for this server.");
  }

  try {
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri
      })
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return res.status(400).send("OAuth token exchange failed.");
    }

    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    const userData = await userRes.json();
    const guildsRes = await fetch("https://discord.com/api/users/@me/guilds", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    const guildsData = await guildsRes.json();

    req.session.dashboardUser = {
      id: userData.id,
      username: userData.username,
      avatar: userData.avatar ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png` : null,
      guilds: Array.isArray(guildsData) ? guildsData : [],
      isDemo: false
    };

    res.redirect("/dashboard");
  } catch (error) {
    console.error("Dashboard OAuth error:", error);
    res.status(500).send("Failed to complete Discord login.");
  }
});

app.post("/dashboard/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/dashboard");
  });
});

app.get("/api/dashboard/session", (req, res) => {
  if (!req.session || !req.session.dashboardUser) {
    return res.json({ authenticated: false, user: null });
  }

  return res.json({
    authenticated: true,
    user: req.session.dashboardUser
  });
});

app.get("/api/dashboard/guilds", requireDashboardAuth, async (req, res) => {
  try {
    const userGuilds = req.session.dashboardUser.guilds || [];
    const available = [];

    for (const guild of client.guilds.cache.values()) {
      const member = await guild.members.fetch(req.session.dashboardUser.id).catch(() => null);
      if (!member) continue;

      const permissions = member.permissions || new PermissionsBitField(0);
      const canManage = permissions.has(PermissionFlagsBits.ManageGuild) || permissions.has(PermissionFlagsBits.Administrator);
      if (!canManage) continue;

      available.push({
        id: guild.id,
        name: guild.name,
        icon: guild.iconURL({ dynamic: true, size: 128 }) || null,
        memberCount: guild.memberCount,
        permissions: permissions.toArray()
      });
    }

    res.json({
      userGuilds: userGuilds.map(guild => ({
        id: guild.id,
        name: guild.name,
        icon: guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png` : null,
        permissions: guild.permissions
      })),
      managedGuilds: available
    });
  } catch (error) {
    console.error("Guild fetch error:", error);
    res.status(500).json({ error: "Failed to load guilds." });
  }
});

app.get("/api/dashboard/overview/:guildId", requireDashboardAuth, async (req, res) => {
  try {
    const guildId = req.params.guildId;
    const allowed = await canManageGuild(req.session.dashboardUser.id, guildId);
    if (!allowed) return res.status(403).json({ error: "Permission denied." });

    const guild = client.guilds.cache.get(guildId);
    if (!guild) return res.status(404).json({ error: "Guild not found." });

    const config = await ensureGuildConfig(guildId);
    const warnings = await Warning.countDocuments({ guildId });
    const logs = await BotLog.find({ guildId }).sort({ createdAt: -1 }).limit(10).lean();
    const totalMessages = await UserStats.aggregate([{ $match: { guildId } }, { $group: { _id: null, total: { $sum: "$messages" } } }]);
    const totalVoice = await UserStats.aggregate([{ $match: { guildId } }, { $group: { _id: null, total: { $sum: "$voiceTime" } } }]);
    const memberCount = guild.memberCount || 0;

    res.json({
      guild: {
        id: guild.id,
        name: guild.name,
        icon: guild.iconURL({ dynamic: true, size: 128 }) || null,
        memberCount,
        botPing: client.ws?.ping || 0,
        databaseStatus: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
        uptime: process.uptime(),
        status: client.isReady() ? "Online" : "Offline"
      },
      config,
      stats: {
        warnings,
        totalMessages: totalMessages[0]?.total || 0,
        totalVoice: totalVoice[0]?.total || 0,
        activeTickets: 0,
        activeGiveaways: 0,
        levelData: {
          averageLevel: 1,
          totalXp: totalMessages[0]?.total || 0
        }
      },
      recentActivity: logs.map(log => ({
        type: log.type,
        message: log.message,
        createdAt: new Date(log.createdAt).toISOString()
      }))
    });
  } catch (error) {
    console.error("Dashboard overview error:", error);
    res.status(500).json({ error: "Failed to load dashboard overview." });
  }
});

app.get("/api/dashboard/config/:guildId", requireDashboardAuth, async (req, res) => {
  try {
    const guildId = req.params.guildId;
    const allowed = await canManageGuild(req.session.dashboardUser.id, guildId);
    if (!allowed) return res.status(403).json({ error: "Permission denied." });

    const config = await ensureGuildConfig(guildId);
    res.json(config);
  } catch (error) {
    console.error("Dashboard config error:", error);
    res.status(500).json({ error: "Failed to load config." });
  }
});

app.post("/api/dashboard/config/:guildId", requireDashboardAuth, async (req, res) => {
  try {
    const guildId = req.params.guildId;
    const allowed = await canManageGuild(req.session.dashboardUser.id, guildId);
    if (!allowed) return res.status(403).json({ error: "Permission denied." });

    const config = await ensureGuildConfig(guildId);
    const payload = req.body || {};

    config.prefix = payload.prefix || config.prefix || "/";
    config.language = payload.language || config.language || "en";
    config.timezone = payload.timezone || config.timezone || "UTC";
    config.modules = { ...config.modules, ...(payload.modules || {}) };
    config.aiChat = { ...config.aiChat, ...(payload.aiChat || {}) };
    config.ownerProfile = { ...config.ownerProfile, ...(payload.ownerProfile || {}) };
    config.ownerProfile.socialLinks = { ...(config.ownerProfile?.socialLinks || {}), ...(payload.ownerProfile?.socialLinks || {}) };

    await config.save();
    res.json({ success: true, config });
  } catch (error) {
    console.error("Dashboard save config error:", error);
    res.status(500).json({ error: "Failed to save config." });
  }
});

app.get("/api/dashboard/bot-profile/:guildId", requireDashboardAuth, async (req, res) => {
  try {
    const guildId = req.params.guildId;
    const allowed = await canManageGuild(req.session.dashboardUser.id, guildId);
    if (!allowed) return res.status(403).json({ error: "Permission denied." });

    const profile = await getBotProfile();
    res.json(profile);
  } catch (error) {
    console.error("Dashboard bot profile get error:", error);
    res.status(500).json({ error: "Failed to load bot profile." });
  }
});

app.post("/api/dashboard/bot-profile/:guildId", requireDashboardAuth, async (req, res) => {
  try {
    const guildId = req.params.guildId;
    const allowed = await canManageGuild(req.session.dashboardUser.id, guildId);
    if (!allowed) return res.status(403).json({ error: "Permission denied." });

    const profile = await getBotProfile();
    const payload = req.body || {};

    Object.assign(profile, {
      botName: payload.botName || profile.botName || DEFAULT_BOT_PROFILE.botName,
      avatarUrl: payload.avatarUrl || profile.avatarUrl || DEFAULT_BOT_PROFILE.avatarUrl,
      bannerUrl: payload.bannerUrl || profile.bannerUrl || DEFAULT_BOT_PROFILE.bannerUrl,
      about: payload.about || profile.about || DEFAULT_BOT_PROFILE.about,
      statusText: payload.statusText || profile.statusText || DEFAULT_BOT_PROFILE.statusText,
      activityType: payload.activityType || profile.activityType || DEFAULT_BOT_PROFILE.activityType,
      status: payload.status || profile.status || DEFAULT_BOT_PROFILE.status,
      rotationEnabled: typeof payload.rotationEnabled === "boolean" ? payload.rotationEnabled : profile.rotationEnabled,
      rotationIntervalMs: Number(payload.rotationIntervalMs || profile.rotationIntervalMs || DEFAULT_BOT_PROFILE.rotationIntervalMs),
      rotatingStatuses: Array.isArray(payload.rotatingStatuses) && payload.rotatingStatuses.length
        ? payload.rotatingStatuses
        : (Array.isArray(profile.rotatingStatuses) && profile.rotatingStatuses.length ? profile.rotatingStatuses : DEFAULT_BOT_PROFILE.rotatingStatuses),
      supportServer: payload.supportServer || profile.supportServer || DEFAULT_BOT_PROFILE.supportServer,
      website: payload.website || profile.website || DEFAULT_BOT_PROFILE.website,
      dashboardUrl: payload.dashboardUrl || profile.dashboardUrl || DEFAULT_BOT_PROFILE.dashboardUrl,
      poweredBy: payload.poweredBy || profile.poweredBy || DEFAULT_BOT_PROFILE.poweredBy,
      branding: payload.branding || profile.branding || DEFAULT_BOT_PROFILE.branding
    });

    await profile.save();
    await syncBotIdentity(profile);
    if (profile.rotationEnabled) {
      statusRotationIndex = 0;
      startStatusRotation(profile);
    } else {
      if (statusRotationTimer) clearInterval(statusRotationTimer);
      await applyBotPresence();
    }

    res.json({ success: true, profile });
  } catch (error) {
    console.error("Dashboard bot profile save error:", error);
    res.status(500).json({ error: "Failed to save bot profile." });
  }
});

app.post("/api/dashboard/test-ai/:guildId", requireDashboardAuth, async (req, res) => {
  try {
    const guildId = req.params.guildId;
    const allowed = await canManageGuild(req.session.dashboardUser.id, guildId);
    if (!allowed) return res.status(403).json({ error: "Permission denied." });

    const config = await ensureGuildConfig(guildId);
    const text = String(req.body?.text || "owner kon hai?");
    const fakeMessage = {
      guild: { id: guildId, name: client.guilds.cache.get(guildId)?.name || "Server", memberCount: client.guilds.cache.get(guildId)?.memberCount || 0, channels: { cache: client.guilds.cache.get(guildId)?.channels.cache || new Map() }, roles: { cache: client.guilds.cache.get(guildId)?.roles.cache || new Map() } },
      content: text,
      author: { id: req.session.dashboardUser.id },
      channel: { id: client.guilds.cache.get(guildId)?.channels.cache.first()?.id || "0" },
      member: { permissions: { has: () => true }, roles: { cache: new Map() } },
      mentions: { has: () => false }
    };

    const reply = await buildNaturalReply(fakeMessage, config);
    res.json({ reply: reply || "No AI response triggered for this sample text." });
  } catch (error) {
    console.error("Dashboard AI test error:", error);
    res.status(500).json({ error: "Failed to test AI response." });
  }
});

app.get("/api/stats", async (req, res) => {
  try {
    const totalUsers = await UserStats.countDocuments();
    const totalMessages = await UserStats.aggregate([
      { $group: { _id: null, total: { $sum: "$messages" } } }
    ]);
    const totalVoice = await UserStats.aggregate([
      { $group: { _id: null, total: { $sum: "$voiceTime" } } }
    ]);
    const totalGuilds = await UserStats.distinct("guildId");

    const topUsers = await UserStats.find({})
      .sort({ messages: -1, voiceTime: -1 })
      .limit(8)
      .lean();

    const enrichedTopUsers = await Promise.all(
      topUsers.map(async user => {
        const member = Array.from(client.guilds.cache.values())
          .flatMap(guild => Array.from(guild.members.cache.values()))
          .find(m => m.id === user.userId);

        return {
          userId: user.userId,
          username: member ? member.user.username : "Unknown User",
          messages: user.messages || 0,
          voiceTime: user.voiceTime || 0
        };
      })
    );

    const stats = {
      totalUsers,
      totalMessages: totalMessages[0]?.total || 0,
      totalVoice: totalVoice[0]?.total || 0,
      totalGuilds: totalGuilds.length,
      botGuilds: client.guilds.cache.size,
      topUsers: enrichedTopUsers
    };

    res.json(stats);
  } catch (error) {
    console.error("Dashboard stats error:", error);
    res.status(500).json({ error: "Failed to fetch dashboard stats" });
  }
});

app.get("/api/members", async (req, res) => {
  try {
    const guild = client.guilds.cache.first();

    if (!guild) {
      return res.json([]);
    }

    const members = Array.from(guild.members.cache.values());

    const result = await Promise.all(
      members.map(async member => {
        const access = await MemberAccess.findOne({
          guildId: guild.id,
          userId: member.id
        });

        return {
          guildId: guild.id,
          userId: member.id,
          username: member.user.username,
          isBlocked: !!(access && access.isBlocked)
        };
      })
    );

    res.json(result.sort((a, b) => a.username.localeCompare(b.username)));
  } catch (error) {
    console.error("Member list error:", error);
    res.status(500).json({ error: "Failed to fetch member list" });
  }
});

app.get("/api/logs", async (req, res) => {
  try {
    const logs = await BotLog.find({})
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    res.json(logs.map(log => ({
      ...log,
      createdAt: new Date(log.createdAt).toISOString()
    })));
  } catch (error) {
    console.error("Logs fetch error:", error);
    res.status(500).json({ error: "Failed to fetch logs" });
  }
});

app.post("/api/member/toggle", express.json(), async (req, res) => {
  try {
    const { userId, guildId, isBlocked } = req.body;

    if (!userId || !guildId) {
      return res.status(400).json({ error: "userId and guildId are required" });
    }

    const updated = await MemberAccess.findOneAndUpdate(
      { userId, guildId },
      {
        userId,
        guildId,
        isBlocked: Boolean(isBlocked),
        updatedAt: new Date()
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      userId,
      isBlocked: updated.isBlocked
    });
  } catch (error) {
    console.error("Member toggle error:", error);
    res.status(500).json({ error: "Failed to update member access" });
  }
});

app.get("/health", async (req, res) => {
  const mongoState = mongoose.connection.readyState;

  const isHealthy = mongoState === 1 && client.isReady();

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? "ok" : "degraded",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    discord: client.isReady() ? "ready" : "connecting",
    mongo: mongoState === 1 ? "connected" : "disconnected"
  });
});

