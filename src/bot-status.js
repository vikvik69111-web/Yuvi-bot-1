const fs = require("fs");
const path = require("path");

const STATUS_FILE = path.join(__dirname, "..", ".bot-status.json");
const HEARTBEAT_TIMEOUT_MS = Number(process.env.BOT_HEARTBEAT_TIMEOUT_MS || 30000);

function writeBotStatus(status, details = {}) {
  const payload = {
    status,
    updatedAt: new Date().toISOString(),
    pid: process.pid,
    ...details
  };

  try {
    fs.writeFileSync(STATUS_FILE, JSON.stringify(payload), "utf8");
  } catch (error) {
    console.error("Bot status write error:", error.message || error);
  }
}

function readBotStatus() {
  try {
    const payload = JSON.parse(fs.readFileSync(STATUS_FILE, "utf8"));
    const updatedAt = Date.parse(payload.updatedAt || "");
    const isFresh = Number.isFinite(updatedAt) && Date.now() - updatedAt < HEARTBEAT_TIMEOUT_MS;

    return {
      ...payload,
      status: isFresh && payload.status === "online" ? "online" : "offline",
      isOnline: isFresh && payload.status === "online"
    };
  } catch (error) {
    return {
      status: "offline",
      isOnline: false,
      updatedAt: null
    };
  }
}

module.exports = {
  writeBotStatus,
  readBotStatus
};
