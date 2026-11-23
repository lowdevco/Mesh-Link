// Web Audio API Synth Chime - zero external audio assets needed!
function playCompletionChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    // Notes: E5 (659Hz) -> G#5 (830Hz) -> B5 (987Hz)
    const notes = [659.25, 830.61, 987.77];
    const now = ctx.currentTime;

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.1);

      gain.gain.setValueAtTime(0, now + idx * 0.1);
      gain.gain.linearRampToValueAtTime(0.18, now + idx * 0.1 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.1);
      osc.stop(now + idx * 0.1 + 0.5);
    });
    setTimeout(() => ctx.close().catch(() => {}), 1000); // contexts leak audio threads if never closed
  } catch (e) {
    console.warn("Audio chime error:", e);
  }
}

export function requestNotificationPermission() {
  if (typeof window !== "undefined" && "Notification" in window) {
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }
}

export function notifyTransferComplete(fileName, totalSize) {
  // Always play the pleasant chime
  playCompletionChime();

  // If page is in background, show desktop/phone notification
  if (typeof window !== "undefined" && "Notification" in window) {
    if (Notification.permission === "granted" && document.hidden) {
      try {
        new Notification("MeshLink Transfer Complete", {
          body: `Received "${fileName}" (${totalSize || ""})`,
          icon: "/favicon.ico",
        });
      } catch (e) {
        console.warn("Notification error:", e);
      }
    }
  }
}
