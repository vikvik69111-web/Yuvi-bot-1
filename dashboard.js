require("dotenv").config();

const express = require("express");
const session = require("express-session");
const rateLimit = require("express-rate-limit");
const mongoose = require("mongoose");
const path = require("path");
const { PermissionFlagsBits } = require("discord.js");
const GuildConfig = require("./src/models/GuildConfig");
const BotProfile = require("./src/models/BotProfile");
const Warning = require("./src/models/Warning");
const { readBotStatus } = require("./src/bot-status");

const app = express();
const PORT = Number(process.env.DASHBOARD_PORT || process.env.PORT || 10000);
const PUBLIC_URL = process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
const DEFAULT_BOT_PROFILE = {
  botName: "Yuvi Bot",
  avatarUrl: "",
  bannerUrl: "",
  about: "A powerful all-in-one Discord bot made by Yuvi, built to help manage, protect and grow your server.",
  statusText: "Made by Yuvi • /help",
  activityType: "Playing",
  status: "online",
  rotationEnabled: true,
  rotationIntervalMs: 20000,
  rotatingStatuses: ["Made by Yuvi • /help"],
  supportServer: "",
  website: "",
  dashboardUrl: "",
  poweredBy: "Powered by Yuvi",
  branding: "Made by Yuvi"
};

const userStatsSchema = new mongoose.Schema({
  userId: String,
  guildId: String,
  messages: { type: Number, default: 0 },
  voiceTime: { type: Number, default: 0 },
  warnings: { type: Number, default: 0 },
  lastVoiceJoin: { type: Date, default: null }
});
const UserStats = mongoose.models.UserStats || mongoose.model("UserStats", userStatsSchema);

const memberAccessSchema = new mongoose.Schema({
  userId: String,
  guildId: String,
  isBlocked: { type: Boolean, default: false },
  updatedAt: { type: Date, default: Date.now }
});
const MemberAccess = mongoose.models.MemberAccess || mongoose.model("MemberAccess", memberAccessSchema);

const logEntrySchema = new mongoose.Schema({
  guildId: String,
  userId: String,
  type: String,
  message: String,
  createdAt: { type: Date, default: Date.now }
});
const BotLog = mongoose.models.BotLog || mongoose.model("BotLog", logEntrySchema);

function botStatus() {
  return readBotStatus();
}

function requireDatabase(res) {
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({ error: "Database is currently unavailable. Dashboard server is still running." });
    return false;
  }
  return true;
}

async function connectDatabase() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not configured. Dashboard will remain available, but database actions are disabled.");
    return;
  }

  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10,
      autoIndex: true
    });
    console.log("Dashboard MongoDB connected successfully.");
  } catch (error) {
    console.error("Dashboard MongoDB connection failed:", error.message || error);
  }
}

mongoose.connection.on("error", error => {
  console.error("Dashboard MongoDB error:", error.message || error);
});

async function ensureGuildConfig(guildId) {
  const existing = await GuildConfig.findOne({ guildId });
  return existing || GuildConfig.create({ guildId });
}

async function getBotProfile() {
  const existing = await BotProfile.findOne({ profileId: "bot-profile" });
  return existing || BotProfile.create({ profileId: "bot-profile", ...DEFAULT_BOT_PROFILE });
}

function getSessionGuild(user, guildId) {
  return (user?.guilds || []).find(guild => guild.id === guildId) || null;
}

function hasManagePermission(guild) {
  const permissions = BigInt(guild?.permissions || 0);
  return (permissions & BigInt(PermissionFlagsBits.ManageGuild)) !== 0n ||
    (permissions & BigInt(PermissionFlagsBits.Administrator)) !== 0n;
}

async function canManageGuild(req, guildId) {
  const user = req.session.dashboardUser;
  if (user?.isDemo) return true;
  return Boolean(getSessionGuild(user, guildId) && hasManagePermission(getSessionGuild(user, guildId)));
}

function getGuildInfo(req, guildId) {
  const sessionGuild = getSessionGuild(req.session.dashboardUser, guildId);
  return {
    id: guildId,
    name: sessionGuild?.name || "Discord server",
    icon: sessionGuild?.icon ? `https://cdn.discordapp.com/icons/${guildId}/${sessionGuild.icon}.png` : null,
    memberCount: 0
  };
}

