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

// ✅ CHECK ENDPOINT (poprawiony)
app.post('/check', checkApiKey, async (req, res) => {
  const userId = req.body.userId;
  if (!userId) {
    return res.status(400).json({ error: 'Missing userId in request' });
  }

  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    
    // Sprawdź czy użytkownik jest na serwerze
    try {
      const member = await guild.members.fetch(userId);
      const hasRole = member.roles.cache.has(WHITELISTED_ROLE_ID);
      return res.json({ status: hasRole ? 'whitelisted' : 'non-whitelisted' });
    } catch (fetchError) {
      // Jeśli nie można pobrać członka, oznacza to że nie jest na serwerze
      console.log(`User ${userId} not found on server`);
      return res.json({ status: 'not-on-server' });
    }
    
  } catch (error) {
    console.error('❌ Error checking role:', error);
    return res.status(500).json({ error: 'Failed to check user' });
  }
});

// ✅ NOWY ENDPOINT ROLE CHECK (poprawiony)
app.post('/role-check', checkApiKey, async (req, res) => {
  const userId = req.body.userId;
  if (!userId) {
    return res.status(400).json({ error: 'Missing userId in request' });
  }

  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    
    // Sprawdź czy użytkownik jest na serwerze
    try {
      const member = await guild.members.fetch(userId);
      const hasRole = member.roles.cache.has(WHITELISTED_ROLE_ID);
      return res.json({ status: hasRole ? 'hasRole' : 'noRole' });
    } catch (fetchError) {
      // Jeśli nie można pobrać członka, oznacza to że nie jest na serwerze
      console.log(`User ${userId} not found on server`);
      return res.json({ status: 'not-on-server' });
    }
    
  } catch (error) {
    console.error('❌ Error checking role:', error);
    return res.status(500).json({ error: 'Failed to check user role' });
  }
});

// 📝 WHITELIST SUBMISSION ENDPOINT (poprawiony)
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
    
    // Sprawdź czy użytkownik jest na serwerze
    try {
      const member = await guild.members.fetch(userId);
    } catch (fetchError) {
      console.log(`User ${userId} not found on server`);
      return res.status(400).json({ error: 'User not found on server. Please join the Discord server first.' });
    }
    
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

// 🔧 ADMIN ACTION ENDPOINT - dla panelu administracyjnego
app.post('/admin-action', checkApiKey, async (req, res) => {
  const { userId, action } = req.body;
  
  if (!userId || !action) {
    return res.status(400).json({ error: 'Missing userId or action in request' });
  }

  if (!['accept', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action. Must be "accept" or "reject"' });
  }

  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    
    // Sprawdź czy użytkownik jest na serwerze
    try {
      const member = await guild.members.fetch(userId);

      if (action === 'accept') {
        // Usuń rejected role jeśli istnieje
        if (member.roles.cache.has(REJECTED_ROLE_ID)) {
          await member.roles.remove(REJECTED_ROLE_ID);
        }
        
        // Dodaj whitelisted role
        await member.roles.add(WHITELISTED_ROLE_ID);
        
        // Wyślij DM
        try {
          await member.send('🎉 Your whitelist application has been accepted! Welcome to the server!');
        } catch (err) {
          console.warn('Failed to send acceptance DM:', err.message);
        }

        console.log(`✅ User ${userId} has been whitelisted via admin panel`);
        return res.json({ 
          success: true, 
          message: `User ${userId} has been whitelisted`,
          action: 'accepted'
        });

      } else if (action === 'reject') {
        // Usuń whitelisted role jeśli istnieje
        if (member.roles.cache.has(WHITELISTED_ROLE_ID)) {
          await member.roles.remove(WHITELISTED_ROLE_ID);
        }
        
        // Dodaj rejected role
        await member.roles.add(REJECTED_ROLE_ID);
        
        // Wyślij DM
        try {
          await member.send('😞 Your whitelist application has been rejected. Please try again later.');
        } catch (err) {
          console.warn('Failed to send rejection DM:', err.message);
        }

        console.log(`❌ User ${userId} has been rejected via admin panel`);
        return res.json({ 
          success: true, 
          message: `User ${userId} has been rejected`,
          action: 'rejected'
        });
      }

    } catch (fetchError) {
      console.log(`User ${userId} not found on server`);
      return res.status(404).json({ 
        error: 'User not found on server. User may have left the server.',
        userId: userId
      });
    }
    
  } catch (error) {
    console.error('❌ Error in admin action:', error);
    return res.status(500).json({ 
      error: 'Failed to process admin action',
      details: error.message
    });
  }
});

// 🎛️ BUTTON INTERACTIONS (pozostają bez zmian - dla przycisków w embedach)
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;

  const [action, userId] = interaction.customId.split('_');
  const guild = await client.guilds.fetch(GUILD_ID);
  
  try {
    const member = await guild.members.fetch(userId);

    if (action === 'accept') {
      // Usuń rejected role jeśli istnieje
      if (member.roles.cache.has(REJECTED_ROLE_ID)) {
        await member.roles.remove(REJECTED_ROLE_ID);
      }
      
      await member.roles.add(WHITELISTED_ROLE_ID);
      await interaction.reply({ content: `✅ Accepted <@${userId}>.`, ephemeral: true });

      try {
        await member.send('🎉 Your whitelist application has been accepted! Welcome to the server!');
      } catch (err) {
        console.warn('Failed to send DM:', err.message);
      }

    } else if (action === 'reject') {
      // Usuń whitelisted role jeśli istnieje
      if (member.roles.cache.has(WHITELISTED_ROLE_ID)) {
        await member.roles.remove(WHITELISTED_ROLE_ID);
      }
      
      await member.roles.add(REJECTED_ROLE_ID);
      await interaction.reply({ content: `❌ Rejected <@${userId}>.`, ephemeral: true });

      try {
        await member.send('😞 Your whitelist application has been rejected. Please try again later.');
      } catch (err) {
        console.warn('Failed to send DM:', err.message);
      }
    }
  } catch (err) {
    console.error('❌ Error handling button (user might have left server):', err);
    await interaction.reply({ content: `❌ Error: User <@${userId}> not found on server (may have left).`, ephemeral: true });
  }
});

// 🌐 Start server
app.listen(PORT, () => {
  console.log(`🌐 HTTP API running on port ${PORT}`);
  console.log(`📋 Available endpoints:`);
  console.log(`   POST /check - Check user whitelist status`);
  console.log(`   POST /role-check - Check user role`);
  console.log(`   POST /whitelist - Submit whitelist application`);
  console.log(`   POST /admin-action - Admin panel actions (accept/reject)`);
});

// 🔑 Bot login
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log(`🏠 Connected to guild: ${GUILD_ID}`);
  console.log(`📝 Whitelist channel: ${CHANNEL_ID}`);
  console.log(`✅ Whitelisted role: ${WHITELISTED_ROLE_ID}`);
  console.log(`❌ Rejected role: ${REJECTED_ROLE_ID}`);
});

client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error('❌ Bot login error:', err);
});
