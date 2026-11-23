import { useSyncExternalStore } from "react";

// Chrome/Edge/Android fire `beforeinstallprompt` once, possibly before React mounts, so capture it at module load.
// Safari/iOS never fire it (install there is Share → Add to Home Screen), so the button simply stays hidden.
let deferred = null;
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // we show our own button instead of the mini-infobar
    deferred = e;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    emit();
  });
}

const subscribe = (l) => (listeners.add(l), () => listeners.delete(l));

export function useInstallPrompt() {
  const available = useSyncExternalStore(subscribe, () => !!deferred, () => false);

  const install = async () => {
    if (!deferred) return false;
    const prompt = deferred;
    deferred = null; // a prompt event can only be used once
    emit();
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    return outcome === "accepted";
  };

  return { available, install };
}
