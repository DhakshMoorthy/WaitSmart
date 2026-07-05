# Nginx gateway (production)

Reverse proxy for WaitSmart API + WebSocket. Matches architecture gateway layer:
SSL termination, rate limiting, and proxy to Node.js.

## Usage

1. Set `API_UPSTREAM` to your Node server (e.g. `http://127.0.0.1:4000`)
2. Mount TLS certs at `/etc/nginx/certs/`
3. `docker run` or deploy alongside the API on Oracle compute

See `nginx.conf` for route mapping:
- `/` → Express API
- `/socket.io/` → Socket.io upgrade proxy

Rate limiting is also handled in Express (`express-rate-limit`); Nginx adds an edge layer in production.
