const { app, pool, request, resetDb, createPlayer, addScore } = require('./helpers');

beforeEach(resetDb);
afterAll(() => pool.end());

const errorShape = (code) => ({ error: { code, message: expect.any(String) } });

describe('POST /players', () => {
  test('creates a player', async () => {
    const res = await request(app).post('/players').send({ username: 'alice' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: 1, username: 'alice', created_at: expect.any(String) });
  });

  test('trims surrounding whitespace', async () => {
    const res = await request(app).post('/players').send({ username: '  padded  ' });
    expect(res.status).toBe(201);
    expect(res.body.username).toBe('padded');
  });

  test.each([
    ['too short', 'ab'],
    ['too long', 'a'.repeat(33)],
    ['whitespace only', '   '],
    ['not a string', 123],
    ['missing', undefined],
  ])('rejects username: %s', async (_name, username) => {
    const res = await request(app).post('/players').send({ username });
    expect(res.status).toBe(400);
    expect(res.body).toEqual(errorShape('VALIDATION_ERROR'));
  });

  test('accepts the 3 and 32 character boundaries', async () => {
    expect((await request(app).post('/players').send({ username: 'abc' })).status).toBe(201);
    expect((await request(app).post('/players').send({ username: 'a'.repeat(32) })).status).toBe(201);
  });

  test('duplicate username is 409, ignoring case', async () => {
    await createPlayer('Alice');
    for (const dup of ['Alice', 'alice', 'ALICE']) {
      const res = await request(app).post('/players').send({ username: dup });
      expect(res.status).toBe(409);
      expect(res.body).toEqual(errorShape('USERNAME_TAKEN'));
    }
  });
});

describe('GET /players/:id', () => {
  test('returns the profile with score aggregates', async () => {
    const p = await createPlayer('alice');
    await addScore(p.id, 300);
    await addScore(p.id, 800);
    const res = await request(app).get(`/players/${p.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: p.id, username: 'alice', scores_count: 2, best_score: 800 });
  });

  test('a player with no scores has count 0 and null best_score', async () => {
    const p = await createPlayer('alice');
    const res = await request(app).get(`/players/${p.id}`);
    expect(res.body).toMatchObject({ scores_count: 0, best_score: null });
  });

  test('unknown id is 404', async () => {
    const res = await request(app).get('/players/999');
    expect(res.status).toBe(404);
    expect(res.body).toEqual(errorShape('PLAYER_NOT_FOUND'));
  });

  test.each(['abc', '0', '-1', '1.5', '99999999999'])('bad id %s is 400', async (id) => {
    const res = await request(app).get(`/players/${id}`);
    expect(res.status).toBe(400);
    expect(res.body).toEqual(errorShape('VALIDATION_ERROR'));
  });
});

describe('PUT /players/:id', () => {
  test('renames a player and the change persists', async () => {
    const p = await createPlayer('alice');
    const res = await request(app).put(`/players/${p.id}`).send({ username: 'alice2' });
    expect(res.status).toBe(200);
    expect(res.body.username).toBe('alice2');
    expect((await request(app).get(`/players/${p.id}`)).body.username).toBe('alice2');
  });

  test('renaming to your own name, or changing only its case, succeeds', async () => {
    const p = await createPlayer('Alice');
    expect((await request(app).put(`/players/${p.id}`).send({ username: 'Alice' })).status).toBe(200);
    const res = await request(app).put(`/players/${p.id}`).send({ username: 'alice' });
    expect(res.status).toBe(200);
    expect(res.body.username).toBe('alice');
  });

  test("taking another player's name is 409, ignoring case", async () => {
    await createPlayer('alice');
    const bob = await createPlayer('bob');
    const res = await request(app).put(`/players/${bob.id}`).send({ username: 'ALICE' });
    expect(res.status).toBe(409);
    expect(res.body).toEqual(errorShape('USERNAME_TAKEN'));
  });

  test('invalid or missing username is 400', async () => {
    const p = await createPlayer('alice');
    for (const body of [{ username: 'x' }, {}]) {
      const res = await request(app).put(`/players/${p.id}`).send(body);
      expect(res.status).toBe(400);
    }
  });

  test('unknown id is 404, bad id is 400', async () => {
    expect((await request(app).put('/players/999').send({ username: 'whoever' })).status).toBe(404);
    expect((await request(app).put('/players/abc').send({ username: 'whoever' })).status).toBe(400);
  });
});
