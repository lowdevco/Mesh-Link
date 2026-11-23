
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const QRCode = require("qrcode");
const path = require("path");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
// Signalling messages are small SDP/ICE JSON; the ws default (100 MB) lets one client exhaust memory.
const wss = new WebSocket.Server({ server, path: "/ws", maxPayload: 64 * 1024 });

const PORT = process.env.PORT || 3000;
const rooms = new Map();
const distPath = path.join(__dirname, "dist");

function getBaseUrl(req) {
    if (process.env.FRONTEND_URL) {
        return process.env.FRONTEND_URL.replace(/\/$/, "");
    }
    // Headers are client-controlled: only accept http/https and a plain host[:port].
    const forwarded = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
    const protocol = forwarded === "https" || forwarded === "http" ? forwarded : req.protocol;
    const rawHost = req.get("host") || "";
    const host = /^[A-Za-z0-9.-]+(:\d+)?$/.test(rawHost) ? rawHost : `localhost:${PORT}`;
    return `${protocol}://${host}`;
}

app.disable("x-powered-by");
app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "DENY");
    next();
});

// Only ever serve the build output; serving the project root exposed server.js, src/ and node_modules/.
app.use(express.static(distPath, {
    setHeaders(res, filePath) {
        const rel = path.relative(distPath, filePath).replace(/\\/g, "/");
        if (rel.startsWith("assets/")) {
            // Content-hashed filenames: safe to cache forever.
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        } else if (/^(sw\.js|registerSW\.js|workbox-.*\.js|manifest\.webmanifest|index\.html)$/.test(rel)) {
            // Must revalidate, or installed PWAs never see updates.
            res.setHeader("Cache-Control", "no-cache");
        }
    },
}));

app.get("/health", (req, res) => {
    // Polled by the wake-up screen, possibly from a separately hosted frontend.
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ status: "ok" });
});

app.get("/api/qr", async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");

    const room = req.query.room;

    if (!/^[A-Za-z0-9-]{4,50}$/.test(room || "")) {
        return res.status(400).json({
            error: "Invalid room ID"
        });
    }

    try {
        const baseUrl = getBaseUrl(req);
        const joinUrl = `${baseUrl}/receive?room=${encodeURIComponent(room)}`;

        const qr = await QRCode.toDataURL(joinUrl);

        res.json({
            qr,
            joinUrl
        });
    } catch (error) {
        res.status(500).json({
            error: "QR generation failed"
        });
    }
});

const heartbeatInterval = setInterval(() => {
    wss.clients.forEach(socket => {
        if (socket.isAlive === false) {
            return socket.terminate();
        }
        socket.isAlive = false;
        socket.ping();
    });
}, 25000);

wss.on("close", () => {
    clearInterval(heartbeatInterval);
});

wss.on("connection", socket => {
    socket.isAlive = true;
    socket.on("pong", () => {
        socket.isAlive = true;
    });

    let roomId = null;
    let joinAttempts = 0;
    // Without a listener, any bad frame (oversized, malformed) is an unhandled error that kills the server.
    socket.on("error", () => socket.terminate());

    socket.on("message", message => {
        let data;

        try {
            data = JSON.parse(message);
        } catch {
            return;
        }
        // `null` / numbers parse fine and would crash the process on `data.type`.
        if (!data || typeof data !== "object") return;

        if (data.type === "join") {
            if (roomId) return;
            // Slow down room-code guessing: a socket gets a few join attempts, then is dropped.
            if (++joinAttempts > 5) return socket.terminate();

            if (!/^[A-Za-z0-9-]{4,50}$/.test(data.room || "")) {
                return;
            }

            roomId = data.room;

            if (!rooms.has(roomId)) {
                rooms.set(roomId, new Set());
            }

            const room = rooms.get(roomId);

            if (room.size >= 2) {
                socket.send(JSON.stringify({
                    type: "error",
                    message: "Room is full"
                }));

                roomId = null;
                return;
            }

            room.add(socket);

            socket.send(JSON.stringify({
                type: "joined"
            }));

            if (room.size === 2) {
                room.forEach(client => {
                    client.send(JSON.stringify({
                        type: "peer-joined"
                    }));
                });
            }

            return;
        }

        if (!roomId) return;

        const allowed = [
            "offer",
            "answer",
            "ice-candidate"
        ];

        if (!allowed.includes(data.type)) return;

        const room = rooms.get(roomId);
        if (!room) return;

        room.forEach(client => {
            if (
                client !== socket &&
                client.readyState === WebSocket.OPEN
            ) {
                client.send(message.toString());
            }
        });
    });

    socket.on("close", () => {
        if (!roomId || !rooms.has(roomId)) return;

        const room = rooms.get(roomId);
        room.delete(socket);

        room.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: "peer-left" }));
            }
        });

        if (room.size === 0) {
            rooms.delete(roomId);
        }
    });
});

const indexPath = path.join(distPath, "index.html");
app.use((req, res) => {
    if (!fs.existsSync(indexPath)) {
        return res.status(503).send("Frontend not built. Run `npm run build` (or `npm run dev` for development).");
    }
    res.setHeader("Cache-Control", "no-cache");
    // Same SPA shell either way (the app renders its 404 page), but unknown paths get a real 404 status.
    const knownRoute = ["/", "/send", "/receive"].includes(req.path.replace(/\/$/, "") || "/");
    res.status(knownRoute ? 200 : 404).sendFile(indexPath);
});

server.listen(PORT, "0.0.0.0", () => {
    console.log(`MeshLink running on port ${PORT}`);
});
