import { SpeedTracker } from "./speedTracker";
import { notifyTransferComplete } from "./notifications";
import { formatBytes } from "./deviceInfo";

// Set VITE_ICE_SERVERS (JSON array) at build time to add a TURN relay; STUN alone fails on strict NATs.
const ICE_SERVERS = import.meta.env.VITE_ICE_SERVERS
  ? JSON.parse(import.meta.env.VITE_ICE_SERVERS)
  : [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ];

const LARGE_FILE_THRESHOLD = 300 * 1024 * 1024; // 300 MB threshold
const CHUNK_SIZE = 64 * 1024;
const BUFFER_LIMIT = 4 * 1024 * 1024;
const SIGNAL_TIMEOUT = 15000;
const PROGRESS_INTERVAL_MS = 100; // per-chunk setState re-rendered React thousands of times a second

// Peer-supplied paths end up in ZIP entries: drop "..", absolute and drive prefixes.
function safeRelativePath(path, fallback) {
  const parts = String(path || "")
    .split(/[\\/]+/)
    .filter((p) => p && p !== "." && p !== ".." && !/^[A-Za-z]:$/.test(p));
  return parts.length ? parts.join("/") : fallback;
}

// Peer-supplied MIME types must not let a blob: URL render as HTML/SVG/JS in our origin.
function safeMimeType(type) {
  return !type || /html|xml|svg|javascript/i.test(type) ? "application/octet-stream" : type;
}

function isDirectDiskSupported() {
  return typeof window !== "undefined" && "showSaveFilePicker" in window;
}

// VITE_BACKEND_URL lets the frontend live on a static host (never sleeps) while signalling runs elsewhere.
export function getBackendUrls() {
  const isHttp = window.location.protocol.startsWith("http");
  const backendUrl =
    (import.meta.env.VITE_BACKEND_URL || "").replace(/\/$/, "") ||
    (isHttp ? window.location.origin : "http://localhost:3000");
  return { backendUrl, wsUrl: backendUrl.replace(/^http/, "ws") + "/ws" };
}

export class MeshLinkConnection {
  constructor({
    role, // "send" | "receive"
    room,
    onStatusChange,
    onPeerConnected,
    onPeerDisconnected,
    onSendProgress,
    onReceiveProgress,
    onFileReceived,
    onLargeFileDetected,
    onTransferCancelled,
  }) {
    this.role = role;
    this.room = room;

    this.onStatusChange = onStatusChange || (() => {});
    this.onPeerConnected = onPeerConnected || (() => {});
    this.onPeerDisconnected = onPeerDisconnected || (() => {});
    this.onSendProgress = onSendProgress || (() => {});
    this.onReceiveProgress = onReceiveProgress || (() => {});
    this.onFileReceived = onFileReceived || (() => {});
    this.onLargeFileDetected = onLargeFileDetected || (() => {});
    this.onTransferCancelled = onTransferCancelled || (() => {});

    this.ws = null;
    this.pc = null;
    this.channel = null;
    this.connected = false;
    this.isClosed = false;
    this.isTransferCancelled = false;

    this.pendingCandidates = [];

    this.incoming = null;
    this.readyResolvers = new Map();

    this.sendSpeedTracker = new SpeedTracker();
    this.receiveSpeedTracker = new SpeedTracker();
    this.lastProgressAt = 0;
  }

  shouldEmitProgress(force) {
    const now = Date.now();
    if (!force && now - this.lastProgressAt < PROGRESS_INTERVAL_MS) return false;
    this.lastProgressAt = now;
    return true;
  }

  // Unblock a sender waiting on the receiver's choice (cancel / disconnect).
  releaseReadyWaiters() {
    this.readyResolvers.forEach((resolve) => resolve(null));
    this.readyResolvers.clear();
  }

  async connect() {
    const { wsUrl } = getBackendUrls();
    this.onStatusChange("Connecting to signalling server…", "warn");

    return new Promise((resolve, reject) => {
      let settled = false;
      const ws = new WebSocket(wsUrl);
      this.ws = ws;

      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          this.close();
          const err = new Error("Signalling server connection timed out.");
          this.onStatusChange(err.message, "bad");
          reject(err);
        }
      }, SIGNAL_TIMEOUT);

