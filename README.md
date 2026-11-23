# MeshLink

**Device to device. Nothing in between.**

Private, instant file transfer in the browser. Files stream directly between two devices over an encrypted WebRTC data channel; the server only introduces the devices (signalling) and never sees file data. Installable as a PWA.

## Run

```bash
npm install
npm run build      # build the frontend into dist/
npm start          # serve dist/ + signalling on http://localhost:3000
```

Development (hot reload; proxies `/api` and `/ws` to the server):

```bash
npm start          # terminal 1: signalling server on :3000
npm run dev        # terminal 2: Vite on :5173
```

## Configuration

| Variable | Where | Purpose |
| --- | --- | --- |
| `PORT` | server | Port to listen on (default `3000`). |
| `FRONTEND_URL` | server | Public origin used in QR join links, if it differs from the request host. |
| `VITE_SITE_URL` | build | Public origin, e.g. `https://meshlink.example.com`. Needed for absolute `og:image` / `og:url`, which social previews require. |
| `VITE_ICE_SERVERS` | build | JSON array of ICE servers. Add a TURN relay so devices on strict networks (mobile carriers, offices) can connect. |

Example: `VITE_ICE_SERVERS='[{"urls":"stun:stun.l.google.com:19302"},{"urls":"turn:turn.example.com:3478","username":"u","credential":"p"}]' npm run build`

## Brand assets

Icons, favicon and the social image (`public/`) are generated from SVG in `scripts/generate-assets.mjs`:

```bash
npm run assets
```

## Notes

- Serve over HTTPS in production: WebRTC, the service worker and install all require a secure context (localhost is exempt).
- Files over 300 MB can stream straight to disk in Chromium browsers; elsewhere they're held in memory.
