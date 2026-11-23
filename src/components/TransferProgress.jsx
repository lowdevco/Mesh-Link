import React from "react";
import { HardDrive, X } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import FileIcon from "@/components/FileIcon";
import { formatBytes } from "@/utils/deviceInfo";

// Live progress for one transfer. `title` is e.g. "Sending" / "Receiving".
export default function TransferProgress({ title, fileName, percent, currentBytes, totalBytes, speedText, etaText, disk, onCancel }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4" aria-live="polite">
      <div className="flex items-start gap-3">
        <FileIcon name={fileName} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium">{fileName || "Preparing…"}</p>
            {disk && (
              <Badge variant="secondary" className="shrink-0">
                <HardDrive /> Disk
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {title}
            {totalBytes ? ` · ${formatBytes(currentBytes || 0)} of ${formatBytes(totalBytes)}` : ""}
          </p>
        </div>
        <span className="text-sm font-semibold tabular-nums">{percent}%</span>
        {onCancel && (
          <Button variant="ghost" size="icon-sm" onClick={onCancel} aria-label="Cancel transfer">
            <X />
          </Button>
        )}
      </div>
      <Progress value={percent} className="mt-3 h-1.5" aria-label={`${title} progress`} />
      <div className="mt-2 flex justify-between text-xs text-muted-foreground tabular-nums">
        <span>{speedText || "Starting…"}</span>
        <span>{etaText && etaText !== "Done" ? `${etaText} left` : etaText}</span>
      </div>
    </div>
  );
}
