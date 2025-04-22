require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const startServer = require('./server');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

client.once('ready', () => {
  console.log(`Zalogowano jako ${client.user.tag}`);
  startServer(client);
});

client.login(process.env.DISCORD_TOKEN);
