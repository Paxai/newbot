const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ],
});

// ID serwera i ID roli do sprawdzenia
const GUILD_ID = '1359567770827751584';
const ROLE_ID = '1361817240512758000';

// Endpoint HTTP do sprawdzania roli użytkownika
app.get('/check/:userId', async (req, res) => {
  const userId = req.params.userId;

  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const member = await guild.members.fetch(userId);

    if (member.roles.cache.has(ROLE_ID)) {
      return res.json({ status: 'whitelisted' });
    } else {
      return res.json({ status: 'non-whitelisted' });
    }
  } catch (error) {
    console.error('Błąd przy sprawdzaniu roli:', error);
    return res.status(500).json({ error: 'Nie udało się sprawdzić użytkownika' });
  }
});

// Start serwera HTTP
app.listen(PORT, () => {
  console.log(`HTTP API działa na porcie ${PORT}`);
});

// Logowanie bota do Discorda
client.once('ready', () => {
  console.log(`Zalogowano jako ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);
