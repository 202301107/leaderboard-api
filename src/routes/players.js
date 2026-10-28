const express = require('express');
const pool = require('../db');
const { ApiError } = require('../errors');
const { parseId, parseUsername } = require('../validate');

const router = express.Router();

const PG_UNIQUE_VIOLATION = '23505';

const playerNotFound = (id) => new ApiError(404, 'PLAYER_NOT_FOUND', `player ${id} does not exist`);

// The unique index on lower(username) is the source of truth for "taken", so this
// stays race-free and case-insensitive without a check-then-insert.
function rethrowIfUsernameTaken(err, username) {
  if (err.code === PG_UNIQUE_VIOLATION) {
    throw new ApiError(409, 'USERNAME_TAKEN', `username "${username}" is already taken`);
  }
  throw err;
}

router.post('/', async (req, res) => {
  const username = parseUsername(req.body?.username);

  try {
    const { rows } = await pool.query(
      'INSERT INTO players (username) VALUES ($1) RETURNING id, username, created_at',
      [username]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    rethrowIfUsernameTaken(err, username);
  }
});

router.get('/:id', async (req, res) => {
  const id = parseId(req.params.id);

  // Profile = the player row plus aggregates over their scores (served by scores_player_id_idx).
  const { rows } = await pool.query(
    `SELECT p.id, p.username, p.created_at,
            (SELECT count(*)::int FROM scores WHERE player_id = p.id) AS scores_count,
            (SELECT max(score)    FROM scores WHERE player_id = p.id) AS best_score
       FROM players p
      WHERE p.id = $1`,
    [id]
  );
  if (rows.length === 0) throw playerNotFound(id);
  res.json(rows[0]);
});

router.put('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const username = parseUsername(req.body?.username);

  let rows;
  try {
    ({ rows } = await pool.query(
      'UPDATE players SET username = $2 WHERE id = $1 RETURNING id, username, created_at',
      [id, username]
    ));
  } catch (err) {
    rethrowIfUsernameTaken(err, username);
  }
  if (rows.length === 0) throw playerNotFound(id);
  res.json(rows[0]);
});

module.exports = router;