function normalizeMessageText(text) {
  return String(text || "").toLowerCase().replace(/[^a-z0-9\s?]/g, " ").replace(/\s+/g, " ").trim();
}

function buildDashboardReply(text, config) {
  const normalized = normalizeMessageText(text);
  const owner = config.ownerProfile || {};
  if (/owner|malik|developer|yuvi kaun|who made you|who created you/.test(normalized)) {
    return `${owner.name || "Yuvi"} is the owner and bot developer of this bot. ${owner.description || ""}`.trim();
  }
  if (/help|madad/.test(normalized)) return "Ask about moderation, tickets, giveaways, leveling, or setup.";
  return "No AI response triggered for this sample text.";
}

app.set("trust proxy", 1);
app.use((req, res, next) => {
  const allowedOrigin = process.env.DASHBOARD_ORIGIN || PUBLIC_URL;
  if (req.headers.origin && req.headers.origin === allowedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || "yuvi-bot-session-secret",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" }
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
  if (!req.session?.dashboardUser) return res.status(401).json({ error: "Authentication required." });
  next();
}

function requireBotOnline(res) {
  if (!botStatus().isOnline) {
    res.status(503).json({ error: "Bot Offline. This Discord action will work when the bot is online." });
    return false;
  }
  return true;
}

app.get("/", (req, res) => res.redirect("/dashboard"));
app.get("/dashboard", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.get("/dashboard/login", (req, res) => {
  if (req.query.demo === "1") {
    req.session.dashboardUser = { id: "demo-admin", username: "Demo Admin", avatar: null, guilds: [], isDemo: true };
    return res.redirect("/dashboard");
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.DISCORD_REDIRECT_URI || `${PUBLIC_URL}/dashboard/callback`;
  if (!clientId || !clientSecret) {
    req.session.dashboardUser = { id: "demo-admin", username: "Demo Admin", avatar: null, guilds: [], isDemo: true };
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
  const { code } = req.query;
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.DISCORD_REDIRECT_URI || `${PUBLIC_URL}/dashboard/callback`;
  if (!code || !clientId || !clientSecret) return res.status(400).send("Discord OAuth setup is not configured for this server.");

  try {
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "authorization_code", code, redirect_uri: redirectUri })
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return res.status(400).send("OAuth token exchange failed.");

    const headers = { Authorization: `Bearer ${tokenData.access_token}` };
    const userData = await (await fetch("https://discord.com/api/users/@me", { headers })).json();
    const guildsData = await (await fetch("https://discord.com/api/users/@me/guilds", { headers })).json();
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

app.post("/dashboard/logout", (req, res) => req.session.destroy(() => res.redirect("/dashboard")));

app.get("/api/dashboard/session", (req, res) => {
  res.json({ authenticated: Boolean(req.session?.dashboardUser), user: req.session?.dashboardUser || null });
});

app.get("/api/dashboard/guilds", requireDashboardAuth, async (req, res) => {
  try {
    const user = req.session.dashboardUser;
    const managedGuilds = (user.guilds || [])
      .filter(guild => user.isDemo || hasManagePermission(guild))
      .map(guild => ({ id: guild.id, name: guild.name, icon: guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png` : null, memberCount: 0, permissions: guild.permissions }));

    if (user.isDemo && requireDatabase(res)) {
      const configuredGuildIds = await GuildConfig.distinct("guildId");
      configuredGuildIds.forEach(id => managedGuilds.push({ id, name: `Configured server ${id}`, icon: null, memberCount: 0, permissions: "8" }));
    }

    res.json({ userGuilds: user.guilds || [], managedGuilds });
  } catch (error) {
    console.error("Guild fetch error:", error);
    res.status(500).json({ error: "Failed to load guilds." });
  }
});

app.get("/api/dashboard/overview/:guildId", requireDashboardAuth, async (req, res) => {
  try {
    const { guildId } = req.params;
    if (!(await canManageGuild(req, guildId))) return res.status(403).json({ error: "Permission denied." });
    if (!requireDatabase(res)) return;

    const guild = getGuildInfo(req, guildId);
    const config = await ensureGuildConfig(guildId);
    const warnings = await Warning.countDocuments({ guildId });
    const logs = await BotLog.find({ guildId }).sort({ createdAt: -1 }).limit(10).lean();
    const totalMessages = await UserStats.aggregate([{ $match: { guildId } }, { $group: { _id: null, total: { $sum: "$messages" } } }]);
    const status = botStatus();
    res.json({
      guild: {
        ...guild,
        botPing: status.isOnline ? (status.ping || 0) : "Unavailable",
        databaseStatus: "Connected",
        uptime: process.uptime(),
        status: status.isOnline ? "Online" : "Bot Offline"
      },
      config,
      stats: { warnings, totalMessages: totalMessages[0]?.total || 0, totalVoice: 0, activeTickets: 0, activeGiveaways: 0, levelData: { averageLevel: 1, totalXp: totalMessages[0]?.total || 0 } },
      recentActivity: logs.map(log => ({ type: log.type, message: log.message, createdAt: new Date(log.createdAt).toISOString() }))
    });
  } catch (error) {
    console.error("Dashboard overview error:", error);
    res.status(500).json({ error: "Failed to load dashboard overview." });
  }
});

app.get("/api/dashboard/config/:guildId", requireDashboardAuth, async (req, res) => {
  try {
    if (!(await canManageGuild(req, req.params.guildId))) return res.status(403).json({ error: "Permission denied." });
    if (!requireDatabase(res)) return;
    res.json(await ensureGuildConfig(req.params.guildId));
  } catch (error) {
    console.error("Dashboard config error:", error);
    res.status(500).json({ error: "Failed to load config." });
  }
});

app.post("/api/dashboard/config/:guildId", requireDashboardAuth, async (req, res) => {
  try {
    if (!(await canManageGuild(req, req.params.guildId))) return res.status(403).json({ error: "Permission denied." });
    if (!requireDatabase(res)) return;
    const config = await ensureGuildConfig(req.params.guildId);
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
    if (!(await canManageGuild(req, req.params.guildId))) return res.status(403).json({ error: "Permission denied." });
    if (!requireDatabase(res)) return;
    res.json(await getBotProfile());
  } catch (error) {
    console.error("Dashboard bot profile error:", error);
    res.status(500).json({ error: "Failed to load bot profile." });
  }
});

app.post("/api/dashboard/bot-profile/:guildId", requireDashboardAuth, async (req, res) => {
  try {
    if (!(await canManageGuild(req, req.params.guildId))) return res.status(403).json({ error: "Permission denied." });
    if (!requireDatabase(res) || !requireBotOnline(res)) return;
    const profile = await getBotProfile();
    Object.assign(profile, req.body || {});
    await profile.save();
    res.json({ success: true, profile });
  } catch (error) {
    console.error("Dashboard bot profile save error:", error);
    res.status(500).json({ error: "Failed to save bot profile." });
  }
});

app.post("/api/dashboard/test-ai/:guildId", requireDashboardAuth, async (req, res) => {
  try {
    if (!(await canManageGuild(req, req.params.guildId))) return res.status(403).json({ error: "Permission denied." });
    if (!requireDatabase(res) || !requireBotOnline(res)) return;
    res.json({ reply: buildDashboardReply(req.body?.text || "owner kon hai?", await ensureGuildConfig(req.params.guildId)) });
  } catch (error) {
    console.error("Dashboard AI test error:", error);
    res.status(500).json({ error: "Failed to test AI response." });
  }
});

app.get("/api/stats", async (req, res) => {
  try {
    if (!requireDatabase(res)) return;
    const totalUsers = await UserStats.countDocuments();
    const totalMessages = await UserStats.aggregate([{ $group: { _id: null, total: { $sum: "$messages" } } }]);
    const totalGuilds = await UserStats.distinct("guildId");
    res.json({ totalUsers, totalMessages: totalMessages[0]?.total || 0, totalVoice: 0, totalGuilds: totalGuilds.length, botGuilds: 0, topUsers: [] });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    res.status(500).json({ error: "Failed to fetch dashboard stats" });
  }
});

app.get("/health", (req, res) => {
  const status = botStatus();
  const mongoConnected = mongoose.connection.readyState === 1;
  res.status(200).json({
    status: mongoConnected ? "ok" : "degraded",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    discord: status.isOnline ? "ready" : "offline",
    mongo: mongoConnected ? "connected" : "disconnected"
  });
});

connectDatabase();
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Dashboard server running independently on port ${PORT}.`);
});

process.on("SIGTERM", async () => {
  await mongoose.disconnect().catch(() => {});
  process.exit(0);
});
process.on("SIGINT", async () => {
  await mongoose.disconnect().catch(() => {});
  process.exit(0);
});
