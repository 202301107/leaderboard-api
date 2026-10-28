# Load test: `GET /leaderboard`

## Result

**~6,600 requests/sec** (mean of 3 runs: 6,966 / 6,314 / 6,629) for `GET /leaderboard?limit=10`
against a table of **1,000,000 scores**, 50 concurrent connections, 0 errors.

| Scenario | Req/sec | p50 latency | p99 latency | Errors |
|---|---|---|---|---|
| `limit=10`, with `scores_leaderboard_idx` | **~6,600** | 7 ms | 11-13 ms | 0 |
| `limit=100` (the cap), with index | ~2,600 | 18 ms | 25 ms | 0 |
| `limit=10`, index dropped (seq scan + sort) | **~28** | 1,557 ms | 2,456 ms | 0 |

The index is worth roughly **240x** throughput on this query. Without it every request reads and
top-N-sorts all 1M rows, so latency grows with table size. With it each request reads ~10 index
entries, so latency stays flat.

`limit=100` is slower than `limit=10` because it does 10x the player lookups and serializes 10x the
JSON, not because the index stopped helping.

## Setup

- 10,000 players, 1,000,000 scores with uniformly random values (`npm run seed`); 146 MB with indexes
- Server: single Node process, `NODE_ENV=production`, default `pg` pool (10 connections)
- Load: `autocannon -c 50 -d 10`, after a 5 s warmup; three measured runs
- Machine: Intel i7-1255U (12 threads), WSL2, Node v24.22.1, PostgreSQL 18.6
- Server, Postgres and autocannon all ran on the **same machine**, competing for CPU

## Caveats

- Numbers are from a laptop with the load generator on the same box. Treat them as a relative
  baseline, not a capacity claim. Run-to-run variation was about 10%.
- Single process, one core serving requests. The obvious next steps for more throughput are the
  `cluster` module or several instances behind a load balancer, and caching the top-N result for a
  second or so (the leaderboard tolerates slight staleness; it is read far more often than written).
- This tests reads only, on a quiet table. A mixed read/write test would show index maintenance cost
  on `POST /scores`.
- Random scores are a friendly distribution. A real game has many ties at common values, which the
  `created_at, id` tiebreakers handle, but it was not exercised at this scale.

## Reproduce

```bash
npm run seed                       # 10k players, 1M scores into DATABASE_URL (use a scratch DB)
NODE_ENV=production npm start &   # serves on :3000, the port npm run loadtest targets
npm run loadtest                   # autocannon, 50 connections, 10 s
```
