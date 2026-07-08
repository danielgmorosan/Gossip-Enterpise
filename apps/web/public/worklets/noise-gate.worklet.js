/**
 * Noise gate + gain AudioWorklet (T-15).
 *
 * Runs on the audio rendering thread. Per 128-frame block:
 *  - RMS level → dB; gate opens above `thresholdDb` (with ~150 ms hold and
 *    smoothed attack/release so speech onsets aren't clipped),
 *  - output = input * gateEnvelope * 10^(gainDb/20),
 *  - posts throttled VAD state ({ speaking, levelDb }) to the main thread.
 *
 * Parameters arrive via processorOptions initially and port messages live.
 */
class NoiseGateProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opts = (options && options.processorOptions) || {};
    this.thresholdDb = typeof opts.thresholdDb === "number" ? opts.thresholdDb : -45;
    this.gainDb = typeof opts.gainDb === "number" ? opts.gainDb : 0;
    this.open = 0; // gate envelope 0..1
    this.holdMs = 150;
    this.holdUntil = 0;
    this.speaking = false;
    this.lastPost = 0;
    this.port.onmessage = (e) => {
      const d = e.data || {};
      if (typeof d.thresholdDb === "number") this.thresholdDb = d.thresholdDb;
      if (typeof d.gainDb === "number") this.gainDb = d.gainDb;
    };
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || input.length === 0 || !input[0]) return true;

    const ch0 = input[0];
    let sum = 0;
    for (let i = 0; i < ch0.length; i++) sum += ch0[i] * ch0[i];
    const rms = Math.sqrt(sum / ch0.length);
    const db = 20 * Math.log10(rms + 1e-8);

    const nowMs = currentTime * 1000;
    const above = db > this.thresholdDb;
    if (above) this.holdUntil = nowMs + this.holdMs;
    const wantOpen = above || nowMs < this.holdUntil;

    // Fast attack (~a few blocks), slow release — avoids chopping word tails.
    const step = wantOpen ? 0.5 : 0.03;
    this.open += (wantOpen ? 1 - this.open : -this.open) * step;

    const gain = this.open * Math.pow(10, this.gainDb / 20);
    for (let c = 0; c < output.length; c++) {
      const inC = input[c] || ch0;
      const outC = output[c];
      for (let i = 0; i < outC.length; i++) outC[i] = inC[i] * gain;
    }

    const speaking = wantOpen && this.open > 0.5;
    if (speaking !== this.speaking || nowMs - this.lastPost > 250) {
      this.speaking = speaking;
      this.lastPost = nowMs;
      this.port.postMessage({ speaking, levelDb: Math.round(db) });
    }
    return true;
  }
}

registerProcessor("noise-gate", NoiseGateProcessor);
