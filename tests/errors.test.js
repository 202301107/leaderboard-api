const { app, pool, request } = require('./helpers');

afterAll(() => pool.end());

const errorShape = (code) => ({ error: { code, message: expect.any(String) } });

test('malformed JSON is 400 INVALID_JSON in the standard shape', async () => {
  const res = await request(app).post('/scores').set('content-type', 'application/json').send('{bad');
  expect(res.status).toBe(400);
  expect(res.body).toEqual(errorShape('INVALID_JSON'));
});

test('oversized body is 413', async () => {
  const res = await request(app).post('/players').send({ username: 'a'.repeat(20000) });
  expect(res.status).toBe(413);
  expect(res.body).toEqual(errorShape('PAYLOAD_TOO_LARGE'));
});

test('unknown route is 404 NOT_FOUND', async () => {
  const res = await request(app).get('/nope');
  expect(res.status).toBe(404);
  expect(res.body).toEqual(errorShape('NOT_FOUND'));
});

test('unexpected failures are 500 and leak nothing', async () => {
  const spy = jest.spyOn(pool, 'query').mockRejectedValueOnce(new Error('secret db detail'));
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  const res = await request(app).get('/leaderboard');
  expect(res.status).toBe(500);
  expect(res.body).toEqual({ error: { code: 'INTERNAL_ERROR', message: 'something went wrong' } });
  expect(JSON.stringify(res.body)).not.toContain('secret');
  expect(log).toHaveBeenCalled();
  spy.mockRestore();
  log.mockRestore();
});
