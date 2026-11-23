import React from "react";
import { cn } from "@/lib/utils";

// type: "good" | "warn" | "bad" | "idle" — matches MeshLinkConnection.onStatusChange.
const tone = {
  good: "bg-success",
  warn: "bg-warning animate-pulse",
  bad: "bg-destructive",
  idle: "bg-muted-foreground/60",
};

export default function ConnectionStatus({ text, type = "idle", className }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-muted-foreground",
        className
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", tone[type] || tone.idle)} />
      <span className="truncate">{text}</span>
    </div>
  );
}
