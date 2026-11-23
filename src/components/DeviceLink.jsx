import React from "react";
import { Laptop, Smartphone, Tablet, Monitor, MonitorSmartphone } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const icons = { smartphone: Smartphone, tablet: Tablet, monitor: Monitor, laptop: Laptop };

function DeviceNode({ label, name, icon: Icon, muted }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <div
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-muted/50",
          muted && "border-dashed text-muted-foreground"
        )}
      >
        <Icon className="size-4.5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("truncate text-sm font-medium", muted && "text-muted-foreground")}>{name}</p>
      </div>
    </div>
  );
}

/**
 * This device ↔ peer, with a link line that reflects the state.
 * state: "idle" | "waiting" | "connected"
 */
export default function DeviceLink({ local, peerLabel, peerName, state }) {
  const connected = state === "connected";
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-background/40 p-3 sm:flex-row sm:items-center">
      <DeviceNode label="This device" name={local.name} icon={icons[local.iconType] || Laptop} />

      <div className="flex items-center justify-center sm:w-20" aria-hidden="true">
        <div className="relative h-6 w-px overflow-hidden rounded-full bg-border sm:h-px sm:w-full">
          {connected && <span className="absolute inset-0 bg-success" />}
          {state === "waiting" && (
            <span className="absolute inset-0 animate-pulse bg-gradient-to-b from-transparent via-brand to-transparent sm:bg-gradient-to-r" />
          )}
        </div>
      </div>

      {state === "waiting" ? (
        <div className="flex min-w-0 flex-1 items-center gap-3" aria-label="Waiting for the other device">
          <Skeleton className="size-10 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3.5 w-28" />
          </div>
        </div>
      ) : (
        <DeviceNode
          label={peerLabel}
          name={connected ? peerName : "Not connected"}
          icon={MonitorSmartphone}
          muted={!connected}
        />
      )}
    </div>
  );
}
