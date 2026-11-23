import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CircleCheck,
  CloudUpload,
  Copy,
  FolderPlus,
  Link2,
  Plus,
  QrCode,
  Radio,
  RotateCw,
  Send,
  Trash2,
  TriangleAlert,
  Unplug,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import ConnectionStatus from "@/components/ConnectionStatus";
import DeviceLink from "@/components/DeviceLink";
import TransferProgress from "@/components/TransferProgress";
import FileIcon from "@/components/FileIcon";
import RoomCode from "@/components/RoomCode";
import { getDeviceInfo, formatBytes, makeRoomCode } from "@/utils/deviceInfo";
import { MeshLinkConnection, getBackendUrls } from "@/utils/webrtc";
import { requestNotificationPermission } from "@/utils/notifications";
import { cn } from "@/lib/utils";
import { SameNetworkNote } from "@/components/NetworkTips";

// phase: "idle" → "creating" → "waiting" ⇄ "connected"; any → "error"
export default function SendPage() {
  const [localDevice] = useState(() => getDeviceInfo());
  const [phase, setPhase] = useState("idle");
  const [error, setError] = useState("");
  const [status, setStatus] = useState({ text: "No room", type: "idle" });
  const [room, setRoom] = useState("");
  const [qr, setQr] = useState({ state: "idle", src: "" }); // idle | loading | ready | error

  const [queue, setQueue] = useState([]);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(null);
  const [sentLog, setSentLog] = useState([]);
  const [dragOver, setDragOver] = useState(false);

  const connRef = useRef(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  useEffect(() => () => connRef.current?.close(), []);

  const createRoom = async () => {
    connRef.current?.close();
    requestNotificationPermission();

    const code = makeRoomCode();
    setRoom(code);
    setPhase("creating");
    setError("");
    setQueue([]);
    setSending(false);
    setProgress(null);
    setQr({ state: "loading", src: "" });

    const { backendUrl } = getBackendUrls();
    fetch(`${backendUrl}/api/qr?room=${encodeURIComponent(code)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setQr({ state: "ready", src: d.qr }))
      .catch(() => setQr({ state: "error", src: "" }));

    const connection = new MeshLinkConnection({
      role: "send",
      room: code,
      onStatusChange: (text, type) => {
        setStatus({ text, type });
        if (type === "bad") {
          setError(text);
          setPhase((p) => (p === "connected" ? p : "error"));
        }
      },
      onPeerConnected: () => {
        setPhase("connected");
        toast.success("Receiver connected");
      },
      onPeerDisconnected: () => {
        if (phaseRef.current === "connected") toast.warning("Receiver disconnected");
        setPhase((p) => (p === "error" ? p : "waiting"));
      },
      onSendProgress: setProgress,
      onTransferCancelled: () => setSending(false),
    });
    connRef.current = connection;

    try {
      await connection.connect();
      setPhase((p) => (p === "creating" ? "waiting" : p));
    } catch (e) {
      setError(e.message);
      setPhase("error");
    }
  };

  const closeRoom = () => {
    connRef.current?.close();
    connRef.current = null;
    setPhase("idle");
    setRoom("");
    setQueue([]);
    setProgress(null);
    setStatus({ text: "No room", type: "idle" });
  };

  const copy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Couldn't copy — select and copy it manually.");
    }
  };
  const joinUrl = room ? `${window.location.origin}/receive?room=${encodeURIComponent(room)}` : "";

  const addFiles = (files) => {
    const arr = Array.from(files || []).filter((f) => f.size > 0 || f.type); // dropped folders show up as empty entries
    if (arr.length) setQueue((q) => [...q, ...arr]);
  };

  const totalBytes = queue.reduce((acc, f) => acc + f.size, 0);

  const sendAll = async () => {
    if (!connRef.current || queue.length === 0) return;
    const batch = queue;
    setSending(true);
    setProgress({ currentFile: batch[0].name, percent: 0, currentBytes: 0, totalBytes, speedText: "", etaText: "" });
    try {
      await connRef.current.sendFiles(batch);
      setSentLog((log) => [...batch.map((f) => ({ name: f.webkitRelativePath || f.name, size: f.size })), ...log]);
      setQueue([]);
      setStatus({ text: "All files sent", type: "good" });
      toast.success(`Sent ${batch.length} ${batch.length === 1 ? "file" : "files"}`, {
        description: formatBytes(batch.reduce((a, f) => a + f.size, 0)),
      });
    } catch (err) {
      if (/cancel/i.test(err.message)) toast.info("Transfer cancelled");
      else toast.error("Send failed", { description: err.message });
    } finally {
      setSending(false);
      setProgress(null);
    }
  };

  const connected = phase === "connected";

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Send files</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create a room, connect the receiver, then drop in your files.</p>
        </div>
        <ConnectionStatus text={status.text} type={status.type} />
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[340px_1fr]">
        {/* Pairing */}
        <Card>
          <CardHeader>
            <CardTitle>Pairing</CardTitle>
            <CardDescription>Share this with the receiving device.</CardDescription>
            {(phase === "waiting" || connected) && (
              <CardAction>
                <Button variant="ghost" size="sm" onClick={closeRoom}>
                  <Unplug /> Close
                </Button>
              </CardAction>
            )}
          </CardHeader>

          <CardContent>
            {phase === "idle" && (
              <Empty className="border border-dashed py-10">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Radio />
                  </EmptyMedia>
                  <EmptyTitle>No room yet</EmptyTitle>
                  <EmptyDescription>A room gives you a one-time code and QR for the receiver.</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button onClick={createRoom}>
                    <Plus /> Create room
                  </Button>
                </EmptyContent>
              </Empty>
            )}

            {phase === "creating" && (
              <div className="space-y-5" aria-busy="true" aria-label="Creating room">
                <div className="flex justify-center gap-1.5">
                  {Array.from({ length: 6 }, (_, i) => (
                    <Skeleton key={i} className="h-12 w-10 rounded-lg" />
                  ))}
                </div>
                <Skeleton className="mx-auto aspect-square w-44 rounded-xl" />
                <div className="grid grid-cols-2 gap-2">
                  <Skeleton className="h-8" />
                  <Skeleton className="h-8" />
                </div>
              </div>
            )}

            {phase === "error" && (
              <Alert variant="destructive">
                <TriangleAlert />
                <AlertTitle>Couldn't open the room</AlertTitle>
                <AlertDescription>
                  <p>{error || "Something went wrong."}</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={createRoom}>
                    <RotateCw /> Try again
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {(phase === "waiting" || connected) && (
              <div className="space-y-5">
                <RoomCode code={room} />

                <div className="mx-auto grid aspect-square w-44 place-items-center overflow-hidden rounded-xl bg-white p-2">
                  {qr.state === "loading" && <Skeleton className="size-full rounded-lg bg-neutral-200" />}
                  {qr.state === "ready" && <img src={qr.src} alt={`QR code to join room ${room}`} className="size-full" />}
                  {qr.state === "error" && (
                    <div className="flex flex-col items-center gap-2 p-4 text-center text-xs text-neutral-500">
                      <QrCode className="size-6" />
                      QR unavailable. Share the code or link instead.
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => copy(room, "Room code")}>
                    <Copy /> Code
                  </Button>
                  <Button variant="outline" onClick={() => copy(joinUrl, "Join link")}>
                    <Link2 /> Link
                  </Button>
                </div>
              </div>
            )}
            <SameNetworkNote className="mt-5" />
          </CardContent>
        </Card>

        {/* Files */}
        <Card>
          <CardHeader>
            <CardTitle>Files</CardTitle>
            <CardDescription>
              {connected ? "Add files or a folder, then send." : "Available once a receiver connects."}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            <DeviceLink
              local={localDevice}
              peerLabel="Receiver"
              peerName="Receiving device"
              state={connected ? "connected" : phase === "waiting" ? "waiting" : "idle"}
            />

            {!connected && (
              <Empty className="border border-dashed py-12">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    {phase === "waiting" ? <Spinner /> : <CloudUpload />}
                  </EmptyMedia>
                  <EmptyTitle>{phase === "waiting" ? "Waiting for the receiver" : "Not connected"}</EmptyTitle>
                  <EmptyDescription>
                    {phase === "waiting"
                      ? `On the other device, open Receive and enter ${room}, or scan the QR.`
                      : "Create a room on the left to get started."}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}

            {connected && (
              <>
                <button
                  type="button"
                  disabled={sending}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    if (!sending) addFiles(e.dataTransfer.files);
                  }}
                  className={cn(
                    "flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-border px-6 py-10 text-center transition-colors outline-none",
                    "hover:border-brand/50 hover:bg-brand/5 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
                    dragOver && "border-brand bg-brand/10"
                  )}
                >
                  <span className="grid size-11 place-items-center rounded-full bg-brand/10 text-brand">
                    <CloudUpload className="size-5" />
                  </span>
                  <span className="text-sm font-medium">{dragOver ? "Drop to add" : "Drop files here or click to browse"}</span>
                  <span className="text-xs text-muted-foreground">Any type, any size</span>
                </button>
                <input ref={fileInputRef} type="file" multiple hidden onChange={(e) => (addFiles(e.target.files), (e.target.value = ""))} />
                <input
                  ref={folderInputRef}
                  type="file"
                  webkitdirectory=""
                  multiple
                  hidden
                  onChange={(e) => (addFiles(e.target.files), (e.target.value = ""))}
                />

                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    Queue <span className="text-muted-foreground">({queue.length})</span>
                  </p>
                  <Button variant="ghost" size="sm" disabled={sending} onClick={() => folderInputRef.current?.click()}>
                    <FolderPlus /> Add folder
                  </Button>
                </div>

                {queue.length === 0 ? (
                  <p className="rounded-xl border border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
                    Nothing queued yet.
                  </p>
                ) : (
                  <div className="max-h-72 rounded-xl border border-border overflow-y-auto">
                    <ul className="divide-y divide-border">
                      {queue.map((f, i) => {
                        const label = f.webkitRelativePath || f.name;
                        return (
                          <li key={`${label}-${f.size}-${i}`} className="flex items-center gap-3 px-3 py-2.5">
                            <FileIcon name={f.name} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm" title={label}>
                                {label}
                              </p>
                              <p className="text-xs text-muted-foreground">{formatBytes(f.size)}</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              disabled={sending}
                              onClick={() => setQueue((q) => q.filter((_, j) => j !== i))}
                              aria-label={`Remove ${label}`}
                            >
                              <Trash2 />
                            </Button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {sending && progress && (
                  <TransferProgress
                    title="Sending"
                    fileName={progress.currentFile}
                    percent={progress.percent}
                    currentBytes={progress.currentBytes}
                    totalBytes={progress.totalBytes}
                    speedText={progress.speedText}
                    etaText={progress.etaText}
                    onCancel={() => connRef.current?.cancelTransfer()}
                  />
                )}
              </>
            )}
          </CardContent>

          {connected && (
            <CardFooter className="justify-between gap-3">
              <span className="text-sm text-muted-foreground">{queue.length ? formatBytes(totalBytes) : "—"}</span>
              <Button onClick={sendAll} disabled={sending || queue.length === 0}>
                {sending ? <Spinner /> : <Send />}
                {sending ? "Sending…" : `Send ${queue.length || ""}`.trim()}
              </Button>
            </CardFooter>
          )}
        </Card>
      </div>

      {sentLog.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Sent this session</CardTitle>
            <CardAction>
              <Button variant="ghost" size="sm" onClick={() => setSentLog([])}>
                Clear
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border rounded-xl border border-border">
              {sentLog.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center gap-3 px-3 py-2.5">
                  <FileIcon name={f.name} />
                  <span className="min-w-0 flex-1 truncate text-sm">{f.name}</span>
                  <span className="text-xs text-muted-foreground">{formatBytes(f.size)}</span>
                  <CircleCheck className="size-4 text-success" aria-label="Sent" />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
