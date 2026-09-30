export function notFound(req, res) {
  res.status(404).json({ message: `Not found: ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  const status = err.status || (err.name === 'ValidationError' ? 400 : 500);
  if (status === 500) console.error(err);
  res.status(status).json({ message: err.message || 'Server error' });
}

export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}
