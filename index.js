const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Przykładowa "baza" użytkowników z przypisanymi rolami
const users = {
  '1234567890': ['1361817240512758000', '111111111111111111'],
  '0987654321': ['222222222222222222'],
  '5555555555': [], // brak ról
};

const WHITELIST_ROLE = '1361817240512758000';

app.get('/check/:userId', (req, res) => {
  const { userId } = req.params;
  const roles = users[userId] || [];

  if (roles.includes(WHITELIST_ROLE)) {
    return res.json({ status: 'whitelisted' });
  } else {
    return res.json({ status: 'non-whitelisted' });
  }
});

app.listen(PORT, () => {
  console.log(`Bot listening on port ${PORT}`);
});
