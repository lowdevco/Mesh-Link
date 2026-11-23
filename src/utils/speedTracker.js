import { formatBytes } from "./deviceInfo";

export class SpeedTracker {
  constructor() {
    this.reset();
  }

  reset() {
    this.lastTime = Date.now();
    this.lastBytes = 0;
    this.speedBps = 0;
  }

  update(currentBytes, totalBytes) {
    const now = Date.now();
    const elapsedSinceLast = (now - this.lastTime) / 1000;

    if (elapsedSinceLast >= 0.4) {
      const bytesDiff = currentBytes - this.lastBytes;
      const currentRate = bytesDiff / elapsedSinceLast;
      this.speedBps = this.speedBps === 0 ? currentRate : this.speedBps * 0.6 + currentRate * 0.4;
      this.lastBytes = currentBytes;
      this.lastTime = now;
    }

    const remainingBytes = Math.max(0, totalBytes - currentBytes);
    let etaSeconds = 0;
    if (this.speedBps > 1024) {
      etaSeconds = Math.round(remainingBytes / this.speedBps);
    }

    return {
      speedBps: this.speedBps,
      speedText: this.speedBps > 0 ? `${formatBytes(this.speedBps)}/s` : "Calculating…",
      etaSeconds,
      etaText: formatEta(etaSeconds),
    };
  }
}

function formatEta(seconds) {
  if (seconds <= 0) return "0s";
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return `${mins}m ${secs}s`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m`;
}
