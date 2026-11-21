const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

const CHUNK_SIZE = 64 * 1024;
const BUFFER_LIMIT = 4 * 1024 * 1024;
const SIGNAL_TIMEOUT = 15000;

export function getBackendUrls() {
  const isHttp = window.location.protocol.startsWith("http");
  const backendUrl = isHttp ? window.location.origin : "http://localhost:3000";
  const wsUrl = isHttp
    ? (window.location.protocol === "https:" ? "wss://" : "ws://") + window.location.host
    : "ws://localhost:3000";
  return { backendUrl, wsUrl };
}

export class MeshLinkConnection {
  constructor({
    role, // "send" | "receive"
    room,
    localDevice,
    onStatusChange,
    onPeerConnected,
    onPeerDisconnected,
    onSendProgress,
    onReceiveProgress,
    onFileReceived,
  }) {
    this.role = role;
    this.room = room;
    this.localDevice = localDevice;

    this.onStatusChange = onStatusChange || (() => {});
    this.onPeerConnected = onPeerConnected || (() => {});
    this.onPeerDisconnected = onPeerDisconnected || (() => {});
    this.onSendProgress = onSendProgress || (() => {});
    this.onReceiveProgress = onReceiveProgress || (() => {});
    this.onFileReceived = onFileReceived || (() => {});

    this.ws = null;
    this.pc = null;
    this.channel = null;
    this.connected = false;
    this.isClosed = false;

    this.makingOffer = false;
    this.pendingCandidates = [];

    this.incoming = null;
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
        this.onStatusChange("Connection lost.", "warn");
        this.connected = false;
        this.onPeerDisconnected();
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
    this.makingOffer = true;
    try {
      const pc = this.createPeerConnection();
      this.makingOffer = true;
      const channel = pc.createDataChannel("meshlink-files", { ordered: true });
      this.attachChannel(channel);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.sendSignal({ type: "offer", sdp: pc.localDescription.sdp });
    } catch (e) {
      this.onStatusChange("Could not create offer: " + e.message, "bad");
    } finally {
      this.makingOffer = false;
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

  handleIncomingData(data) {
    if (typeof data === "string") {
      let msg;
      try {
        msg = JSON.parse(data);
      } catch {
        return;
      }

      if (msg.type === "file-meta") {
        this.incoming = {
          id: msg.id,
          name: msg.name,
          size: msg.size,
          mimeType: msg.mimeType,
          chunks: [],
          receivedBytes: 0,
          startTime: Date.now(),
        };
        this.onReceiveProgress({
          fileName: msg.name,
          currentBytes: 0,
          totalBytes: msg.size,
          percent: 0,
        });
      } else if (msg.type === "file-done") {
        if (!this.incoming || this.incoming.id !== msg.id) return;
        const blob = new Blob(this.incoming.chunks, {
          type: this.incoming.mimeType || "application/octet-stream",
        });
        const url = URL.createObjectURL(blob);
        const item = {
          id: this.incoming.id,
          name: this.incoming.name,
          size: this.incoming.size,
          url,
        };

        this.onFileReceived(item);

        // Auto trigger download
        try {
          const a = document.createElement("a");
          a.href = url;
          a.download = this.incoming.name;
          document.body.appendChild(a);
          a.click();
          a.remove();
        } catch (e) {
          console.warn("Auto-download prompt error:", e);
        }

        this.onReceiveProgress({
          fileName: this.incoming.name,
          currentBytes: this.incoming.size,
          totalBytes: this.incoming.size,
          percent: 100,
        });
        this.incoming = null;
      }
    } else if (data instanceof ArrayBuffer) {
      if (!this.incoming) return;
      this.incoming.chunks.push(data);
      this.incoming.receivedBytes += data.byteLength;

      const percent = Math.min(
        100,
        Math.round((this.incoming.receivedBytes / this.incoming.size) * 100)
      );

      this.onReceiveProgress({
        fileName: this.incoming.name,
        currentBytes: this.incoming.receivedBytes,
        totalBytes: this.incoming.size,
        percent,
      });
    }
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

    const totalBytes = fileList.reduce((acc, f) => acc + f.size, 0);
    let sentTotalBytes = 0;

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const fileId = `${Date.now()}-${i}-${file.name}`;

      // 1. Send file metadata
      this.channel.send(
        JSON.stringify({
          type: "file-meta",
          id: fileId,
          name: file.name,
          size: file.size,
          mimeType: file.type || "application/octet-stream",
        })
      );

      // 2. Stream chunks
      let offset = 0;
      while (offset < file.size) {
        if (this.channel.readyState !== "open") {
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

        const percent = Math.min(100, Math.round((sentTotalBytes / totalBytes) * 100));
        this.onSendProgress({
          currentFile: file.name,
          currentBytes: sentTotalBytes,
          totalBytes,
          percent,
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
