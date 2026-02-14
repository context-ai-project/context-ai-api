/**
 * Docker health-check script for Context.ai API
 *
 * Exits with 0 if the root endpoint returns 200, 1 otherwise.
 * Used by the HEALTHCHECK instruction in the Dockerfile.
 *
 * The API uses a global prefix (api/v1), so the health endpoint
 * is at /api/v1/ (root controller).
 */

'use strict';

const http = require('http');

const port = process.env.PORT || 3001;
const apiPrefix = process.env.API_PREFIX || 'api/v1';

const options = {
  hostname: '127.0.0.1',
  port,
  path: `/${apiPrefix}/`,
  method: 'GET',
  timeout: 4000,
};

const req = http.request(options, (res) => {
  process.exit(res.statusCode === 200 ? 0 : 1);
});

req.on('error', () => process.exit(1));
req.on('timeout', () => {
  req.destroy();
  process.exit(1);
});

req.end();
