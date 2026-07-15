/**
 * Media helpers (T3): inline image/GIF URLs, and E2E image sending for DMs.
 *
 * DMs can't use the relay's upload store (that would leak E2E content), and
 * the gossip-sdk has no attachment API — so DM images travel INSIDE the
 * encrypted message text as a compressed data-URI marker. Small, but truly
 * end-to-end: the image bytes get the same crypto as the words around them.
 */

/** Direct link to an image/GIF file → rendered inline, Discord-style. */
export function isImageUrl(url: string): boolean {
  try {
    return /\.(png|jpe?g|gif|webp|avif)$/i.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

const IMG_PREFIX = "[[img:";
const IMG_SUFFIX = "]]";
/** Keep encrypted messages lean — ~128KB of base64 after compression. */
const MAX_MARKER_CHARS = 150_000;

export function imageMarkerBody(dataUrl: string): string {
  return `${IMG_PREFIX}${dataUrl}${IMG_SUFFIX}`;
}

/** The data-URI, if `body` is exactly a DM image marker; null otherwise. */
export function parseImageMarker(body: string | null | undefined): string | null {
  if (!body || !body.startsWith(IMG_PREFIX) || !body.endsWith(IMG_SUFFIX)) return null;
  const uri = body.slice(IMG_PREFIX.length, -IMG_SUFFIX.length);
  return uri.startsWith("data:image/") ? uri : null;
}

/** Downscale + compress an image file until it fits in a DM marker. */
export async function fileToDmImageDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Only images can be sent in E2E DMs for now.");
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not read that image."));
      el.src = objectUrl;
    });
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 900 / Math.max(img.width, img.height));
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable.");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.8, 0.6, 0.45, 0.3]) {
      const uri = canvas.toDataURL("image/webp", quality);
      if (uri.length <= MAX_MARKER_CHARS) return uri;
    }
    throw new Error("That image is too detailed to fit in an encrypted DM. Try a smaller one.");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
