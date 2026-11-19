const { handler } = require('./index');

// Preserve the commerce handler contract while monitoring handled server errors.
// Log only an event marker/status, never the response body or payment payload.
exports.handler = async (...args) => {
  const result = await handler(...args);
  const statusCode = Number(result?.statusCode);
  if (statusCode >= 500) console.error(JSON.stringify({ event: 'commerce_server_error', statusCode }));
  return result;
};
