import React from "react";

export default function StatusBadge({ status, type = "idle" }) {
  // type: "good" (green) | "warn" (amber) | "bad" (red) | "idle" (slate)
  return (
    <div className="statusbar">
      <span className={`dot ${type}`}></span>
      <span className="status-text" aria-live="polite">
        {status}
      </span>
    </div>
  );
}
