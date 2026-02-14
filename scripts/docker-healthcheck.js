/**
 * Docker health-check script for Context.ai API
 *
 * Exits with 0 if the /health endpoint returns 200, 1 otherwise.
 * Used by the HEALTHCHECK instruction in the Dockerfile.
 */

'use strict';

const http = require('http');

const port = process.env.PORT || 3000;

const options = {
  hostname: '127.0.0.1',
  port,
  path: '/health',
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

