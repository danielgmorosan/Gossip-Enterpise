/**
 * Pinned third-party service binaries for the native self-host stack.
 *
 * These are the upstream releases Umbry downloads on demand so self-hosting
 * doesn't require Docker. Everything here is deliberately explicit:
 *
 *  - Versions are PINNED. We don't resolve "latest" at runtime, so a compromised
 *    or simply broken upstream release can't silently become what users run.
 *  - Every archive has a PINNED sha256, checked after download. This is not
 *    trust-on-first-use: the expected hash ships in the app binary. LiveKit
 *    publishes checksums.txt; Ollama exposes a digest via the GitHub API.
 *  - Only official release URLs. No mirrors, no redirectors.
 *
 * Bumping a version means updating BOTH the version and every sha256 — if they
 * disagree the download is rejected, which is the intended failure mode.
 */

export type Platform = "win32" | "darwin" | "linux";
export type Arch = "x64" | "arm64";

export interface Download {
  url: string;
  sha256: string;
  /** Archive kind, decides how we unpack it. */
  format: "zip" | "tar.gz" | "tar.zst";
  /** Path of the executable inside the archive, once extracted. */
  binPath: string;
}

// ── LiveKit (calls) — Apache-2.0 ────────────────────────────────────────────
// NOTE: upstream publishes NO macOS build. On darwin we ship our own binary
// built from source in CI (permitted by the license) — see nativeStack.ts,
// which falls back to that before giving up.
const LIVEKIT_VERSION = "1.13.4";
const LK = (file: string, sha256: string, format: Download["format"], bin: string): Download => ({
  url: `https://github.com/livekit/livekit/releases/download/v${LIVEKIT_VERSION}/${file}`,
  sha256,
  format,
  binPath: bin,
});

export const LIVEKIT: Partial<Record<`${Platform}-${Arch}`, Download>> = {
  "win32-x64": LK(
    `livekit_${LIVEKIT_VERSION}_windows_amd64.zip`,
    "a326e025de516e93dfb3719bcd28e5a4ac16f21bcf1ef562499403ca98cc65fe",
    "zip",
    "livekit-server.exe",
  ),
  "win32-arm64": LK(
    `livekit_${LIVEKIT_VERSION}_windows_arm64.zip`,
    "fa9e4174915f8635ee98124459b42630b063ef5680ee054a0cc10209bc60df17",
    "zip",
    "livekit-server.exe",
  ),
  "linux-x64": LK(
    `livekit_${LIVEKIT_VERSION}_linux_amd64.tar.gz`,
    "549bcbe07a92685e45dfd98d8e7cbafd0e1c91d3502fd417079162e1a3f18d17",
    "tar.gz",
    "livekit-server",
  ),
  "linux-arm64": LK(
    `livekit_${LIVEKIT_VERSION}_linux_arm64.tar.gz`,
    "691d34c0d0095a3d5c6dfb9d7e9353a0600a3423d498136037001626d281ad64",
    "tar.gz",
    "livekit-server",
  ),
};

// ── Ollama (AI) — MIT ───────────────────────────────────────────────────────
// The Windows/Linux archives are ~1.4GB because they carry CUDA/ROCm GPU
// runtimes; darwin is 139MB since Metal is part of the OS.
const OLLAMA_VERSION = "0.32.1";
const OL = (file: string, sha256: string, format: Download["format"], bin: string): Download => ({
  url: `https://github.com/ollama/ollama/releases/download/v${OLLAMA_VERSION}/${file}`,
  sha256,
  format,
  binPath: bin,
});

export const OLLAMA: Partial<Record<`${Platform}-${Arch}`, Download>> = {
  "win32-x64": OL(
    "ollama-windows-amd64.zip",
    "d5abdc21b64ee928d3c92880ac22da5e5b0a46b8b07179791dd8c711b35f8397",
    "zip",
    "ollama.exe",
  ),
  "win32-arm64": OL(
    "ollama-windows-arm64.zip",
    "4a4a6c3e5ab4633ed12b4014fa2b194da3ecdb1f6f63fab4f68f28d9a3d40c6c",
    "zip",
    "ollama.exe",
  ),
  "darwin-x64": OL(
    "ollama-darwin.tgz",
    "346d28fe70f3ef3776e42100f5721510aa35fc07f3733f6629dbb117b1cfede9",
    "tar.gz",
    "ollama",
  ),
  "darwin-arm64": OL(
    "ollama-darwin.tgz",
    "346d28fe70f3ef3776e42100f5721510aa35fc07f3733f6629dbb117b1cfede9",
    "tar.gz",
    "ollama",
  ),
  // linux ships .tar.zst, which needs a zstd-capable tar. Handled as a
  // best-effort in nativeStack.ts; Linux users are pointed at their package
  // manager or the Docker path when it isn't available.
  "linux-x64": OL(
    "ollama-linux-amd64.tar.zst",
    "83b1f22841eb7f6c4900c6797f960ebaa09466874442ea5b8ae3da6980d3914c",
    "tar.zst",
    "bin/ollama",
  ),
};

export const VERSIONS = { livekit: LIVEKIT_VERSION, ollama: OLLAMA_VERSION };

export function platformKey(): `${Platform}-${Arch}` {
  const p = process.platform as Platform;
  const a = process.arch === "arm64" ? "arm64" : "x64";
  return `${p}-${a}`;
}
