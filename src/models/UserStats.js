const mongoose = require("mongoose");

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
}, {
  timestamps: true
});

module.exports = mongoose.model("UserStats", userStatsSchema);
