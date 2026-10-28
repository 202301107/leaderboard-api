// Bulk-loads fake data for load testing:  node scripts/seed.js [players] [scores]
// Uses generate_series so Postgres does the work in two statements.
require('dotenv').config();
const pool = require('../src/db');

async function main() {
  const players = Number(process.argv[2] ?? 10000);
  const scores = Number(process.argv[3] ?? 1000000);

  await pool.query(
    "INSERT INTO players (username) SELECT 'seed_' || g FROM generate_series(1, $1::int) g ON CONFLICT DO NOTHING",
    [players]
  );
  const { rows } = await pool.query("SELECT min(id) AS lo, count(*)::int AS n FROM players WHERE username LIKE 'seed\\_%'");
  await pool.query(
    `INSERT INTO scores (player_id, score)
     SELECT $1::int + (g % $2::int), (random() * 1000000)::int FROM generate_series(1, $3::int) g`,
    [rows[0].lo, rows[0].n, scores]
  );
  await pool.query('ANALYZE players, scores');
  console.log(`seeded ${rows[0].n} players, ${scores} scores`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
