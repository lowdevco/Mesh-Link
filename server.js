
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const QRCode = require("qrcode");
const path = require("path");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;
const rooms = new Map();
const distPath = path.join(__dirname, "dist");

function getBaseUrl(req) {
    if (process.env.FRONTEND_URL) {
        return process.env.FRONTEND_URL.replace(/\/$/, "");
    }
    const protocol = req.headers["x-forwarded-proto"] || req.protocol || "http";
    const host = req.get("host") || `localhost:${PORT}`;
    return `${protocol}://${host}`;
}

// Serve dist if built, otherwise serve project root
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
} else {
    app.use(express.static(__dirname));
}

app.get("/health", (req, res) => {
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
        const joinUrl =
            `${baseUrl}/receive?room=${encodeURIComponent(room)}&role=receive`;

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

    socket.on("message", message => {
        let data;

        try {
            data = JSON.parse(message);
        } catch {
            return;
        }

        if (data.type === "join") {
            if (roomId) return;

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
            client.send(JSON.stringify({
                type: "peer-left"
            }));
        });

        if (room.size === 0) {
            rooms.delete(roomId);
        }
    });
});

app.use((req, res) => {
    const indexPath = fs.existsSync(distPath)
        ? path.join(distPath, "index.html")
        : path.join(__dirname, "index.html");
    res.sendFile(indexPath);
});

server.listen(PORT, "0.0.0.0", () => {
    console.log(`MeshLink running on port ${PORT}`);
});
