import { createAvatar } from "@dicebear/core";
import { identicon } from "@dicebear/collection";

/**
 * DiceBear identicon avatars (GitHub-style, developer-flavored).
 * Deterministic: same seed → same SVG, on every device, with no server —
 * so peers see the same default avatar for a handle without any sync.
 */
const cache = new Map<string, string>();

export function dicebearUri(seed: string): string {
  let uri = cache.get(seed);
  if (!uri) {
    uri = createAvatar(identicon, { seed }).toDataUri();
    cache.set(seed, uri);
  }
  return uri;
}

export function randomSeed(): string {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const AVATAR_SIZE = 128;

/**
 * Validate + downscale an uploaded image to a small square data URL.
 * Everything happens locally (canvas); nothing leaves the device.
 */
export async function fileToAvatarDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file.");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("Image must be under 2 MB.");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not read that image."));
      el.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable.");
    // cover-crop to a centered square, then downscale
    const m = Math.min(img.width, img.height);
    ctx.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
    return canvas.toDataURL("image/webp", 0.9);
  } finally {
    URL.revokeObjectURL(url);
  }
}
