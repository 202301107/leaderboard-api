const { ApiError } = require('./errors');

const PG_INT_MAX = 2147483647;
const USERNAME_MIN = 3;
const USERNAME_MAX = 32;
const LIMIT_DEFAULT = 10;
const LIMIT_MAX = 100;

function invalid(message) {
  return new ApiError(400, 'VALIDATION_ERROR', message);
}

// Path/query values arrive as strings; require plain digits so "1e2", "-5", "10abc" are rejected.
function parseId(value, name = 'id') {
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const id = Number(value);
    if (id >= 1 && id <= PG_INT_MAX) return id;
  }
  throw invalid(`${name} must be a positive integer`);
}

// JSON body values keep their types, so "100" and 10.5 are rejected, not coerced.
function parsePlayerId(value) {
  if (Number.isInteger(value) && value >= 1 && value <= PG_INT_MAX) return value;
  throw invalid('player_id must be a positive integer');
}

function parseScore(value) {
  if (Number.isInteger(value) && value >= 0 && value <= PG_INT_MAX) return value;
  throw invalid(`score must be an integer between 0 and ${PG_INT_MAX}`);
}

// Mirrors CHECK (char_length(username) BETWEEN 3 AND 32). Array.from counts code
// points like Postgres char_length does, not UTF-16 units like String.length.
function parseUsername(value) {
  if (typeof value === 'string') {
    const username = value.trim();
    const len = Array.from(username).length;
    if (len >= USERNAME_MIN && len <= USERNAME_MAX) return username;
  }
  throw invalid(`username must be a string of ${USERNAME_MIN}-${USERNAME_MAX} characters`);
}

// Oversized limits are clamped, not rejected: the client still gets a useful page.
function parseLimit(value) {
  if (value === undefined) return LIMIT_DEFAULT;
  return Math.min(parseId(value, 'limit'), LIMIT_MAX);
}

module.exports = { parseId, parsePlayerId, parseScore, parseUsername, parseLimit };
