import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { WifiOff } from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";

// Service-worker lifecycle + connectivity, surfaced as toasts and a banner.
export default function PwaStatus() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError: (err) => console.warn("Service worker registration failed:", err),
  });

  useEffect(() => {
    if (!needRefresh) return;
    // Never auto-reload: it would kill a transfer in progress. The user picks the moment.
    toast("Update available", {
      id: "pwa-update",
      description: "A new version of MeshLink is ready.",
      duration: Infinity,
      action: { label: "Reload", onClick: () => updateServiceWorker(true) },
    });
  }, [needRefresh, updateServiceWorker]);


  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  if (online) return null;
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 border-b border-warning/20 bg-warning/10 px-4 py-2 text-xs text-warning"
    >
      <WifiOff className="size-3.5" />
      You're offline. Devices can't find each other until you reconnect.
    </div>
  );
}
