# Leaderboard API

**Proves:** RESTful API design and live-service backend fundamentals: schema and index design, input validation, consistent error handling, tests, and measured performance.

A game leaderboard and player-profile REST API built with Node.js, Express 5 and PostgreSQL (raw SQL, no ORM).

## Endpoints

All errors share one shape: `{ "error": { "code": "...", "message": "..." } }`.

| Method | Path | Success | Errors |
|---|---|---|---|
| GET | `/health` | 200 | |
| POST | `/players` | 201 | 400, 409 |
| GET | `/players/:id` | 200 | 400, 404 |
| PUT | `/players/:id` | 200 | 400, 404, 409 |
| POST | `/scores` | 201 | 400, 404 |
| GET | `/leaderboard?limit=N` | 200 | 400 |

### `POST /players`

Usernames are 3-32 characters, trimmed, and unique ignoring case (`Alice` and `alice` collide).

```bash
curl -X POST localhost:3000/players -H 'content-type: application/json' -d '{"username":"alice"}'
```
```json
{ "id": 1, "username": "alice", "created_at": "2026-10-28T20:33:15.905Z" }
```

A taken name returns `409`:
```json
{ "error": { "code": "USERNAME_TAKEN", "message": "username \"alice\" is already taken" } }
```

### `GET /players/:id`

The profile includes aggregates over the player's scores.

```json
{ "id": 1, "username": "alice", "created_at": "2026-10-28T20:33:15.905Z", "scores_count": 2, "best_score": 800 }
```

A player with no scores yet has `"scores_count": 0` and `"best_score": null`, not a missing field or an error.

### `PUT /players/:id`

Renames a player. Body: `{ "username": "alice2" }`. Returns the updated player, `404` for an unknown id, `409` if the name is taken by someone else.

### `POST /scores`

`player_id` must be a positive integer for an existing player. `score` must be an integer from 0 to 2,147,483,647. Strings like `"100"` and floats like `10.5` are rejected, not coerced.

```bash
curl -X POST localhost:3000/scores -H 'content-type: application/json' -d '{"player_id":1,"score":4200}'
```
```json
{ "id": 1, "player_id": 1, "score": 4200, "created_at": "2026-10-28T20:41:32.123Z" }
```

An unknown player returns `404 PLAYER_NOT_FOUND`.

### `GET /leaderboard?limit=N`

Top scores with usernames. `limit` defaults to 10 and is clamped to a maximum of 100. `limit=0`, `-5`, `abc` and `2.5` are `400`s. Ties go to whoever scored first.

```json
{
  "limit": 2,
  "entries": [
    { "rank": 1, "score_id": 3, "player_id": 2, "username": "bob",   "score": 900, "created_at": "2026-10-28T20:27:17.521Z" },
    { "rank": 2, "score_id": 1, "player_id": 1, "username": "alice", "score": 700, "created_at": "2026-10-28T20:27:17.523Z" }
  ]
}
```

### Error codes

| Code | Status | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | A field or parameter is missing or invalid |
| `INVALID_JSON` | 400 | The request body is not valid JSON |
| `PLAYER_NOT_FOUND` | 404 | No player with that id |
| `NOT_FOUND` | 404 | No such route |
| `USERNAME_TAKEN` | 409 | The username already exists (case-insensitive) |
| `PAYLOAD_TOO_LARGE` | 413 | The body exceeds 10 KB |
| `INTERNAL_ERROR` | 500 | Unexpected failure; details are logged server-side, never returned |

## Schema and the leaderboard index

```sql
players (id, username, created_at)   -- UNIQUE index on lower(username), CHECK length 3-32
scores  (id, player_id → players, score, created_at)   -- CHECK score >= 0, ON DELETE CASCADE
```

Full definitions are in [migrations/](migrations/).

**Constraints live in the database as well as the API.** Validation in Express gives friendly errors, but the database is the last line of defense. The API leans on the constraints instead of checking first: `POST /scores` inserts and treats a foreign-key violation as "player not found", and `POST /players` treats a unique violation as "username taken". That is one round trip and has no check-then-insert race.

**The leaderboard index:**

