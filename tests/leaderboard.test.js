const { app, pool, request, resetDb, createPlayer, addScore } = require('./helpers');

beforeEach(resetDb);
afterAll(() => pool.end());

const errorShape = (code) => ({ error: { code, message: expect.any(String) } });

test('empty leaderboard returns no entries', async () => {
  const res = await request(app).get('/leaderboard');
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ limit: 10, entries: [] });
});

test('orders by score desc with ranks and usernames', async () => {
  const a = await createPlayer('alice');
  const b = await createPlayer('bob');
  await addScore(a.id, 500);
  await addScore(b.id, 900);
  await addScore(a.id, 700);

  const res = await request(app).get('/leaderboard');
  expect(res.status).toBe(200);
  expect(res.body.entries.map((e) => [e.rank, e.username, e.score])).toEqual([
    [1, 'bob', 900],
    [2, 'alice', 700],
    [3, 'alice', 500],
  ]);
});

test('ties go to whoever scored first', async () => {
  const a = await createPlayer('alice');
  const b = await createPlayer('bob');
  await addScore(b.id, 100);
  await addScore(a.id, 100);
  const res = await request(app).get('/leaderboard');
  expect(res.body.entries.map((e) => e.username)).toEqual(['bob', 'alice']);
});

describe('limit', () => {
  beforeEach(async () => {
    const p = await createPlayer('alice');
    for (let i = 1; i <= 5; i++) await addScore(p.id, i);
  });

  test('respects limit', async () => {
    const res = await request(app).get('/leaderboard?limit=3');
    expect(res.body.limit).toBe(3);
    expect(res.body.entries.map((e) => e.score)).toEqual([5, 4, 3]);
  });

  test('oversized limit is clamped to 100', async () => {
    const res = await request(app).get('/leaderboard?limit=100000');
    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(100);
    expect(res.body.entries).toHaveLength(5);
  });

  test.each(['0', '-5', 'abc', '2.5', '1e2', ''])('invalid limit "%s" is 400', async (limit) => {
    const res = await request(app).get(`/leaderboard?limit=${limit}`);
    expect(res.status).toBe(400);
    expect(res.body).toEqual(errorShape('VALIDATION_ERROR'));
  });

  test('repeated limit param is 400', async () => {
    const res = await request(app).get('/leaderboard?limit=1&limit=2');
    expect(res.status).toBe(400);
  });
});
