import React from "react";
import { Cable, Laptop, Smartphone, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const options = [
  {
    icon: Smartphone,
    title: "Phone hotspot",
    body: "Turn on the hotspot on one phone (Android: Settings → Hotspot & tethering. iPhone: Settings → Personal Hotspot), then join that Wi-Fi from the other device.",
  },
  {
    icon: Cable,
    title: "PC on Ethernet only? Use USB tethering",
    body: "Plug the phone into the PC with a USB cable and turn on USB tethering (Android: Hotspot & tethering → USB tethering. iPhone: Personal Hotspot on, then connect by cable). Both are now on the same network.",
  },
  {
    icon: Laptop,
    title: "PC hotspot",
    body: "If the PC has Wi-Fi: Windows Settings → Network & internet → Mobile hotspot → On, then connect the phone to it.",
  },
];

// Guide for when devices can't reach each other. A browser can't turn a hotspot on, so we explain how.
export function HotspotGuide({ trigger }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="link" size="sm" className="h-auto p-0">
            Can't connect? Use a hotspot
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Put both devices on one network</DialogTitle>
          <DialogDescription>
            MeshLink connects your devices directly, so they need to be on the same network. A PC on Ethernet and a phone
            on Wi-Fi from the same router counts, unless it's a guest network or a VPN is on.
          </DialogDescription>
        </DialogHeader>
        <ol className="space-y-3">
          {options.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-3 rounded-xl border border-border bg-muted/30 p-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
                <Icon className="size-4" />
              </span>
              <div>
                <p className="text-sm font-medium">{title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="rounded-lg bg-success/10 px-3 py-2 text-xs text-success">
          It's free: files travel between the devices over the hotspot itself, not your mobile data. Only connecting uses a
          few KB, so the hotspot needs internet for a moment.
        </p>
      </DialogContent>
    </Dialog>
  );
}

// One-line reminder shown on every screen that connects devices.
export function SameNetworkNote({ className }) {
  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-muted-foreground", className)}>
      <Wifi className="size-3.5 text-brand" />
      <span>Both devices must be on the same Wi-Fi or hotspot.</span>
      <HotspotGuide />
    </div>
  );
}
