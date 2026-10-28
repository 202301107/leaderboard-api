const { app, pool, request, resetDb, createPlayer } = require('./helpers');

beforeEach(resetDb);
afterAll(() => pool.end());

const errorShape = (code) => ({ error: { code, message: expect.any(String) } });

describe('POST /scores', () => {
  test('creates a score', async () => {
    const p = await createPlayer('alice');
    const res = await request(app).post('/scores').send({ player_id: p.id, score: 4200 });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: 1, player_id: p.id, score: 4200, created_at: expect.any(String) });
  });

  test('accepts the 0 and INTEGER-max boundaries', async () => {
    const p = await createPlayer('alice');
    expect((await request(app).post('/scores').send({ player_id: p.id, score: 0 })).status).toBe(201);
    expect((await request(app).post('/scores').send({ player_id: p.id, score: 2147483647 })).status).toBe(201);
  });

  test('unknown player is 404', async () => {
    const res = await request(app).post('/scores').send({ player_id: 999, score: 10 });
    expect(res.status).toBe(404);
    expect(res.body).toEqual(errorShape('PLAYER_NOT_FOUND'));
  });

  test.each([
    ['negative', -5],
    ['float', 10.5],
    ['string', '100'],
    ['too large', 2147483648],
    ['null', null],
    ['missing', undefined],
  ])('rejects score: %s', async (_name, score) => {
    const p = await createPlayer('alice');
    const res = await request(app).post('/scores').send({ player_id: p.id, score });
    expect(res.status).toBe(400);
    expect(res.body).toEqual(errorShape('VALIDATION_ERROR'));
  });

  test.each([
    ['missing', undefined],
    ['string', 'abc'],
    ['zero', 0],
    ['float', 1.5],
  ])('rejects player_id: %s', async (_name, player_id) => {
    const res = await request(app).post('/scores').send({ player_id, score: 5 });
    expect(res.status).toBe(400);
    expect(res.body).toEqual(errorShape('VALIDATION_ERROR'));
  });

  test('empty body is 400', async () => {
    const res = await request(app).post('/scores');
    expect(res.status).toBe(400);
    expect(res.body).toEqual(errorShape('VALIDATION_ERROR'));
  });

  test('deleting a player cascades to their scores', async () => {
    const p = await createPlayer('alice');
    await request(app).post('/scores').send({ player_id: p.id, score: 1 });
    await pool.query('DELETE FROM players WHERE id = $1', [p.id]);
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM scores');
    expect(rows[0].n).toBe(0);
  });
});
