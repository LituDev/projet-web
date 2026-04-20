// Minimal Nominatim stand-in used by the register flow during tests.
// Returns a fixed lat/lon for any /search request so we never hit the network.

import http from 'node:http';

let server;

export function startMock() {
  return new Promise((resolve) => {
    server = http.createServer((req, res) => {
      res.setHeader('Content-Type', 'application/json');
      if (req.url && req.url.startsWith('/search')) {
        res.end(JSON.stringify([{ lat: '45.764', lon: '4.8357' }]));
      } else {
        res.end('[]');
      }
    });
    server.listen(4599, '127.0.0.1', () => resolve());
  });
}

export function stopMock() {
  if (!server) return Promise.resolve();
  return new Promise((resolve) => server.close(() => resolve()));
}
