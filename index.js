require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  Events,
  SlashCommandBuilder,
  REST,
  Routes,
  EmbedBuilder,
  PermissionFlagsBits
} = require("discord.js");

const mongoose = require("mongoose");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

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

  xp: {
    type: Number,
    default: 0
  },

  level: {
    type: Number,
    default: 1
  },

  warnings: {
    type: Number,
    default: 0
  },

  lastVoiceJoin: {
    type: Date,
    default: null
  },

  lastXpMessage: {
    type: Date,
    default: null
  }
});

const UserStats = mongoose.model("UserStats", userStatsSchema);


// =========================
// MONGODB CONNECTION
// =========================

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected successfully!");
  })
  .catch(error => {
    console.error("MongoDB Error:", error.message);
  });


// =========================
// BOT READY
// =========================

client.once(Events.ClientReady, readyClient => {

  console.log("=================================");
  console.log("Bot is online!");
  console.log("Logged in as: " + readyClient.user.tag);
  console.log("=================================");

});


// =========================
// MESSAGE + XP TRACKING
// =========================

client.on(Events.MessageCreate, async message => {

  if (message.author.bot) return;
  if (!message.guild) return;

  try {

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

    // XP cooldown: 60 seconds
    const now = Date.now();

    if (
      !stats.lastXpMessage ||
      now - stats.lastXpMessage.getTime() >= 60000
    ) {

      const gainedXP =
        Math.floor(Math.random() * 11) + 15;

      stats.xp += gainedXP;
      stats.lastXpMessage = new Date();

      const requiredXP =
        100 + (stats.level * 50);

      if (stats.xp >= requiredXP) {

        stats.xp -= requiredXP;
        stats.level += 1;

        await stats.save();

        const embed = new EmbedBuilder()
          .setTitle("LEVEL UP")
          .setDescription(
            `${message.author} reached **Level ${stats.level}**!`
          )
          .setTimestamp();

        await message.channel.send({
          embeds: [embed]
        });

        return;
      }
    }

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
    .setName("leaderboard")
    .setDescription("View XP leaderboard"),

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

async function registerCommands() {

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

    // =====================
    // PING
    // =====================

    if (interaction.commandName === "ping") {

      const latency =
        Date.now() - interaction.createdTimestamp;

      return interaction.reply({
        content: `Pong! ${latency}ms`
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
      const xp = stats ? stats.xp : 0;
      const level = stats ? stats.level : 1;

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
            name: "Level",
            value: level.toString(),
            inline: true
          },
          {
            name: "XP",
            value: xp.toString(),
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
    // XP LEADERBOARD
    // =====================

    if (interaction.commandName === "leaderboard") {

      const users = await UserStats.find({
        guildId: interaction.guild.id
      })
        .sort({
          level: -1,
          xp: -1
        })
        .limit(10);

      if (!users.length) {
        return interaction.reply(
          "No XP statistics available yet."
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
          `**${i + 1}. ${name}** — Level ${users[i].level} (${users[i].xp} XP)\n`;
      }

      const embed = new EmbedBuilder()
        .setTitle("XP LEADERBOARD")
        .setDescription(description)
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
        .setDescription(
          "Discord statistics and server utility bot."
        )
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
            "`/leaderboard` — XP leaderboard",
            "`/topmessages` — Message leaderboard",
            "`/topvoice` — Voice leaderboard",
            "`/ping` — Check bot latency",
            "`/serverinfo` — Server information",
            "`/userinfo` — User information",
            "`/avatar` — View avatar",
            "`/botinfo` — Bot information",
            "`/warn` — Warn a member",
            "`/clear` — Delete messages",
            "`/kick` — Kick a member",
            "`/ban` — Ban a member",
            "`/timeout` — Timeout a member",
            "`/help` — Show this menu"
          ].join("\n")
        )
        .setTimestamp();

      return interaction.reply({
        embeds: [embed]
      });

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

client.login(process.env.TOKEN);


// =========================
// REGISTER COMMANDS
// =========================

registerCommands();
