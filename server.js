const express = require('express');
const apiRoutes = require('./routes/api');

function startServer(discordClient) {
  const app = express();
  app.use(express.json());

  // Przekazujemy instancję klienta do API
  app.use('/api', apiRoutes(discordClient));

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`API działa na porcie ${PORT}`);
  });
}

module.exports = startServer;
