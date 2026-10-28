// Runs once before all test files: bring the test DB schema up to date.
require('./testEnv');
const migrate = require('../src/migrate');
const pool = require('../src/db');

module.exports = async () => {
  await migrate(pool);
  await pool.end();
};
