const request = require('supertest');
const app = require('../src/app');
const pool = require('../src/db');

// Wipe all data and reset ids so every test starts from the same empty state.
async function resetDb() {
  await pool.query('TRUNCATE players, scores RESTART IDENTITY CASCADE');
}

async function createPlayer(username) {
  const res = await request(app).post('/players').send({ username });
  return res.body;
}

async function addScore(player_id, score) {
  return request(app).post('/scores').send({ player_id, score });
}

module.exports = { app, pool, request, resetDb, createPlayer, addScore };
