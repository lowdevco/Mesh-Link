import React from "react";
import { Link } from "react-router-dom";
import { Send, Download, ArrowRight, ShieldCheck, Zap, Smartphone, QrCode } from "lucide-react";

export default function HomePage() {
  return (
    <div>
      <section className="hero">
        <div className="eyebrow">
          <Zap size={14} />
          <span>Fast · Private · Direct</span>
        </div>
        <h1>
          Send files.
          <br />
          <span>Not through the cloud.</span>
        </h1>
        <p>
          Connect any two devices and transfer files directly over WebRTC.
          Your data travels peer-to-peer with zero middleman servers.
        </p>
      </section>

      <div className="home-cards">
        <Link to="/send" className="action-card">
          <div className="card-icon send">
            <Send size={26} />
          </div>
          <h2>
            <span>Send Files</span>
            <ArrowRight size={20} />
          </h2>
          <p>
            Create a secure room, generate an instant QR code, select files, and
            beam them directly to another device.
          </p>
          <div className="card-cta">
            <span>Start sharing</span>
            <ArrowRight size={16} />
          </div>
        </Link>

        <Link to="/receive" className="action-card">
          <div className="card-icon receive">
            <Download size={26} />
          </div>
          <h2>
            <span>Receive Files</span>
            <ArrowRight size={20} />
          </h2>
          <p>
            Enter a 4-letter room code or open a pairing link to connect and
            download files instantly on this device.
          </p>
          <div className="card-cta" style={{ color: "var(--violet)" }}>
            <span>Join a room</span>
            <ArrowRight size={16} />
          </div>
        </Link>
      </div>

      <div className="features-grid">
        <div className="feature-box">
          <ShieldCheck className="feature-icon" size={24} />
          <h3>Private & Direct</h3>
          <p>
            Files stream peer-to-peer via WebRTC DataChannels. The signalling
            server never sees or stores your data.
          </p>
        </div>
        <div className="feature-box">
          <QrCode className="feature-icon" size={24} />
          <h3>Instant QR Pairing</h3>
          <p>
            Scan a QR code from your phone or tablet camera to instantly pair
            devices without typing codes.
          </p>
        </div>
        <div className="feature-box">
          <Smartphone className="feature-icon" size={24} />
          <h3>Cross-Device</h3>
          <p>
            Works between iOS, Android, Windows, Mac, and Linux browsers without
            installing any software or apps.
          </p>
        </div>
      </div>
    </div>
  );
}
