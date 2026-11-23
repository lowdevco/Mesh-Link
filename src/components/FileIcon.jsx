import React from "react";
import { File, FileArchive, FileAudio, FileImage, FileText, FileVideo } from "lucide-react";
import { cn } from "@/lib/utils";

export function fileKind(name = "") {
  if (/\.(jpe?g|png|gif|webp|svg|bmp|avif)$/i.test(name)) return "image";
  if (/\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(name)) return "audio";
  if (/\.(mp4|webm|mov|mkv)$/i.test(name)) return "video";
  if (/\.pdf$/i.test(name)) return "pdf";
  if (/\.(zip|rar|7z|tar|gz)$/i.test(name)) return "archive";
  return "file";
}

const map = {
  image: [FileImage, "text-sky-400 bg-sky-400/10"],
  audio: [FileAudio, "text-amber-400 bg-amber-400/10"],
  video: [FileVideo, "text-rose-400 bg-rose-400/10"],
  pdf: [FileText, "text-red-400 bg-red-400/10"],
  archive: [FileArchive, "text-violet-400 bg-violet-400/10"],
  file: [File, "text-muted-foreground bg-muted"],
};

export default function FileIcon({ name, className }) {
  const [Icon, tone] = map[fileKind(name)];
  return (
    <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", tone, className)} aria-hidden="true">
      <Icon className="size-4" />
    </span>
  );
}
