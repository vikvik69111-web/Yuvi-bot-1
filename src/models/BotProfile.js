const mongoose = require("mongoose");

const botProfileSchema = new mongoose.Schema({
  profileId: { type: String, default: "bot-profile" },
  botName: { type: String, default: "Yuvi Bot" },
  avatarUrl: { type: String, default: "" },
  bannerUrl: { type: String, default: "" },
  about: { type: String, default: "Yuvi Bot — made for server protection, anti-nuke, anti-spam, moderation, security, logging and server management." },
  statusText: { type: String, default: "Managing Server" },
  activityType: { type: String, default: "Playing" },
  status: { type: String, default: "online" },
  rotationEnabled: { type: Boolean, default: false },
  rotationIntervalMs: { type: Number, default: 20000 },
  rotatingStatuses: { type: [String], default: ["Managing Server"] },
  supportServer: { type: String, default: "" },
  website: { type: String, default: "" },
  dashboardUrl: { type: String, default: "" },
  poweredBy: { type: String, default: "Powered by Yuvi" },
  branding: { type: String, default: "Made by Yuvi" }
}, { timestamps: true });

module.exports = mongoose.model("BotProfile", botProfileSchema);
