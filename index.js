const express = require('express');
const { Client, GatewayIntentBits, EmbedBuilder, Partials } = require('discord.js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// Konfiguracja
const GUILD_ID = '1359567770827751584';
const ROLE_WHITELISTED = '1361817240512758000';
const ROLE_REJECTED = '1361817341935222845';
const CHANNEL_ID = '1361817608646562153';
const API_KEY = process.env.API_KEY || 'tajnyklucz';
// Możesz też ograniczyć do np. tylko roli admina
const ADMIN_ROLE_ID = '1361775341106106611'; // zostaw "" jeśli nie chcesz ograniczać

// Middleware do klucza API
const checkApiKey = (req, res, next) => {
  const apiKey = req.headers['api_key'];
  if (apiKey !== API_KEY) return res.status(403).json({ error: 'Unauthorized' });
  next();
};

// Endpoint: sprawdzanie roli
app.post('/check', checkApiKey, async (req, res) => {
  const userId = req.body.userId;
  if (!userId) return res.status(400).json({ error: 'Brak userId' });

  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const member = await guild.members.fetch(userId);
    const hasRole = member.roles.cache.has(ROLE_WHITELISTED);
    return res.json({ status: hasRole ? 'whitelisted' : 'non-whitelisted' });
  } catch (err) {
    console.error('❌ Błąd przy sprawdzaniu:', err);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// Endpoint: składanie aplikacji
app.post('/apply', checkApiKey, async (req, res) => {
  const { userId, username, formData } = req.body;
  if (!userId || !username || !formData || typeof formData !== 'object') {
    return res.status(400).json({ error: 'Nieprawidłowe dane' });
  }

  try {
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel.isTextBased()) return res.status(500).json({ error: 'Nieprawidłowy kanał' });

    const embed = new EmbedBuilder()
      .setTitle('📋 Nowa aplikacja whitelist')
      .setColor(0x3498db)
      .setTimestamp()
      .setFooter({ text: `Użytkownik: ${username} (${userId})` });

    for (const [key, value] of Object.entries(formData)) {
      embed.addFields({ name: key, value: String(value), inline: false });
    }

    const message = await channel.send({
      content: `<@&${ROLE_WHITELISTED}> - nowa aplikacja od <@${userId}>`,
      embeds: [embed]
    });

    // Reakcje do głosowania
    await message.react('✅');
    await message.react('❌');

    // Zapisz do wiadomości dane w cache
    message.applicationData = { userId };

    return res.json({ status: 'success', message: 'Aplikacja wysłana' });
  } catch (err) {
    console.error('❌ Błąd przy wysyłaniu aplikacji:', err);
    return res.status(500).json({ error: 'Nie udało się wysłać aplikacji' });
  }
});

// Reakcja na decyzję admina
client.on('messageReactionAdd', async (reaction, user) => {
  try {
    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();

    const { message } = reaction;
    const guild = await client.guilds.fetch(GUILD_ID);
    const member = await guild.members.fetch(user.id);

    // Sprawdź czy to administrator
    if (
      !member.permissions.has('ManageRoles') &&
      (ADMIN_ROLE_ID && !member.roles.cache.has(ADMIN_ROLE_ID))
    ) {
      return;
    }

    // Znajdź userId z embeda
    const footer = message.embeds[0]?.footer?.text;
    const matched = footer?.match(/\((\d{17,})\)/);
    if (!matched) return;

    const targetUserId = matched[1];
    const targetMember = await guild.members.fetch(targetUserId);

    // Nie reaguj jeśli już ktoś zdecydował
    if (targetMember.roles.cache.has(ROLE_WHITELISTED) || targetMember.roles.cache.has(ROLE_REJECTED)) {
      return;
    }

    if (reaction.emoji.name === '✅') {
      await targetMember.roles.add(ROLE_WHITELISTED);
      await message.reply(`✅ <@${targetUserId}> został whitelisted przez <@${user.id}>`);
      try {
        await targetMember.send(`✅ Gratulacje! Twoja aplikacja whitelist została zaakceptowana.`);
      } catch (e) {
        console.log(`Nie udało się wysłać DM do ${targetUserId}`);
      }
    } else if (reaction.emoji.name === '❌') {
      await targetMember.roles.add(ROLE_REJECTED);
      await message.reply(`❌ <@${targetUserId}> został odrzucony przez <@${user.id}>`);
    }
  } catch (err) {
    console.error('❌ Błąd przy obsłudze reakcji:', err);
  }
});

// Start HTTP
app.listen(PORT, () => {
  console.log(`🌐 HTTP API działa na porcie ${PORT}`);
});

// Logowanie bota
client.once('ready', () => {
  console.log(`✅ Zalogowano jako ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);
