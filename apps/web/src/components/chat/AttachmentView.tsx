import { FileText, Download, Mic } from "lucide-react";
import { relayUrl } from "@/lib/relayBase";
import { formatBytes, INLINE_IMAGE_TYPES, type AttachmentRef } from "@/lib/uploads";
import { useLightbox } from "@/components/ImageLightbox";

/** Inline render of a channel attachment: image, voice player, or file card. */
export function AttachmentView({ a }: { a: AttachmentRef }) {
  const href = relayUrl(a.url);
  // Voice message (T3): a compact player instead of a download card.
  if (a.type.startsWith("audio/") || a.name.startsWith("voice-")) {
    return (
      <div className="mt-1 flex w-fit max-w-sm items-center gap-2.5 rounded-card border border-line bg-paper-2 px-3 py-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-field text-ink">
          <Mic className="size-4" />
        </span>
        <audio src={href} controls preload="metadata" className="h-9 max-w-[240px]" />
      </div>
    );
  }
  if (INLINE_IMAGE_TYPES.has(a.type)) {
    return (
      <button
        onClick={() => useLightbox.getState().open({ src: href, alt: a.name })}
        title={a.name}
        className="mt-1 block w-fit cursor-zoom-in"
      >
        <img
          src={href}
          alt={a.name}
          loading="lazy"
          className="max-h-72 max-w-sm rounded-card border border-line bg-field object-contain"
        />
      </button>
    );
  }
  return (
    <a
      href={href}
      download={a.name}
      className="mt-1 flex w-fit items-center gap-3 rounded-card border border-line bg-paper-2 px-3 py-2.5 transition-colors hover:border-line-strong"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-control bg-field text-ink">
        <FileText className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block max-w-[240px] truncate text-[13.5px] font-medium text-ink">{a.name}</span>
        <span className="text-[11.5px] text-ink-faint">{formatBytes(a.size)}</span>
      </span>
      <Download className="ml-1 size-4 shrink-0 text-ink-mute" />
    </a>
  );
}
