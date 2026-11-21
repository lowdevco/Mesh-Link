import React, { useState, useEffect, useRef } from "react";
import {
  Send,
  Copy,
  Check,
  Plus,
  Trash2,
  FileText,
  UploadCloud,
  CheckCircle2,
} from "lucide-react";
import DeviceCard from "../components/DeviceCard";
import StatusBadge from "../components/StatusBadge";
import { getDeviceInfo, formatBytes, makeRoomCode } from "../utils/deviceInfo";
import { MeshLinkConnection, getBackendUrls } from "../utils/webrtc";

export default function SendPage() {
  const [localDevice] = useState(() => getDeviceInfo());
  const [remoteDevice, setRemoteDevice] = useState(null);
  const [room, setRoom] = useState("");
  const [qrSrc, setQrSrc] = useState("");
  const [status, setStatus] = useState({ text: "Not connected", type: "idle" });
  const [isRoomCreated, setIsRoomCreated] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const [selectedFiles, setSelectedFiles] = useState([]);
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState({
    currentFile: "",
    percent: 0,
    totalBytes: 0,
    currentBytes: 0,
  });
  const [dragOver, setDragOver] = useState(false);

  const connRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    return () => {
      if (connRef.current) {
        connRef.current.close();
      }
    };
  }, []);

  const handleCreateRoom = async () => {
    if (connRef.current) {
      connRef.current.close();
    }

    const roomCode = makeRoomCode();
    setRoom(roomCode);
    setIsRoomCreated(true);
    setRemoteDevice(null);
    setSelectedFiles([]);
    setSending(false);

    const { backendUrl } = getBackendUrls();

    // 1. Fetch QR code
    try {
      const res = await fetch(`${backendUrl}/api/qr?room=${encodeURIComponent(roomCode)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.qr) setQrSrc(data.qr);
      }
    } catch (e) {
      console.warn("QR generation fetch error:", e);
    }

    // 2. Initialize connection
    const connection = new MeshLinkConnection({
      role: "send",
      room: roomCode,
      localDevice,
      onStatusChange: (text, type) => {
        setStatus({ text, type });
      },
      onPeerConnected: (peerName) => {
        setRemoteDevice(peerName || "Receiving device");
      },
      onPeerDisconnected: () => {
        setRemoteDevice(null);
      },
      onSendProgress: ({ currentFile, currentBytes, totalBytes, percent }) => {
        setSendProgress({ currentFile, currentBytes, totalBytes, percent });
      },
    });

    connRef.current = connection;

    try {
      await connection.connect();
    } catch (err) {
      console.warn("Connection error:", err);
    }
  };

  const handleCopyCode = async () => {
    if (!room) return;
    await navigator.clipboard.writeText(room);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = async () => {
    if (!room) return;
    const url = `${window.location.origin}/receive?room=${encodeURIComponent(room)}&role=receive`;
    await navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleFilesAdded = (files) => {
    const arr = Array.from(files || []);
    if (arr.length === 0) return;
    setSelectedFiles((prev) => [...prev, ...arr]);
  };

  const handleRemoveFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSendFiles = async () => {
    if (!connRef.current || selectedFiles.length === 0) return;
    setSending(true);
    try {
      await connRef.current.sendFiles(selectedFiles);
      setStatus({ text: "All files sent successfully!", type: "good" });
      setSelectedFiles([]);
    } catch (err) {
      setStatus({ text: `Send failed: ${err.message}`, type: "bad" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="panel">
      <h2>Send Files</h2>
      <p className="sub">
        Create a sharing room, then connect your receiving device using its room
        code, link, or QR code.
      </p>

      {!isRoomCreated ? (
        <button className="action" onClick={handleCreateRoom}>
          <Send size={18} />
          <span>Create sharing room</span>
        </button>
      ) : (
        <div>
          <div className="code">{room}</div>
          <div className="hint" style={{ textAlign: "center" }}>
            Enter this code on the receiving device, or scan the QR code below.
          </div>

          {qrSrc && (
            <div className="qrbox">
              <img src={qrSrc} alt="Room QR Code" />
            </div>
          )}

          <div className="row">
            <button className="action secondary" onClick={handleCopyCode}>
              {copiedCode ? <Check size={16} /> : <Copy size={16} />}
              <span>{copiedCode ? "Copied!" : "Copy room code"}</span>
            </button>
            <button className="action secondary" onClick={handleCopyLink}>
              {copiedLink ? <Check size={16} /> : <Copy size={16} />}
              <span>{copiedLink ? "Copied!" : "Copy join link"}</span>
            </button>
          </div>
        </div>
      )}

      <StatusBadge status={status.text} type={status.type} />

      <DeviceCard
        label="This device"
        name={localDevice.name}
        iconType={localDevice.iconType}
      />

      <DeviceCard
        label="Connected device"
        name={remoteDevice ? remoteDevice : "Waiting for another device…"}
        iconType="remote"
      />

      {/* File Drop & Selection Area (visible once connected or room active) */}
      {remoteDevice && (
        <div style={{ marginTop: 24 }}>
          <div
            className={`filebox ${dragOver ? "drag" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFilesAdded(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadCloud className="filebox-icon" size={36} />
            <strong>Choose files or drop them here</strong>
            <small>Files are transferred directly over WebRTC P2P</small>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              onChange={(e) => handleFilesAdded(e.target.files)}
            />
          </div>

          {selectedFiles.length > 0 && (
            <div className="filelist">
              {selectedFiles.map((f, i) => (
                <div key={i} className="fileitem">
                  <div className="fileitem-info">
                    <FileText size={16} color="var(--blue)" />
                    <span className="fileitem-name">{f.name}</span>
                  </div>
                  <div className="fileitem-meta">
                    <span className="muted">{formatBytes(f.size)}</span>
                    {!sending && (
                      <button
                        className="fileitem-remove"
                        onClick={() => handleRemoveFile(i)}
                        title="Remove file"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              <button
                className="action"
                style={{ marginTop: 14 }}
                disabled={sending}
                onClick={handleSendFiles}
              >
                {sending ? (
                  <span>Sending… ({sendProgress.percent}%)</span>
                ) : (
                  <>
                    <Send size={16} />
                    <span>Send {selectedFiles.length} file(s)</span>
                  </>
                )}
              </button>
            </div>
          )}

          {sending && (
            <div className="progress-wrap">
              <div className="progress-head">
                <span>Sending {sendProgress.currentFile}…</span>
                <span>{sendProgress.percent}%</span>
              </div>
              <div className="track">
                <div
                  className="bar"
                  style={{ width: `${sendProgress.percent}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
