const express = require('express');
const router = express.Router();

module.exports = (client) => {
  // Lista członków z rolami
  router.get('/members', async (req, res) => {
    try {
      const guild = await client.guilds.fetch(process.env.GUILD_ID);
      await guild.members.fetch(); // Załaduj wszystkich członków

      const members = guild.members.cache.map(member => ({
        id: member.id,
        username: member.user.username,
        roles: member.roles.cache.map(role => ({
          id: role.id,
          name: role.name
        }))
      }));

      res.json(members);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Wystąpił błąd.' });
    }
  });

  // Endpoint do przyjmowania danych ze strony
  router.post('/message', (req, res) => {
    const { content } = req.body;

    const channel = client.channels.cache.find(ch => ch.name === 'general'); // lub po ID
    if (channel && content) {
      channel.send(content);
      res.json({ status: 'Wysłano wiadomość.' });
    } else {
      res.status(400).json({ error: 'Nieprawidłowe dane.' });
    }
  });

  return router;
};