      ws.onopen = () => {
        try {
          ws.send(JSON.stringify({ type: "join", room: this.room }));
        } catch (e) {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            reject(e);
          }
        }
      };

      ws.onmessage = async (event) => {
        if (this.ws !== ws || this.isClosed) return;
        let data;
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }

        if (data.type === "joined") {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve();
          }
          this.onStatusChange("Waiting for peer to connect…", "warn");
          return;
        }

        if (data.type === "peer-joined") {
          this.onStatusChange("Peer discovered. Establishing direct link…", "warn");
          if (this.role === "send") {
            await this.startOffer();
          }
          return;
        }

        if (data.type === "offer") {
          if (this.role === "receive") {
            await this.handleOffer(data.sdp);
          }
          return;
        }

        if (data.type === "answer") {
          if (this.pc && this.pc.signalingState === "have-local-offer") {
            try {
              await this.pc.setRemoteDescription({ type: "answer", sdp: data.sdp });
              await this.flushCandidates();
            } catch (e) {
              console.warn("Error setting remote answer:", e);
            }
          }
          return;
        }

        if (data.type === "ice-candidate") {
          if (!data.candidate) return;
          if (this.pc && this.pc.remoteDescription) {
            try {
              await this.pc.addIceCandidate(data.candidate);
            } catch (e) {
              console.warn("ICE candidate error:", e);
            }
          } else {
            this.pendingCandidates.push(data.candidate);
          }
          return;
        }

        if (data.type === "peer-left") {
          this.onStatusChange("Connected peer disconnected.", "warn");
          this.connected = false;
          this.onPeerDisconnected();
          this.resetPeer();
          return;
        }

        if (data.type === "error") {
          const err = new Error(data.message || "Signalling error");
          this.onStatusChange(err.message, "bad");
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            reject(err);
          }
        }
      };

      ws.onerror = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          const err = new Error("Could not connect to signalling server.");
          this.onStatusChange(err.message, "bad");
          reject(err);
        }
      };

      ws.onclose = () => {
        if (!this.isClosed) {
          this.onStatusChange("Signalling connection closed.", "bad");
        }
      };
    });
  }

  sendSignal(payload) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  createPeerConnection() {
    this.resetPeer();
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.pc = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.sendSignal({ type: "ice-candidate", candidate: e.candidate });
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (!this.pc) return;
      const st = this.pc.iceConnectionState;
      if (st === "connected" || st === "completed") {
        this.connected = true;
      } else if (st === "failed") {
        this.onStatusChange("Direct connection failed.", "bad");
        this.connected = false;
        this.onPeerDisconnected();
      } else if (st === "disconnected") {
        // Usually transient and ICE recovers; "failed" / channel close handle a real loss.
        this.onStatusChange("Connection unstable, reconnecting…", "warn");
      }
    };

    pc.ondatachannel = (e) => {
      this.attachChannel(e.channel);
    };

    return pc;
  }

  attachChannel(channel) {
    this.channel = channel;
    channel.binaryType = "arraybuffer";
    // Default is 0, which made the sender stall until the buffer fully drained.
    channel.bufferedAmountLowThreshold = BUFFER_LIMIT / 2;

    channel.onopen = () => {
      this.connected = true;
      this.onStatusChange("Direct P2P link connected!", "good");
      this.onPeerConnected(this.role === "send" ? "Receiving device" : "Sending device");
    };

    channel.onclose = () => {
      this.connected = false;
      this.onStatusChange("Direct link closed.", "warn");
      this.onPeerDisconnected();
    };

    channel.onerror = (e) => {
      console.warn("DataChannel error:", e);
    };

    channel.onmessage = (event) => {
      this.handleIncomingData(event.data);
    };
  }

  async startOffer() {
    try {
      const pc = this.createPeerConnection();
      const channel = pc.createDataChannel("meshlink-files", { ordered: true });
      this.attachChannel(channel);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.sendSignal({ type: "offer", sdp: pc.localDescription.sdp });
    } catch (e) {
      this.onStatusChange("Could not create offer: " + e.message, "bad");
    }
  }

  async handleOffer(sdp) {
    try {
      const pc = this.createPeerConnection();
      await pc.setRemoteDescription({ type: "offer", sdp });
      await this.flushCandidates();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.sendSignal({ type: "answer", sdp: pc.localDescription.sdp });
    } catch (e) {
      this.onStatusChange("Could not answer connection: " + e.message, "bad");
    }
  }

  async flushCandidates() {
    if (!this.pc || !this.pc.remoteDescription) return;
    const queued = this.pendingCandidates.splice(0);
    for (const c of queued) {
      try {
        await this.pc.addIceCandidate(c);
      } catch (e) {
        console.warn("Flush candidate error:", e);
      }
    }
  }

  async handleIncomingData(data) {
    if (typeof data === "string") {
      let msg;
      try {
        msg = JSON.parse(data);
      } catch {
        return;
      }

      // Handling transfer cancellation
      if (msg.type === "transfer-cancelled") {
        this.isTransferCancelled = true;
        this.releaseReadyWaiters();
        if (this.incoming) {
          if (this.incoming.writable) {
            try {
              await this.incoming.writable.abort();
            } catch {}
            this.incoming.writable = null;
          }
          this.incoming = null;
        }
        const senderOrReceiver = msg.by === "receiver" ? "receiver" : "sender";
        this.onStatusChange(`Transfer cancelled by ${senderOrReceiver}.`, "warn");
        this.onTransferCancelled(senderOrReceiver);
        return;
      }

      // Sender acknowledging receiver is ready to stream
      if (msg.type === "file-ready") {
        if (this.readyResolvers.has(msg.id)) {
          const resolver = this.readyResolvers.get(msg.id);
          this.readyResolvers.delete(msg.id);
          resolver(msg);
        }
        return;
      }

      if (msg.type === "file-meta") {
        const size = Number(msg.size);
        if (!Number.isSafeInteger(size) || size < 0) return;
        const name = safeRelativePath(String(msg.name || "").split(/[\\/]/).pop(), "file");
        const relativePath = safeRelativePath(msg.relativePath, name);
        const mimeType = safeMimeType(msg.mimeType);
        const isLarge = size >= LARGE_FILE_THRESHOLD;
        const supportsDisk = isDirectDiskSupported();

        this.isTransferCancelled = false;
        this.receiveSpeedTracker.reset();

        this.incoming = {
          id: msg.id,
          name,
          relativePath,
          size,
          mimeType,
          mode: isLarge && supportsDisk ? "pending" : "ram",
          chunks: [],
          receivedBytes: 0,
          writable: null,
          writePromise: Promise.resolve(),
        };

        if (isLarge && supportsDisk) {
          // Trigger smart analyzing prompt on receiver UI
          this.onLargeFileDetected({ id: msg.id, name, relativePath, size, mimeType });
        } else {
          // Automatic mode: immediately confirm ready to sender
          if (this.channel && this.channel.readyState === "open") {
            this.channel.send(
              JSON.stringify({
                type: "file-ready",
                id: msg.id,
                mode: "ram",
              })
            );
          }
          this.onReceiveProgress({
            fileName: name,
            currentBytes: 0,
            totalBytes: size,
            percent: 0,
            speedText: "",
            etaText: "",
            mode: "ram",
          });
        }
      } else if (msg.type === "file-done") {
        if (!this.incoming || this.incoming.id !== msg.id) return;
        const inc = this.incoming;

        let item;

        if (inc.mode === "disk" && inc.writable) {
          try {
            await inc.writePromise;
            await inc.writable.close();
            inc.writable = null;
          } catch (e) {
            console.warn("Error finalizing disk stream:", e);
          }

          item = {
            id: inc.id,
            name: inc.name,
            relativePath: inc.relativePath,
            size: inc.size,
            mimeType: inc.mimeType,
            savedToDisk: true,
          };
        } else {
          // RAM mode: construct Blob and trigger download
          const blob = new Blob(inc.chunks, { type: inc.mimeType });
          inc.chunks = [];
          const url = URL.createObjectURL(blob);
          item = {
            id: inc.id,
            name: inc.name,
            relativePath: inc.relativePath,
            size: inc.size,
            mimeType: inc.mimeType,
            blob,
            url,
            savedToDisk: false,
          };

          try {
            const a = document.createElement("a");
            a.href = url;
            a.download = inc.name;
            document.body.appendChild(a);
            a.click();
            a.remove();
          } catch (e) {
            console.warn("Auto-download prompt error:", e);
          }
        }

        this.onFileReceived(item);

        // Play chime and send browser notification
        notifyTransferComplete(inc.name, formatBytes(inc.size));

        this.onReceiveProgress({
          fileName: inc.name,
          currentBytes: inc.size,
          totalBytes: inc.size,
          percent: 100,
          speedText: "Complete",
          etaText: "Done",
          mode: inc.mode,
        });
        this.incoming = null;
      }
    } else if (data instanceof ArrayBuffer) {
      if (!this.incoming) return;
      const inc = this.incoming;
      // Ignore data before the receiver picked a mode, or beyond the declared size (memory DoS).
      if (inc.mode === "pending" || inc.receivedBytes + data.byteLength > inc.size) return;

      inc.receivedBytes += data.byteLength;

      if (inc.mode === "disk" && inc.writable) {
        // Stream directly to hard drive (zero RAM allocation)
        inc.writePromise = inc.writePromise.then(() => inc.writable.write(data));
      } else {
        // In-memory RAM buffer
        inc.chunks.push(data);
      }

      const speedStats = this.receiveSpeedTracker.update(inc.receivedBytes, inc.size);
      if (!this.shouldEmitProgress(inc.receivedBytes === inc.size)) return;

      this.onReceiveProgress({
        fileName: inc.name,
        currentBytes: inc.receivedBytes,
        totalBytes: inc.size,
        percent: Math.min(100, Math.round((inc.receivedBytes / inc.size) * 100)),
        speedText: speedStats.speedText,
        etaText: speedStats.etaText,
        mode: inc.mode,
      });
    }
  }

  async acceptDirectDisk(fileId) {
    if (!this.incoming || this.incoming.id !== fileId || this.incoming.mode !== "pending") return;

    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: this.incoming.name,
      });
      const writable = await handle.createWritable();
      if (!this.incoming || this.incoming.id !== fileId) {
        await writable.abort();
        return;
      }
      this.incoming.writable = writable;
      this.incoming.mode = "disk";

      if (this.channel && this.channel.readyState === "open") {
        this.channel.send(
          JSON.stringify({
            type: "file-ready",
            id: fileId,
            mode: "disk",
          })
        );
      }

      this.onReceiveProgress({
        fileName: this.incoming.name,
        currentBytes: 0,
        totalBytes: this.incoming.size,
        percent: 0,
        speedText: "Starting direct disk stream…",
        etaText: "",
        mode: "disk",
      });
    } catch (e) {
      console.warn("User cancelled disk picker, falling back to RAM:", e);
      this.acceptRamMode(fileId);
    }
  }

  acceptRamMode(fileId) {
    if (!this.incoming || this.incoming.id !== fileId || this.incoming.mode !== "pending") return;
    this.incoming.mode = "ram";

    if (this.channel && this.channel.readyState === "open") {
      this.channel.send(
        JSON.stringify({
          type: "file-ready",
          id: fileId,
          mode: "ram",
        })
      );
    }

    this.onReceiveProgress({
      fileName: this.incoming.name,
      currentBytes: 0,
      totalBytes: this.incoming.size,
      percent: 0,
      speedText: "Starting RAM buffer stream…",
      etaText: "",
      mode: "ram",
    });
  }

  async cancelTransfer() {
    this.isTransferCancelled = true;
    this.releaseReadyWaiters();
    if (this.channel && this.channel.readyState === "open") {
      try {
        this.channel.send(
          JSON.stringify({
            type: "transfer-cancelled",
            by: this.role === "send" ? "sender" : "receiver",
          })
        );
      } catch {}
    }

    if (this.incoming) {
      if (this.incoming.writable) {
        try {
          await this.incoming.writable.abort();
        } catch {}
        this.incoming.writable = null;
      }
      this.incoming = null;
    }

    this.onStatusChange("Transfer cancelled.", "warn");
    this.onTransferCancelled("user");
  }

  // No timeout: streaming before the receiver chose a mode corrupted the file. Cancel/disconnect release it.
  waitForReceiverReady(fileId) {
    return new Promise((resolve) => this.readyResolvers.set(fileId, resolve));
  }

  async waitForBuffer() {
    const ch = this.channel;
    if (!ch) throw new Error("Connection closed");

    return new Promise((resolve, reject) => {
      const done = (err) => {
        ch.removeEventListener("bufferedamountlow", tick);
        ch.removeEventListener("close", tick);
        err ? reject(err) : resolve();
      };
      const tick = () => {
        if (ch.readyState !== "open") done(new Error("Connection closed"));
        else if (ch.bufferedAmount <= BUFFER_LIMIT) done();
      };
      ch.addEventListener("bufferedamountlow", tick);
      ch.addEventListener("close", tick);
      tick();
    });
  }

  async sendFiles(fileList) {
    if (!this.channel || this.channel.readyState !== "open") {
      throw new Error("Direct link is not connected.");
    }

    this.isTransferCancelled = false;
    this.lastProgressAt = 0;
    const totalBytes = fileList.reduce((acc, f) => acc + f.size, 0);
    let sentTotalBytes = 0;
    this.sendSpeedTracker.reset();

    for (let i = 0; i < fileList.length; i++) {
      if (this.isTransferCancelled) break;
      const file = fileList[i];
      const fileId = `${Date.now()}-${i}-${file.name}`;
      const isLarge = file.size >= LARGE_FILE_THRESHOLD;
      const relativePath = file.webkitRelativePath || file.name;

      // 1. Send file metadata
      this.channel.send(
        JSON.stringify({
          type: "file-meta",
          id: fileId,
          name: file.name,
          relativePath,
          size: file.size,
          mimeType: file.type || "application/octet-stream",
        })
      );

      // If large file, wait for receiver's chosen mode
      if (isLarge) {
        this.onStatusChange(
          `Waiting for receiver to choose location for "${file.name}"…`,
          "warn"
        );
        const readyInfo = await this.waitForReceiverReady(fileId);
        if (this.isTransferCancelled) throw new Error("Transfer cancelled.");
        if (!readyInfo) throw new Error("Connection lost during transfer.");
        this.onStatusChange(
          readyInfo.mode === "disk"
            ? `Streaming "${file.name}" directly to receiver disk…`
            : `Streaming "${file.name}" to receiver memory…`,
          "good"
        );
      }

      // 2. Stream chunks
      let offset = 0;
      while (offset < file.size) {
        if (this.isTransferCancelled) {
          throw new Error("Transfer cancelled.");
        }
        if (!this.channel || this.channel.readyState !== "open") {
          throw new Error("Connection lost during transfer.");
        }

        if (this.channel.bufferedAmount > BUFFER_LIMIT) {
          await this.waitForBuffer();
        }

        const slice = file.slice(offset, offset + CHUNK_SIZE);
        const buffer = await slice.arrayBuffer();
        this.channel.send(buffer);

        offset += buffer.byteLength;
        sentTotalBytes += buffer.byteLength;

        const speedStats = this.sendSpeedTracker.update(sentTotalBytes, totalBytes);
        if (!this.shouldEmitProgress(offset >= file.size)) continue;

        this.onSendProgress({
          currentFile: file.name,
          currentBytes: sentTotalBytes,
          totalBytes,
          percent: Math.min(100, Math.round((sentTotalBytes / totalBytes) * 100)),
          speedText: speedStats.speedText,
          etaText: speedStats.etaText,
        });
      }

      // 3. Send file-done
      this.channel.send(JSON.stringify({ type: "file-done", id: fileId }));
    }
  }

  resetPeer() {
    if (this.channel) {
      try {
        this.channel.close();
      } catch {}
      this.channel = null;
    }
    if (this.pc) {
      try {
        this.pc.close();
      } catch {}
      this.pc = null;
    }
    this.pendingCandidates = [];
    this.releaseReadyWaiters();
  }

  close() {
    this.isClosed = true;
    this.resetPeer();
    if (this.ws) {
      this.ws.onopen = this.ws.onmessage = this.ws.onerror = this.ws.onclose = null;
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
  }
}
