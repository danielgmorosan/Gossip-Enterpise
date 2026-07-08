import { relayUrl } from "./relayBase";

/**
 * Channel attachment upload (T-13). Channels only — the E2E DM path has no
 * SDK attachment support yet, and we never send DM files in the clear around
 * the crypto boundary.
 */
export interface AttachmentRef {
  id: string;
  url: string;
  name: string;
  type: string;
  size: number;
}

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // keep in sync with the relay

/** Image types the relay serves inline (SVG deliberately excluded — script-capable). */
export const INLINE_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif"]);

export async function uploadAttachment(file: File): Promise<AttachmentRef> {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error(`"${file.name}" is over the ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB limit.`);
  }
  if (file.size === 0) throw new Error(`"${file.name}" is empty.`);
  const q = new URLSearchParams({ name: file.name, type: file.type || "application/octet-stream" });
  const res = await fetch(relayUrl(`/uploads?${q}`), {
    method: "POST",
    headers: { "content-type": "application/octet-stream" },
    body: file,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Upload failed.");
  return data as AttachmentRef;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
