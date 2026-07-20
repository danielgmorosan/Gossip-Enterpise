// AudioWorklet ring buffer for screenshare audio (docs/screenshare-audio.md).
// Receives interleaved Float32 stereo PCM chunks (from the desktop shell's
// capture engine, via the main thread) and plays them out as a steady stream so
// MediaStreamAudioDestinationNode yields a publishable track. A small pre-buffer
// absorbs IPC jitter; if we underrun we output silence rather than glitching.

const PREBUFFER_CHUNKS = 3; // ~60ms at 20ms chunks before playback starts

class PcmRing extends AudioWorkletProcessor {
  constructor() {
    super();
    this.queue = []; // Float32Array chunks (interleaved stereo)
    this.readIndex = 0; // sample offset into queue[0]
    this.started = false;
    this.port.onmessage = (e) => {
      if (e.data === "flush") {
        this.queue.length = 0;
        this.readIndex = 0;
        this.started = false;
        return;
      }
      this.queue.push(new Float32Array(e.data));
      if (!this.started && this.queue.length >= PREBUFFER_CHUNKS) this.started = true;
    };
  }

  process(_inputs, outputs) {
    const out = outputs[0];
    const left = out[0];
    const right = out[1] ?? out[0];
    const frames = left.length;

    for (let i = 0; i < frames; i++) {
      let l = 0;
      let r = 0;
      if (this.started && this.queue.length) {
        const chunk = this.queue[0];
        l = chunk[this.readIndex] || 0;
        r = chunk[this.readIndex + 1] || 0;
        this.readIndex += 2;
        if (this.readIndex >= chunk.length) {
          this.queue.shift();
          this.readIndex = 0;
          if (this.queue.length === 0) this.started = false; // re-buffer on drain
        }
      }
      left[i] = l;
      if (right !== left) right[i] = r;
    }
    return true; // keep the processor alive
  }
}

registerProcessor("pcm-ring", PcmRing);
