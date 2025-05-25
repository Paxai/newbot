const express = require('express');
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events
} = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;
app.use(express.json());

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction]
});

// CONFIG
const GUILD_ID = '1359567770827751584';
const CHANNEL_ID = '1361817608646562153';
const WHITELISTED_ROLE_ID = '1361817240512758000';
const REJECTED_ROLE_ID = '1361817341935222845';
const API_KEY = process.env.API_KEY;

// 🔐 API KEY middleware
const checkApiKey = (req, res, next) => {
  const apiKey = req.headers['api_key'];
  if (apiKey !== API_KEY) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  next();
};

// 📁 Whitelist submissions (JSON file)
const submissionFile = path.join(__dirname, 'whitelistSubmissions.json');

function loadSubmissions() {
  if (!fs.existsSync(submissionFile)) return {};
  const data = fs.readFileSync(submissionFile, 'utf-8');
  return JSON.parse(data);
}

function saveSubmissions(data) {
  fs.writeFileSync(submissionFile, JSON.stringify(data, null, 2));
}

// ✅ CHECK ENDPOINT
app.post('/check', checkApiKey, async (req, res) => {
  const userId = req.body.userId;
  if (!userId) {
    return res.status(400).json({ error: 'Missing userId in request' });
  }

  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const member = await guild.members.fetch(userId);
    const hasRole = member.roles.cache.has(WHITELISTED_ROLE_ID);
    return res.json({ status: hasRole ? 'whitelisted' : 'non-whitelisted' });
  } catch (error) {
    console.error('❌ Error checking role:', error);
    return res.status(500).json({ error: 'Failed to check user' });
  }
});

// 📝 WHITELIST SUBMISSION ENDPOINT
app.post('/whitelist', checkApiKey, async (req, res) => {
  const { userId, username, formData } = req.body;
  if (!userId || !username || !formData) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const submissions = loadSubmissions();
  const userSubmissions = submissions[userId] || [];

  if (userSubmissions.length >= 3) {
    return res.status(429).json({ error: 'Limit of 3 submissions per user has been reached.' });
  }

  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const member = await guild.members.fetch(userId);
    const channel = await guild.channels.fetch(CHANNEL_ID);

    const formEntries = Object.entries(formData);
    const MAX_FIELDS = 25;
    const chunks = [];

    for (let i = 0; i < formEntries.length; i += MAX_FIELDS) {
      chunks.push(formEntries.slice(i, i + MAX_FIELDS));
    }

    const totalPages = chunks.length;
    const embeds = [];

    chunks.forEach((chunk, index) => {
      const embed = new EmbedBuilder()
        .setColor(0x00AE86)
        .setTimestamp()
        .setFooter({ text: `Page ${index + 1} of ${totalPages}` });

      if (index === 0) {
        embed.setTitle('📬 New whitelist application');
        embed.setDescription(`Submission from: <@${userId}> (${username})`);
      }

      chunk.forEach(([key, value]) => {
        embed.addFields({
          name: key,
          value: String(value).slice(0, 1024) || 'No data',
          inline: false
        });
      });

      embeds.push(embed);
    });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`accept_${userId}`)
        .setLabel('✅ Accept')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`reject_${userId}`)
        .setLabel('❌ Reject')
        .setStyle(ButtonStyle.Danger)
    );

    await channel.send({ embeds, components: [row] });

    // Save submission
    const timestamp = Date.now();
    userSubmissions.push(timestamp);
    submissions[userId] = userSubmissions;
    saveSubmissions(submissions);

    return res.json({ success: true, message: 'Embed sent' });

  } catch (error) {
    console.error('❌ Error processing whitelist:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// 🎛️ BUTTON INTERACTIONS
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;

  const [action, userId] = interaction.customId.split('_');
  const guild = await client.guilds.fetch(GUILD_ID);
  const member = await guild.members.fetch(userId);

  try {
    if (action === 'accept') {
      await member.roles.add(WHITELISTED_ROLE_ID);
      await interaction.reply({ content: `✅ Accepted <@${userId}>.`, ephemeral: true });

      try {
        await member.send('🎉 Your whitelist application has been accepted! Welcome to the server!');
      } catch (err) {
        console.warn('Failed to send DM:', err.message);
      }

    } else if (action === 'reject') {
      await member.roles.add(REJECTED_ROLE_ID);
      await interaction.reply({ content: `❌ Rejected <@${userId}>.`, ephemeral: true });

      try {
        await member.send('😞 Your whitelist application has been rejected. Please try again later.');
      } catch (err) {
        console.warn('Failed to send DM:', err.message);
      }
    }
  } catch (err) {
    console.error('❌ Error handling button:', err);
    await interaction.reply({ content: '❌ An error occurred while processing the action.', ephemeral: true });
  }
});

// 🌐 Start server
app.listen(PORT, () => {
  console.log(`🌐 HTTP API running on port ${PORT}`);
});

// 🔑 Bot login
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error('❌ Bot login error:', err);
});
