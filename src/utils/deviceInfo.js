export function getDeviceInfo() {
  const ua = navigator.userAgent || "";
  let browser = "Browser";

  if (/Edg\//.test(ua)) browser = "Microsoft Edge";
  else if (/Firefox\//.test(ua) || /FxiOS\//.test(ua)) browser = "Firefox";
  else if (/Chrome\//.test(ua) || /CriOS\//.test(ua)) browser = "Chrome";
  else if (/Safari\//.test(ua)) browser = "Safari";

  let device = "Computer";
  let iconType = "laptop";

  if (/iPhone/i.test(ua)) {
    device = "iPhone";
    iconType = "smartphone";
  } else if (/iPad/i.test(ua)) {
    device = "iPad";
    iconType = "tablet";
  } else if (/Android/i.test(ua)) {
    device = /Mobile/i.test(ua) ? "Android Phone" : "Android Tablet";
    iconType = /Mobile/i.test(ua) ? "smartphone" : "tablet";
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    device = "Mac";
    iconType = "laptop";
  } else if (/Windows/i.test(ua)) {
    device = "Windows PC";
    iconType = "laptop";
  } else if (/Linux/i.test(ua)) {
    device = "Linux";
    iconType = "monitor";
  }

  return {
    name: `${device} · ${browser}`,
    iconType,
  };
}

export function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

// 6 chars from 32 symbols ≈ 1 billion codes (4 chars was ~1M and guessable); crypto RNG, not Math.random.
export function makeRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 symbols, so % has no bias
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => alphabet[b % 32]).join("");
}
