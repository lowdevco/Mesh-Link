import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Download, ArrowRight, CheckCircle2, FileText } from "lucide-react";
import DeviceCard from "../components/DeviceCard";
import StatusBadge from "../components/StatusBadge";
import { getDeviceInfo, formatBytes } from "../utils/deviceInfo";
import { MeshLinkConnection } from "../utils/webrtc";

export default function ReceivePage() {
  const [searchParams] = useSearchParams();
  const [localDevice] = useState(() => getDeviceInfo());
  const [remoteDevice, setRemoteDevice] = useState(null);
  const [roomInput, setRoomInput] = useState("");
  const [status, setStatus] = useState({ text: "Waiting to connect", type: "idle" });
  const [isConnecting, setIsConnecting] = useState(false);

  const [receivedFiles, setReceivedFiles] = useState([]);
  const [receiveProgress, setReceiveProgress] = useState(null);

  const connRef = useRef(null);

  const connectToRoom = async (code) => {
    const cleanRoom = (code || "").trim().toUpperCase();
    if (!/^[A-Z0-9-]{4,50}$/.test(cleanRoom)) {
      setStatus({ text: "Enter a valid room code.", type: "bad" });
      return;
    }

    if (connRef.current) {
      connRef.current.close();
    }

    setIsConnecting(true);
    setRemoteDevice(null);

    const connection = new MeshLinkConnection({
      role: "receive",
      room: cleanRoom,
      localDevice,
      onStatusChange: (text, type) => {
        setStatus({ text, type });
        if (type === "bad" || type === "good") {
          setIsConnecting(false);
        }
      },
      onPeerConnected: (peerName) => {
        setRemoteDevice(peerName || "Sending device");
        setIsConnecting(false);
      },
      onPeerDisconnected: () => {
        setRemoteDevice(null);
        setIsConnecting(false);
      },
      onReceiveProgress: (prog) => {
        setReceiveProgress(prog);
      },
      onFileReceived: (fileItem) => {
        setReceivedFiles((prev) => [fileItem, ...prev]);
        setReceiveProgress(null);
      },
    });

    connRef.current = connection;

    try {
      await connection.connect();
    } catch (e) {
      setIsConnecting(false);
    }
  };

  // Auto-connect if ?room=ABCD is in query params
  useEffect(() => {
    const queryRoom = searchParams.get("room");
    if (queryRoom && /^[A-Z0-9-]{4,50}$/i.test(queryRoom)) {
      setRoomInput(queryRoom.toUpperCase());
      connectToRoom(queryRoom.toUpperCase());
    }

    return () => {
      if (connRef.current) {
        connRef.current.close();
      }
    };
  }, [searchParams]);

  const handleSubmit = (e) => {
    e.preventDefault();
    connectToRoom(roomInput);
  };

  return (
    <div className="panel">
      <h2>Receive Files</h2>
      <p className="sub">
        Enter the room code from the sending device or open a QR pairing link on
        this device.
      </p>

      <form onSubmit={handleSubmit} className="field">
        <input
          type="text"
          maxLength={50}
          placeholder="ENTER ROOM CODE"
          value={roomInput}
          onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
          autoComplete="off"
          spellCheck="false"
          disabled={isConnecting}
        />
        <button type="submit" disabled={isConnecting || !roomInput.trim()}>
          <span>{isConnecting ? "Connecting…" : "Connect"}</span>
          <ArrowRight size={16} />
        </button>
      </form>

      <StatusBadge status={status.text} type={status.type} />

      <DeviceCard
        label="This device"
        name={localDevice.name}
        iconType={localDevice.iconType}
      />

      <DeviceCard
        label="Sending device"
        name={remoteDevice ? remoteDevice : "Not connected"}
        iconType="remote"
      />

      {/* Live Receive Progress */}
      {receiveProgress && (
        <div className="progress-wrap">
          <div className="progress-head">
            <span>Receiving {receiveProgress.fileName}…</span>
            <span>{receiveProgress.percent}%</span>
          </div>
          <div className="track">
            <div
              className="bar"
              style={{ width: `${receiveProgress.percent}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Received Files List */}
      {receivedFiles.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3
            style={{
              fontSize: 15,
              fontWeight: 700,
              margin: "0 0 12px",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <CheckCircle2 size={16} color="var(--green)" />
            <span>Received Files ({receivedFiles.length})</span>
          </h3>

          <div className="filelist">
            {receivedFiles.map((file) => (
              <div key={file.id} className="fileitem">
                <div className="fileitem-info">
                  <FileText size={16} color="var(--blue)" />
                  <span className="fileitem-name">{file.name}</span>
                </div>
                <div className="fileitem-meta">
                  <span className="muted">{formatBytes(file.size)}</span>
                  <a
                    href={file.url}
                    download={file.name}
                    className="fileitem-download"
                  >
                    <Download size={14} />
                    <span>Download</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="hint">
        Keep this page open while files transfer. Files stream directly into your
        browser memory and prompt for download as soon as each transfer completes.
      </p>
    </div>
  );
}
