import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Share2, Send, Download, ShieldCheck } from "lucide-react";

export default function Navbar() {
  const location = useLocation();

  return (
    <header className="top">
      <Link to="/" className="brand-link">
        <div className="logo">
          <Share2 size={22} strokeWidth={2.5} />
        </div>
        <span>MeshLink</span>
      </Link>

      <nav className="nav-links">
        <Link
          to="/send"
          className={`nav-link ${location.pathname === "/send" ? "active" : ""}`}
        >
          <Send size={15} />
          <span>Send</span>
        </Link>
        <Link
          to="/receive"
          className={`nav-link ${location.pathname === "/receive" ? "active" : ""}`}
        >
          <Download size={15} />
          <span>Receive</span>
        </Link>
        <div className="top-tag">
          <ShieldCheck size={13} color="#34d399" />
          <span>DIRECT P2P</span>
        </div>
      </nav>
    </header>
  );
}
