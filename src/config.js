require("dotenv").config();

const missingEnv = ["TOKEN", "CLIENT_ID", "MONGO_URI"].filter(name => !process.env[name]);

if (missingEnv.length) {
  console.warn("Missing optional bot environment variables:", missingEnv.join(", "));
}

module.exports = {
  TOKEN: process.env.TOKEN,
  CLIENT_ID: process.env.CLIENT_ID,
  MONGO_URI: process.env.MONGO_URI,
  PORT: Number(process.env.PORT || 10000),
  NITRO_EMOJI_ID: process.env.NITRO_EMOJI_ID || "",
  NITRO_EMOJI_NAME: process.env.NITRO_EMOJI_NAME || "nitro",
  LOG_CHANNEL_ID: process.env.LOG_CHANNEL_ID || "",
  BOT_NAME: "Yuvi Bot",
  VERSION: "1.0.0"
};
