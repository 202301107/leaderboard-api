// Points the app at the TEST database, and refuses to run if that is not clearly a test DB.
// Required before anything that loads src/db.js, which reads DATABASE_URL at import time.
require('dotenv').config();

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL is not set (see .env.example)');
if (!/\/[^/?]*_test(\?|$)/.test(url)) {
  throw new Error('TEST_DATABASE_URL must point at a database whose name ends in _test');
}

process.env.DATABASE_URL = url;
