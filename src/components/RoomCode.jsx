import React from "react";
import { cn } from "@/lib/utils";

// Read-only code display that mirrors the receiver's OTP input, so both sides look the same.
export default function RoomCode({ code, className }) {
  return (
    <div className={cn("flex justify-center gap-1.5", className)} aria-label={`Room code ${code.split("").join(" ")}`}>
      {code.split("").map((c, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="grid h-12 w-10 place-items-center rounded-lg border border-border bg-muted/40 font-mono text-xl font-semibold"
        >
          {c}
        </span>
      ))}
    </div>
  );
}
