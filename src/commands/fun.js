const { EmbedBuilder } = require("discord.js");

function buildFunCommands() {
  return [
    {
      name: "coinflip",
      description: "Flip a coin",
      execute: async (interaction) => {
        const result = Math.random() < 0.5 ? "Heads" : "Tails";
        await interaction.reply({ content: `🪙 **${result}**` });
      }
    },
    {
      name: "dice",
      description: "Roll a dice",
      execute: async (interaction) => {
        const result = Math.floor(Math.random() * 6) + 1;
        await interaction.reply({ content: `🎲 **${result}**` });
      }
    },
    {
      name: "8ball",
      description: "Ask a question to the magic 8-ball",
      options: [
        {
          name: "question",
          type: 3,
          description: "Your question",
          required: true
        }
      ],
      execute: async (interaction) => {
        const answers = [
          "Yes definitely.",
          "No way.",
          "Ask again later.",
          "It is certain.",
          "Signs point to yes.",
          "Outlook is good.",
          "Better not tell you now.",
          "Most likely."
        ];
        const answer = answers[Math.floor(Math.random() * answers.length)];
        await interaction.reply({ content: `🔮 **${answer}**` });
      }
    },
    {
      name: "poll",
      description: "Create a simple poll",
      options: [
        {
          name: "question",
          type: 3,
          description: "Poll question",
          required: true
        }
      ],
      execute: async (interaction) => {
        const question = interaction.options.getString("question");
        const embed = new EmbedBuilder()
          .setTitle("📊 Poll")
          .setDescription(question)
          .setColor("Gold");

        await interaction.reply({ embeds: [embed] });
        const message = await interaction.fetchReply();
        await message.react("👍");
        await message.react("👎");
      }
    }
  ];
}

module.exports = { buildFunCommands };
