const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware do obsługi JSON (ważne!)
app.use(express.json());

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ],
});

// ID serwera i ID roli do sprawdzenia
const GUILD_ID = '1359567770827751584';
const ROLE_ID = '1361817240512758000';

// Klucz API – przechowywany w pliku .env
const API_KEY = process.env.API_KEY || 'tajnyklucz';

// Middleware do sprawdzania klucza API
const checkApiKey = (req, res, next) => {
  const apiKey = req.headers['api_key'];
  if (apiKey !== API_KEY) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  next(); // Kontynuuj, jeśli klucz API jest poprawny
};

// Endpoint do sprawdzania roli użytkownika (POST)
app.post('/check', checkApiKey, async (req, res) => {
  const userId = req.body.userId;

  if (!userId) {
    return res.status(400).json({ error: 'Brak userId w żądaniu' });
  }

  try {
    console.log(`Sprawdzam użytkownika: ${userId}`);
    const guild = await client.guilds.fetch(GUILD_ID);
    const member = await guild.members.fetch(userId);
    const hasRole = member.roles.cache.has(ROLE_ID);

    return res.json({ status: hasRole ? 'whitelisted' : 'non-whitelisted' });
  } catch (error) {
    console.error('❌ Błąd przy sprawdzaniu roli:', error);
    return res.status(500).json({ error: 'Nie udało się sprawdzić użytkownika' });
  }
});

// Start serwera HTTP
app.listen(PORT, () => {
  console.log(`HTTP API działa na porcie ${PORT}`);
});

// Logowanie bota do Discorda
client.once('ready', () => {
  console.log(`✅ Zalogowano jako ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);
