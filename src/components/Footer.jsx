import React from "react";
import { ExternalLink } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:px-6">
        <p>
          © 2026 <span className="font-medium text-foreground">MeshLink</span> · Device to device. Nothing in between.
        </p>
        <a
          href="https://github.com/lowdevco"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <ExternalLink className="size-3.5" />
          lowdevco
        </a>
      </div>
    </footer>
  );
}
