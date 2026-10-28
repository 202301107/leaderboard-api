const express = require('express');
const pool = require('../db');
const { ApiError } = require('../errors');
const { parsePlayerId, parseScore } = require('../validate');

const router = express.Router();

const PG_FK_VIOLATION = '23503';

router.post('/', async (req, res) => {
  const player_id = parsePlayerId(req.body?.player_id);
  const score = parseScore(req.body?.score);

  try {
    const { rows } = await pool.query(
      `INSERT INTO scores (player_id, score)
       VALUES ($1, $2)
       RETURNING id, player_id, score, created_at`,
      [player_id, score]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    // The FK constraint is the existence check: one round trip, no check-then-insert race.
    if (err.code === PG_FK_VIOLATION) {
      throw new ApiError(404, 'PLAYER_NOT_FOUND', `player ${player_id} does not exist`);
    }
    throw err;
  }
});

module.exports = router;
