import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Send, Download, ShieldCheck, MonitorDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Logo from "@/components/Logo";
import { cn } from "@/lib/utils";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";

const links = [
  { to: "/send", label: "Send", icon: Send },
  { to: "/receive", label: "Receive", icon: Download },
];

export default function Navbar() {
  const { pathname } = useLocation();
  const { available: canInstall, install } = useInstallPrompt();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          to="/"
          className="flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Logo />
          <span className="font-semibold tracking-tight">MeshLink</span>
        </Link>

        <nav className="flex items-center gap-1" aria-label="Main">
          {links.map(({ to, label, icon: Icon }) => {
            const active = pathname === to;
            return (
              <Button
                key={to}
                asChild
                variant="ghost"
                size="sm"
                className={cn(active ? "bg-muted text-foreground" : "text-muted-foreground")}
              >
                <Link to={to} aria-current={active ? "page" : undefined}>
                  <Icon />
                  {label}
                </Link>
              </Button>
            );
          })}
          {canInstall ? (
            <Button
              size="sm"
              variant="outline"
              className="ml-2"
              onClick={async () => (await install()) && toast.success("MeshLink installed")}
              aria-label="Install MeshLink app"
            >
              <MonitorDown />
              <span className="hidden sm:inline">Install</span>
            </Button>
          ) : (
            <Badge variant="outline" className="ml-2 hidden text-muted-foreground sm:inline-flex">
              <ShieldCheck className="text-success" />
              Direct P2P
            </Badge>
          )}
        </nav>
      </div>
    </header>
  );
}
