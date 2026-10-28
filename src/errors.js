// An error that should reach the client as-is. Anything else is treated as a bug (500).
class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

module.exports = { ApiError };
