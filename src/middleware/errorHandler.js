const { ApiError } = require('../errors');

function notFound(req, res, next) {
  next(new ApiError(404, 'NOT_FOUND', `${req.method} ${req.path} does not exist`));
}

// Every error response has the shape { error: { code, message } }.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }
  // express.json() failures carry a `type`.
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'request body is not valid JSON' } });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'request body is too large' } });
  }
  // Unknown: log the details server-side, never leak them to the client.
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'something went wrong' } });
}

module.exports = { notFound, errorHandler };
