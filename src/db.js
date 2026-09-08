const mongoose = require("mongoose");

async function connectDatabase() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10,
      autoIndex: true
    });

    console.log("MongoDB connected successfully!");
    return true;
  } catch (error) {
    console.error("MongoDB Error:", error.message);
    return false;
  }
}

module.exports = {
  connectDatabase,
  mongoose
};
