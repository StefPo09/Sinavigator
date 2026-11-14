# Sinavigator

## LAN deployment

The app host is `192.168.111.89`; Nginx Proxy Manager (NPM) is
`192.168.111.140`. Run the frontend from `frontend`:

```sh
npm ci
npm run build
npm run start
```

Both `npm run dev` and `npm run start` listen on `0.0.0.0:3002`. Open
[http://localhost:3002](http://localhost:3002) on the app host or
[http://192.168.111.89:3002](http://192.168.111.89:3002) from the LAN.

In NPM, configure `sinavigator.adv.ro` to forward HTTP to
`192.168.111.89:3002`, then configure its certificate/SSL as desired. Allow
inbound TCP port `3002` through the app host firewall from NPM
`192.168.111.140` (and from other LAN clients only if direct access is wanted).
The proxy's trusted IP is `192.168.111.140`, not the app host's
`192.168.111.89`.

### Backend API

The backend listens on port `8000`. From the repository root, install its
requirements into the backend virtual environment and start the API:

```sh
python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements.txt
backend/.venv/bin/python -m backend.run
```

The health endpoint is `http://192.168.111.89:8000/health`. To launch with
Uvicorn directly instead, use the same forwarded-header trust restriction:

```sh
backend/.venv/bin/python -m uvicorn backend.run:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips 192.168.111.140
```

Uvicorn only trusts forwarded headers from NPM at `192.168.111.140`; this
setting does not replace firewall rules. Restrict access to port `8000` to
trusted LAN services that need the API. NPM should use the frontend upstream
above; the frontend does not currently call the backend API.