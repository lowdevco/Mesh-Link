import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { REGEXP_ONLY_DIGITS_AND_CHARS } from "input-otp";
import {
  Archive,
  ArrowRight,
  CircleCheck,
  Download,
  Eye,
  HardDrive,
  Inbox,
  LogOut,
  MemoryStick,
  RotateCw,
  ScanLine,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ConnectionStatus from "@/components/ConnectionStatus";
import DeviceLink from "@/components/DeviceLink";
import TransferProgress from "@/components/TransferProgress";
import FileIcon, { fileKind } from "@/components/FileIcon";
import RoomCode from "@/components/RoomCode";
import { SameNetworkNote } from "@/components/NetworkTips";
import { getDeviceInfo, formatBytes } from "@/utils/deviceInfo";
import { MeshLinkConnection } from "@/utils/webrtc";
import { requestNotificationPermission } from "@/utils/notifications";

const CODE_LENGTH = 6;
const ROOM_RE = /^[A-Z0-9-]{4,50}$/;

// phase: "idle" → "connecting" → "waiting" ⇄ "connected"; any → "error"
export default function ReceivePage() {
  const [searchParams] = useSearchParams();
  const [localDevice] = useState(() => getDeviceInfo());
  const [phase, setPhase] = useState("idle");
  const [error, setError] = useState("");
  const [status, setStatus] = useState({ text: "Not connected", type: "idle" });
  const [code, setCode] = useState("");
  const [room, setRoom] = useState("");

  const [files, setFiles] = useState([]);
  const [progress, setProgress] = useState(null);
  const [largeFile, setLargeFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [zipping, setZipping] = useState(false);

  const connRef = useRef(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  // Free received-file memory when leaving the page (blob URLs pin the data otherwise).
  const filesRef = useRef(files);
  filesRef.current = files;
  useEffect(() => () => filesRef.current.forEach((f) => f.url && URL.revokeObjectURL(f.url)), []);

  const connect = async (raw) => {
    const clean = (raw || "").trim().toUpperCase();
    if (!ROOM_RE.test(clean)) {
      setError("That code doesn't look right. It's 6 letters and numbers.");
      setRoom("");
      setPhase("error");
      return;
    }
    connRef.current?.close();
    requestNotificationPermission();

    setRoom(clean);
    setPhase("connecting");
    setError("");
    setLargeFile(null);
    setProgress(null);

    const connection = new MeshLinkConnection({
      role: "receive",
      room: clean,
      onStatusChange: (text, type) => {
        setStatus({ text, type });
        if (type === "bad") {
          setError(text);
          setPhase((p) => (p === "connected" ? p : "error"));
        }
      },
      onPeerConnected: () => {
        setPhase("connected");
        toast.success("Connected to sender");
      },
      onPeerDisconnected: () => {
        if (phaseRef.current === "connected") toast.warning("Sender disconnected");
        setPhase((p) => (p === "error" || p === "idle" ? p : "waiting"));
        setLargeFile(null);
        setProgress(null);
      },
      onReceiveProgress: (p) => setProgress(p.percent >= 100 ? null : p),
      onFileReceived: (item) => {
        setFiles((prev) => [item, ...prev]);
        setProgress(null);
        setLargeFile(null);
        toast.success("File received", { description: item.name });
      },
      onLargeFileDetected: setLargeFile,
      onTransferCancelled: (by) => {
        setProgress(null);
        setLargeFile(null);
        if (by !== "user") toast.info(`Transfer cancelled by ${by}`);
      },
    });
    connRef.current = connection;

    try {
      await connection.connect();
      setPhase((p) => (p === "connecting" ? "waiting" : p));
    } catch (e) {
      setError(e.message);
      setPhase("error");
    }
  };

  const leave = () => {
    connRef.current?.close();
    connRef.current = null;
    setPhase("idle");
    setRoom("");
    setCode("");
    setProgress(null);
    setLargeFile(null);
    setStatus({ text: "Not connected", type: "idle" });
  };

  // Auto-connect from a QR / share link: /receive?room=ABC123
  useEffect(() => {
    const q = (searchParams.get("room") || "").toUpperCase();
    if (ROOM_RE.test(q)) {
      setCode(q.slice(0, CODE_LENGTH));
      connect(q);
    }
    return () => connRef.current?.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const cancelTransfer = () => {
    connRef.current?.cancelTransfer();
    setProgress(null);
    setLargeFile(null);
  };

  const chooseDisk = async () => {
    const id = largeFile?.id;
    setLargeFile(null);
    await connRef.current?.acceptDirectDisk(id);
  };

  const chooseRam = () => {
    const id = largeFile?.id;
    setLargeFile(null);
    connRef.current?.acceptRamMode(id);
  };

  const inMemory = files.filter((f) => f.blob);

  const downloadZip = async () => {
    if (inMemory.length === 0) return;
    setZipping(true);
    try {
      const { default: JSZip } = await import("jszip"); // loaded on demand, keeps it out of the main bundle
      const zip = new JSZip();
      for (const f of inMemory) zip.file(f.relativePath, f.blob);
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `meshlink-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (err) {
      toast.error("Couldn't build the ZIP", { description: err.message });
    } finally {
      setZipping(false);
    }
  };

  const openPreview = (file) => {
    const kind = fileKind(file.name);
    if (kind === "pdf") window.open(file.url, "_blank", "noopener");
    else setPreview({ kind, url: file.url, name: file.name });
  };

  const joined = phase === "waiting" || phase === "connected";
  const busy = phase === "connecting";

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Receive files</h1>
          <p className="mt-1 text-sm text-muted-foreground">Enter the code from the sending device, or scan its QR.</p>
        </div>
        <ConnectionStatus text={status.text} type={status.type} />
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[340px_1fr]">
        {/* Join */}
        <Card>
          <CardHeader>
            <CardTitle>{joined ? "Room" : "Join a room"}</CardTitle>
            <CardDescription>{joined ? "You're in. Keep this page open." : "The code is on the sender's screen."}</CardDescription>
            {joined && (
              <CardAction>
                <Button variant="ghost" size="sm" onClick={leave}>
                  <LogOut /> Leave
                </Button>
              </CardAction>
            )}
          </CardHeader>

          <CardContent className="space-y-4">
            {joined ? (
              <RoomCode code={room} />
            ) : (
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  connect(code);
                }}
              >
                <InputOTP
                  maxLength={CODE_LENGTH}
                  pattern={REGEXP_ONLY_DIGITS_AND_CHARS}
                  value={code}
                  onChange={(v) => setCode(v.toUpperCase())}
                  onComplete={(v) => (phaseRef.current === "idle" || phaseRef.current === "error") && connect(v)}
                  disabled={busy}
                  autoFocus
                  aria-label="Room code"
                  containerClassName="justify-center"
                >
                  <InputOTPGroup className="gap-1.5">
                    {Array.from({ length: CODE_LENGTH }, (_, i) => (
                      <InputOTPSlot
                        key={i}
                        index={i}
                        aria-invalid={phase === "error" || undefined}
                        className="h-12 w-10 rounded-lg border font-mono text-xl font-semibold first:rounded-lg last:rounded-lg"
                      />
                    ))}
                  </InputOTPGroup>
                </InputOTP>

                <Button type="submit" className="w-full" disabled={busy || code.length < CODE_LENGTH}>
                  {busy ? <Spinner /> : <ArrowRight />}
                  {busy ? "Connecting…" : "Connect"}
                </Button>

                <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <ScanLine className="size-3.5" /> Or scan the sender's QR with your camera
                </p>
              </form>
            )}

            {phase === "error" && (
              <Alert variant="destructive">
                <TriangleAlert />
                <AlertTitle>Couldn't connect</AlertTitle>
                <AlertDescription>
                  <p>{error || "Something went wrong."}</p>
                  {room && (
                    <Button variant="outline" size="sm" className="mt-3" onClick={() => connect(room)}>
                      <RotateCw /> Retry {room}
                    </Button>
                  )}
                </AlertDescription>
              </Alert>
            )}
            <SameNetworkNote />
          </CardContent>
        </Card>

        {/* Incoming */}
        <Card>
          <CardHeader>
            <CardTitle>Incoming</CardTitle>
            <CardDescription>
              {files.length ? `${files.length} received` : "Files appear here as they arrive."}
            </CardDescription>
            {inMemory.length >= 2 && (
              <CardAction>
                <Button variant="outline" size="sm" onClick={downloadZip} disabled={zipping}>
                  {zipping ? <Spinner /> : <Archive />}
                  {zipping ? "Zipping…" : "Download all"}
                </Button>
              </CardAction>
            )}
          </CardHeader>

          <CardContent className="space-y-5">
            <DeviceLink
              local={localDevice}
              peerLabel="Sender"
              peerName="Sending device"
              state={phase === "connected" ? "connected" : phase === "waiting" || busy ? "waiting" : "idle"}
            />

            {progress && (
              <TransferProgress
                title="Receiving"
                fileName={progress.fileName}
                percent={progress.percent}
                currentBytes={progress.currentBytes}
                totalBytes={progress.totalBytes}
                speedText={progress.speedText}
                etaText={progress.etaText}
                disk={progress.mode === "disk"}
                onCancel={cancelTransfer}
              />
            )}

            {files.length === 0 && !progress && (
              <Empty className="border border-dashed py-12">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    {phase === "waiting" || busy ? <Spinner /> : <Inbox />}
                  </EmptyMedia>
                  <EmptyTitle>
                    {phase === "connected"
                      ? "Ready to receive"
                      : phase === "waiting"
                        ? "Waiting for the sender"
                        : busy
                          ? "Connecting…"
                          : "No files yet"}
                  </EmptyTitle>
                  <EmptyDescription>
                    {phase === "connected"
                      ? "Files will download automatically as the sender sends them."
                      : phase === "waiting"
                        ? "You're in the room. The link opens as soon as the sender is online."
                        : "Join a room to start receiving."}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}

            {files.length > 0 && (
              <div className="max-h-[28rem] rounded-xl border border-border overflow-y-auto">
                <ul className="divide-y divide-border">
                  {files.map((file) => {
                    const kind = fileKind(file.name);
                    const canPreview = file.url && (kind === "image" || kind === "video" || kind === "pdf");
                    return (
                      <li key={file.id} className="space-y-2 px-3 py-2.5">
                        <div className="flex items-center gap-3">
                          <FileIcon name={file.name} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm" title={file.relativePath}>
                              {file.relativePath}
                            </p>
                            <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
                          </div>
                          {file.savedToDisk ? (
                            <Badge variant="secondary" className="text-success">
                              <CircleCheck /> Saved to disk
                            </Badge>
                          ) : (
                            <div className="flex gap-1">
                              {canPreview && (
                                <Button variant="ghost" size="icon-sm" onClick={() => openPreview(file)} aria-label={`Preview ${file.name}`}>
                                  <Eye />
                                </Button>
                              )}
                              <Button asChild variant="outline" size="sm">
                                <a href={file.url} download={file.name}>
                                  <Download /> Save
                                </a>
                              </Button>
                            </div>
                          )}
                        </div>
                        {kind === "audio" && file.url && <audio src={file.url} controls className="h-8 w-full" />}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Large file: the sender waits until the receiver picks where it goes. */}
      <Dialog open={!!largeFile}>
        <DialogContent showCloseButton={false} onEscapeKeyDown={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Large file incoming</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-foreground">{largeFile?.name}</span> is {formatBytes(largeFile?.size || 0)}.
              Saving straight to disk avoids running out of memory.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Button onClick={chooseDisk} className="h-auto justify-start py-3 text-left">
              <HardDrive />
              <span className="flex flex-col">
                <span>Save directly to disk</span>
                <span className="text-xs font-normal opacity-70">Recommended · choose a location now</span>
              </span>
            </Button>
            <Button variant="outline" onClick={chooseRam} className="h-auto justify-start py-3 text-left">
              <MemoryStick />
              <span className="flex flex-col">
                <span>Keep in memory</span>
                <span className="text-xs font-normal text-muted-foreground">Download when finished</span>
              </span>
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={cancelTransfer}>
              Cancel transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview */}
      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="truncate pr-8">{preview?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid place-items-center overflow-hidden rounded-lg bg-black/40">
            {preview?.kind === "image" && <img src={preview.url} alt={preview.name} className="max-h-[70vh] object-contain" />}
            {preview?.kind === "video" && <video src={preview.url} controls autoPlay className="max-h-[70vh]" />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
