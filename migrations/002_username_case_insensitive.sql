-- "Alice" and "alice" must not both exist. A unique index on lower(username)
-- enforces that in the database. It also makes the original case-sensitive
-- UNIQUE constraint redundant (anything unique after lowercasing is unique
-- as-is), so drop it rather than pay for maintaining two indexes on every write.
-- Fails if existing rows already collide case-insensitively; resolve those first.
ALTER TABLE players DROP CONSTRAINT players_username_key;
CREATE UNIQUE INDEX players_username_lower_idx ON players (lower(username));
