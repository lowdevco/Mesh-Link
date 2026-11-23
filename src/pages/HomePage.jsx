import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Download, Lock, QrCode, Send, Smartphone, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SameNetworkNote } from "@/components/NetworkTips";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const actions = [
  {
    to: "/send",
    icon: Send,
    title: "Send files",
    body: "Open a room, share the code or QR, and stream files straight to the other device.",
    cta: "Start sharing",
  },
  {
    to: "/receive",
    icon: Download,
    title: "Receive files",
    body: "Enter the 6-character code or scan the QR on the sending device to connect.",
    cta: "Join a room",
  },
];

const features = [
  { icon: Lock, title: "Private by design", body: "Encrypted WebRTC channel. The server only introduces devices — it never sees your files." },
  { icon: QrCode, title: "Pair in a scan", body: "Point a phone camera at the QR code and you're connected. No typing, no accounts." },
  { icon: HardDrive, title: "Huge files", body: "Files over 300 MB can stream straight to disk in supported browsers." },
  { icon: Smartphone, title: "Any device", body: "iOS, Android, Windows, macOS and Linux. Just a browser, nothing to install." },
];

const steps = [
  ["Create a room", "The sender gets a one-time code and QR."],
  ["Connect", "On the same Wi-Fi or hotspot, the receiver enters the code or scans the QR."],
  ["Transfer", "Files stream directly, device to device."],
];

export default function HomePage() {
  return (
    <div className="space-y-20">
      {/* Hero */}
      <section className="mx-auto max-w-2xl pt-6 text-center">
        <Badge variant="outline" className="mb-6 text-muted-foreground">
          <Lock className="text-success" /> Private · Instant · Direct
        </Badge>
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
          Device to device.
          <br />
          <span className="bg-gradient-to-r from-brand via-brand/80 to-foreground bg-clip-text text-transparent">
            Nothing in between.
          </span>
        </h1>
        <p className="mx-auto mt-5 max-w-lg text-base text-pretty text-muted-foreground sm:text-lg">
          Share files of any size, instantly and privately. They go straight to the other device: never uploaded,
          no account needed.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="h-10 px-5">
            <Link to="/send">
              <Send /> Send files
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-10 px-5">
            <Link to="/receive">
              <Download /> Receive files
            </Link>
          </Button>
        </div>
        <SameNetworkNote className="mt-5" />
      </section>

      {/* Primary actions */}
      <section className="grid gap-4 sm:grid-cols-2">
        {actions.map(({ to, icon: Icon, title, body, cta }) => (
          <Link key={to} to={to} className="group rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <Card className="h-full transition-colors group-hover:border-brand/40 group-hover:bg-card/80">
              <CardHeader>
                <div className="mb-2 grid size-10 place-items-center rounded-xl bg-brand/10 text-brand">
                  <Icon className="size-5" />
                </div>
                <CardTitle className="text-lg">{title}</CardTitle>
                <CardDescription>{body}</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                  {cta}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>

      {/* How it works */}
      <section>
        <h2 className="text-center text-sm font-medium tracking-widest text-muted-foreground uppercase">How it works</h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-3">
          {steps.map(([title, body], i) => (
            <li key={title} className="rounded-xl border border-border bg-card/40 p-5">
              <span className="grid size-7 place-items-center rounded-full border border-border font-mono text-xs text-muted-foreground">
                {i + 1}
              </span>
              <p className="mt-4 font-medium">{title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Features */}
      <section className="grid gap-x-8 gap-y-10 sm:grid-cols-2">
        {features.map(({ icon: Icon, title, body }) => (
          <div key={title} className="flex gap-4">
            <div className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-muted/40">
              <Icon className="size-4 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-medium">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
