const express = require('express');
const pool = require('../db');
const { parseLimit } = require('../validate');

const router = express.Router();

router.get('/', async (req, res) => {
  const limit = parseLimit(req.query.limit);

  // ORDER BY mirrors scores_leaderboard_idx exactly, so Postgres reads the first
  // `limit` index entries and stops. Rank is derived from position, not stored.
  const { rows } = await pool.query(
    `SELECT s.id AS score_id, p.id AS player_id, p.username, s.score, s.created_at
       FROM scores s
       JOIN players p ON p.id = s.player_id
      ORDER BY s.score DESC, s.created_at ASC, s.id ASC
      LIMIT $1`,
    [limit]
  );

  res.json({
    limit,
    entries: rows.map((r, i) => ({ rank: i + 1, ...r })),
  });
});

module.exports = router;
