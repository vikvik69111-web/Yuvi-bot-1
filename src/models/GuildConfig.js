const mongoose = require("mongoose");

const guildConfigSchema = new mongoose.Schema({
  guildId: {
    type: String,
    required: true,
    unique: true
  },
  prefix: {
    type: String,
    default: "/"
  },
  language: {
    type: String,
    default: "en"
  },
  timezone: {
    type: String,
    default: "UTC"
  },
  modules: {
    type: Object,
    default: {
      welcome: true,
      goodbye: true,
      automod: false,
      leveling: true,
      ticketing: true,
      suggestions: true,
      giveaways: true,
      reactionRoles: true,
      aiChat: true
    }
  },
  moderation: {
    type: Object,
    default: {
      logChannelId: null,
      warnLimit: 3,
      autoMute: false
    }
  },
  logging: {
    type: Object,
    default: {
      enabled: true,
      channelId: null,
      types: {}
    }
  },
  welcome: {
    type: Object,
    default: {
      enabled: false,
      channelId: null,
      message: "Welcome {user} to {server}!"
    }
  },
  goodbye: {
    type: Object,
    default: {
      enabled: false,
      channelId: null,
      message: "Goodbye {user}!"
    }
  },
  automod: {
    type: Object,
    default: {
      enabled: false,
      punishments: ["warn"],
      wordBlacklist: [],
      allowedRoles: [],
      allowedChannels: []
    }
  },
  leveling: {
    type: Object,
    default: {
      enabled: true,
      xpPerMessage: 15,
      cooldownMs: 60000,
      ignoredChannels: [],
      ignoredRoles: []
    }
  },
  aiChat: {
    type: Object,
    default: {
      enabled: true,
      normalMessageResponses: true,
      mentionOnlyMode: false,
      allowedChannels: [],
      ignoredChannels: [],
      ignoredRoles: [],
      responseCooldown: 20,
      customInstructions: "Be helpful, friendly, and concise. Answer owner, server, bot, and level questions in Hinglish/English.",
      customFaq: [
        "owner kon hai? -> Yuvi is the owner and bot developer.",
        "help chahiye -> Ask what you need help with: moderation, tickets, giveaways, leveling, or setup."
      ],
      keywordTriggers: ["owner", "server info", "ping", "level", "warning", "help", "ticket", "giveaway"],
      autoResponses: []
    }
  },
  ownerProfile: {
    type: Object,
    default: {
      name: "Yuvi",
      age: 14,
      role: "Server Owner & Bot Developer",
      focus: "Discord Server Development & Bot Making",
      description: "Custom editable description for the bot owner profile.",
      socialLinks: {
        website: "",
        github: "",
        instagram: "",
        discord: "",
        x: ""
      }
    }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("GuildConfig", guildConfigSchema);
