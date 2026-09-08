const mongoose = require("mongoose");

const botProfileSchema = new mongoose.Schema({
  profileId: {
    type: String,
    default: "bot-profile"
  },
  botName: {
    type: String,
    default: "Yuvi Bot"
  },
  avatarUrl: {
    type: String,
    default: ""
  },
  bannerUrl: {
    type: String,
    default: ""
  },
  about: {
    type: String,
    default: "A powerful all-in-one Discord bot made by Yuvi, built to help manage, protect and grow your server. Includes moderation, AutoMod, logging, tickets, giveaways, reaction roles, leveling, welcome systems, custom commands and much more."
  },
  statusText: {
    type: String,
    default: "Made by Yuvi • /help"
  },
  activityType: {
    type: String,
    default: "Playing"
  },
  status: {
    type: String,
    default: "online"
  },
  rotationEnabled: {
    type: Boolean,
    default: true
  },
  rotationIntervalMs: {
    type: Number,
    default: 20000
  },
  rotatingStatuses: {
    type: [String],
    default: [
      "Made by Yuvi • /help",
      "Managing your server • Made by Yuvi",
      "Moderation • Tickets • Giveaways",
      "Helping your community • Made by Yuvi"
    ]
  },
  supportServer: {
    type: String,
    default: ""
  },
  website: {
    type: String,
    default: ""
  },
  dashboardUrl: {
    type: String,
    default: ""
  },
  poweredBy: {
    type: String,
    default: "Powered by Yuvi"
  },
  branding: {
    type: String,
    default: "Made by Yuvi"
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("BotProfile", botProfileSchema);
