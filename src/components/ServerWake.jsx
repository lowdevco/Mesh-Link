import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { RotateCw } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { getBackendUrls } from "@/utils/webrtc";
import { cn } from "@/lib/utils";

// Render's free tier sleeps the server after ~15 min idle; a cold start usually takes 30–60 s.
const EXPECTED_WAKE_S = 50;
const SHOW_AFTER_MS = 1200; // an awake server answers well within this, so no flash for the common case
const RETRY_MS = 2500;
const RECHECK_AFTER_MS = 10 * 60 * 1000; // tab hidden this long → the server may have fallen asleep again

const stages = [
  [0, "Sending a wake-up call…"],
  [8, "The server is booting up…"],
  [25, "Warming up the signalling relay…"],
  [45, "Almost there…"],
  [75, "Taking a little longer than usual…"],
];

async function ping() {
  try {
    const res = await fetch(`${getBackendUrls().backendUrl}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    // Check the body: while booting, the host may answer with its own HTML page.
    return res.ok && (await res.json()).status === "ok";
  } catch {
    return false;
  }
}

const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function ServerWake() {
  const [phase, setPhase] = useState("checking"); // checking | waking | ready | awake
  const [hidden, setHidden] = useState(false); // user chose to keep browsing
  const [elapsed, setElapsed] = useState(0);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const hiddenRef = useRef(hidden);
  hiddenRef.current = hidden;
  const runRef = useRef(0);
  const lastOkRef = useRef(0);

  const check = useCallback(async () => {
    const run = ++runRef.current;
    const retrying = phaseRef.current === "waking"; // "Try again": keep the screen and the timer as they are
    if (!retrying) {
      setPhase("checking");
      setElapsed(0);
    }
    const started = Date.now();
    const showTimer = retrying ? 0 : setTimeout(() => run === runRef.current && setPhase("waking"), SHOW_AFTER_MS);

    while (run === runRef.current) {
      if (await ping()) break;
      await new Promise((r) => setTimeout(r, RETRY_MS));
    }
    clearTimeout(showTimer);
    if (run !== runRef.current) return;

    lastOkRef.current = Date.now();
    if (phaseRef.current !== "waking") return setPhase("awake");
    if (hiddenRef.current) {
      toast.success("Server is awake", {
        description: `Ready after ${fmt(Math.round((Date.now() - started) / 1000))}.`,
      });
      setHidden(false);
      return setPhase("awake");
    }
    setPhase("ready");
    setTimeout(() => run === runRef.current && setPhase("awake"), 1400);
  }, []);

  useEffect(() => {
    check();
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastOkRef.current > RECHECK_AFTER_MS) check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      runRef.current++; // stops the polling loop
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [check]);

  useEffect(() => {
    if (phase !== "waking") return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  if (phase === "checking" || phase === "awake" || hidden) return null;

  const ready = phase === "ready";
  const percent = ready ? 100 : Math.min(95, Math.round((elapsed / EXPECTED_WAKE_S) * 100));
  const message = ready ? "Server is awake. Let's go!" : [...stages].reverse().find(([t]) => elapsed >= t)[1];
  const slow = !ready && elapsed >= 75;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="wake-title"
      aria-describedby="wake-desc"
      className={cn(
        "fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-background/90 p-6 backdrop-blur-xl transition-opacity duration-500",
        ready && "opacity-95",
      )}
    >
      <div className="w-full max-w-md text-center">
        <WakeIllustration awake={ready} />

        <h2 id="wake-title" className="mt-6 text-2xl font-semibold tracking-tight">
          {ready ? "Ready to connect" : "Waking up the server"}
        </h2>
        <p id="wake-desc" className="mt-2 text-sm text-pretty text-muted-foreground">
          MeshLink runs on Render's free tier, so its signalling server naps after 15 minutes of quiet. Waking it
          usually takes under a minute. Your files never touch it either way.
        </p>

        <div className="mt-8 rounded-xl border border-border bg-card/60 p-4 text-left">
          <div className="flex items-baseline justify-between">
            <p className="text-sm" aria-live="polite">
              {message}
            </p>
            <span className="font-mono text-2xl font-semibold tabular-nums" aria-label={`${elapsed} seconds elapsed`}>
              {fmt(elapsed)}
            </span>
          </div>
          <Progress
            value={percent}
            className={cn("mt-3 h-1.5", ready && "[&>[data-slot=progress-indicator]]:bg-success")}
            aria-label="Estimated wake-up progress"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {ready ? "Connected." : `Usually ready in about ${EXPECTED_WAKE_S} seconds.`}
          </p>
        </div>

        {!ready && (
          <div className="mt-4 flex justify-center gap-2">
            {slow && (
              <Button variant="outline" size="sm" onClick={check}>
                <RotateCw /> Try again
              </Button>
            )}
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setHidden(true)}>
              Browse while it wakes
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// Two devices joined by MeshLink's curve, with the (sleeping) signalling server between them.
function WakeIllustration({ awake }) {
  const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const path = "M64 112 C120 112 120 70 160 70 C200 70 200 28 256 28";
  const led = awake ? "var(--success)" : "var(--warning)";

  return (
    <svg viewBox="0 0 320 150" className="mx-auto w-full max-w-xs" aria-hidden="true">
      <defs>
        <path id="wake-link" d={path} />
        <radialGradient id="wake-glow">
          <stop offset="0" stopColor="var(--brand)" stopOpacity="0.35" />
          <stop offset="1" stopColor="var(--brand)" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx="160" cy="70" r="70" fill="url(#wake-glow)" opacity={awake ? 1 : 0.6} />

      {/* link: dashed while asleep, solid once awake */}
      <use
        href="#wake-link"
        fill="none"
        stroke={awake ? "var(--brand)" : "var(--border)"}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={awake ? "none" : "2 10"}
        style={{ transition: "stroke 400ms" }}
      />

      {/* packets travelling device → device */}
      {!reduce &&
        [0, 1.1, 2.2].map((begin) => (
          <circle
            key={begin}
            r="4.5"
            fill={awake ? "var(--brand)" : "var(--muted-foreground)"}
            opacity={awake ? 1 : 0.6}
          >
            <animateMotion
              dur={awake ? "1.1s" : "3.3s"}
              begin={`${begin}s`}
              repeatCount="indefinite"
              keyPoints="0;1"
              keyTimes="0;1"
              calcMode="linear"
            >
              <mpath href="#wake-link" />
            </animateMotion>
          </circle>
        ))}

      {/* sending device (phone) */}
      <g>
        <rect x="34" y="84" width="44" height="60" rx="9" fill="var(--card)" stroke="var(--border)" strokeWidth="2" />
        <rect x="48" y="89" width="16" height="3" rx="1.5" fill="var(--muted-foreground)" opacity="0.5" />
        <rect x="42" y="100" width="28" height="22" rx="4" fill="var(--brand)" opacity="0.5" />
      </g>

      {/* receiving device (laptop) */}
      <g>
        <rect x="232" y="6" width="56" height="38" rx="6" fill="var(--card)" stroke="var(--border)" strokeWidth="2" />
        <rect x="240" y="13" width="40" height="24" rx="3" fill="var(--brand)" opacity="0.5" />
        <path d="M224 48 H296" stroke="var(--border)" strokeWidth="4" strokeLinecap="round" />
      </g>

      {/* the server in the middle */}
      <g>
        {!reduce && !awake && (
          <circle cx="160" cy="70" r="16" fill="none" stroke="var(--warning)" strokeOpacity="0.5">
            <animate attributeName="r" values="16;34" dur="2s" repeatCount="indefinite" />
            <animate attributeName="stroke-opacity" values="0.5;0" dur="2s" repeatCount="indefinite" />
          </circle>
        )}
        <rect x="144" y="56" width="32" height="28" rx="7" fill="var(--card)" stroke="var(--border)" strokeWidth="2" />
        <path
          d="M151 66 H163 M151 74 H160"
          stroke="var(--muted-foreground)"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.6"
        />
        <circle cx="169" cy="70" r="3.5" fill={led} style={{ transition: "fill 400ms" }}>
          {!reduce && !awake && (
            <animate attributeName="opacity" values="1;0.3;1" dur="1.4s" repeatCount="indefinite" />
          )}
        </circle>
        {/* zzz while asleep */}
        {!awake &&
          ["z", "z", "Z"].map((z, i) => (
            <text
              key={i}
              x={180 + i * 8}
              y={50 - i * 9}
              fill="var(--muted-foreground)"
              fontSize={9 + i * 2}
              fontWeight="600"
              fontFamily="inherit"
            >
              {z}
              {!reduce && (
                <animate
                  attributeName="opacity"
                  values="0;1;0"
                  dur="2.4s"
                  begin={`${i * 0.4}s`}
                  repeatCount="indefinite"
                />
              )}
            </text>
          ))}
      </g>
    </svg>
  );
}
