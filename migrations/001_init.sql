CREATE TABLE players (
  id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username   TEXT NOT NULL UNIQUE CHECK (char_length(username) BETWEEN 3 AND 32),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE scores (
  id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  player_id  INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  score      INTEGER NOT NULL CHECK (score >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Leaderboard: ORDER BY score DESC, created_at ASC, id ASC LIMIT N.
-- The index matches that ordering exactly, so Postgres walks it from the top
-- and stops after N rows instead of sorting the whole table.
CREATE INDEX scores_leaderboard_idx ON scores (score DESC, created_at ASC, id ASC);

-- Postgres does not index foreign keys automatically. This serves
-- "scores for player X" and makes ON DELETE CASCADE cheap.
CREATE INDEX scores_player_id_idx ON scores (player_id);
