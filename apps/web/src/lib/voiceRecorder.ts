/**
 * Voice-message recorder (T3): wraps MediaRecorder to produce a compact
 * audio File suitable for the channel upload path. Picks the best supported
 * mime type (Chrome/Firefox → webm/opus, Safari → mp4/aac).
 */
export interface VoiceRecording {
  file: File;
  durationMs: number;
}

function pickMime(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  for (const t of candidates) if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) return t;
  return "";
}

export class VoiceRecorder {
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: BlobPart[] = [];
  private startedAt = 0;

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = pickMime();
    this.recorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined);
    this.chunks = [];
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.start();
    this.startedAt = performance.now();
  }

  /** Stop and resolve the recording, or null if it was too short (<400ms). */
  stop(): Promise<VoiceRecording | null> {
    return new Promise((resolve) => {
      const rec = this.recorder;
      if (!rec) return resolve(null);
      rec.onstop = () => {
        const durationMs = Math.round(performance.now() - this.startedAt);
        this.cleanup();
        if (durationMs < 400 || this.chunks.length === 0) return resolve(null);
        const type = rec.mimeType?.split(";")[0] || "audio/webm";
        const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
        const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        const blob = new Blob(this.chunks, { type });
        const file = new File([blob], `voice-${stamp}.${ext}`, { type });
        resolve({ file, durationMs });
      };
      try {
        rec.stop();
      } catch {
        this.cleanup();
        resolve(null);
      }
    });
  }

  cancel(): void {
    try {
      this.recorder?.stop();
    } catch {
      /* ignore */
    }
    this.cleanup();
  }

  private cleanup() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.recorder = null;
  }
}

export function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
