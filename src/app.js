const express = require('express');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(express.json({ limit: '10kb' }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/scores', require('./routes/scores'));
app.use('/leaderboard', require('./routes/leaderboard'));
app.use('/players', require('./routes/players'));

// Order matters: these must come after every route.
app.use(notFound);
app.use(errorHandler);

module.exports = app;