```sql
CREATE INDEX scores_leaderboard_idx ON scores (score DESC, created_at ASC, id ASC);
```

The leaderboard query is `ORDER BY score DESC, created_at ASC, id ASC LIMIT N`. A B-tree is already sorted, so when the index matches the `ORDER BY` exactly, Postgres reads the first N entries and stops. Without it, Postgres scans and sorts the whole table. The extra columns are tiebreakers: `created_at` ranks the earlier score higher, and `id` makes the order fully deterministic.

A second index, `scores(player_id)`, serves profile aggregates and makes cascade deletes cheap. Postgres does not index foreign keys automatically.

Design note: the board lists the top N score rows, so one player can appear more than once. A "best score per player" board would need a different design, such as a `best_score` column or a materialized view.

## Results

Load test with autocannon, 50 connections, 1,000,000 scores in the table:

| Scenario | Req/sec | p50 | p99 |
|---|---|---|---|
| `GET /leaderboard?limit=10`, with the index | **~6,600** | 7 ms | 11-13 ms |
| Same, index dropped | ~28 | 1,557 ms | 2,456 ms |

The index is worth roughly **240x** throughput on this query, and zero requests errored. Everything ran on one laptop (Postgres, Node and the load generator together), so treat the numbers as a relative baseline. Method, caveats and reproduction steps are in [docs/LOAD_TEST.md](docs/LOAD_TEST.md).

## Tests

**54 tests** (jest + supertest) covering happy paths, boundaries (3 and 32 character usernames, scores of 0 and 2,147,483,647), validation failures, case-insensitive uniqueness, cascade deletes, the leaderboard limit clamp, tie ordering, malformed JSON, oversized bodies and the 500 path.

- **Isolation:** tests run against a separate `*_test` database, and the suite refuses to start if `TEST_DATABASE_URL` does not end in `_test`. The schema comes from the real migrations, and every test starts from `TRUNCATE ... RESTART IDENTITY CASCADE`. Files run serially (`--runInBand`) because they share one database.
- **Mutation-checked:** I deliberately broke the code twice, raising the limit cap and reversing the sort order, and the suite failed both times.

```bash
npm test
```

## Run it

Requires Node 20+ and PostgreSQL.

```bash
npm install
createdb leaderboard && createdb leaderboard_test   # as a Postgres user that can create databases
                                                    # (the test suite applies migrations to leaderboard_test itself,
                                                    # but the database has to exist first)
cp .env.example .env                                # then fill in credentials
npm run migrate                                     # applies migrations/*.sql in order, once each
npm start                                           # http://localhost:3000
```

Optional:

```bash
npm run seed       # 10k players + 1M scores, for load testing (use a scratch database)
npm run loadtest   # autocannon against /leaderboard; server must be running on :3000
npm test           # migrates the test database itself, then runs the suite
```

### Environment variables

| Variable | Purpose |
|---|---|
| `PORT` | HTTP port (default 3000) |
| `DATABASE_URL` | Postgres connection string for the app |
| `TEST_DATABASE_URL` | Postgres connection string for tests; the database name must end in `_test` |

### Layout

```
src/app.js          Express setup, exported for tests
src/server.js       listen()
src/db.js           pg pool
src/routes/         players, scores, leaderboard
src/validate.js     input parsing (one place)
src/errors.js       ApiError
src/middleware/     404 + central error handler
src/migrate.js      small migration runner
migrations/         SQL, applied in filename order
tests/              jest + supertest
```

## What I'd do next

- **Rate limiting.** `POST /scores` is the obvious abuse target. A per-client limit would sit in front of it.
- **Caching.** The leaderboard is read far more often than it changes. Caching the top N for a second or so (in memory, or Redis across instances) would take most reads off Postgres.
- **Clustering.** Run one process per core with Node's `cluster` module, or several instances behind a load balancer, since a single process uses one core.
- **Authentication and score integrity.** Today any client can submit any score for any player. A real game needs authenticated players and server-side checks that scores are plausible.
- **A read-write load test.** The current test covers reads on a quiet table. Mixed traffic would show the index's cost on `POST /scores`.
