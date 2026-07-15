/**
 * Notification sounds (T3) - synthesized via WebAudio: no assets, no network,
 * nothing to load. One shared AudioContext, lazily created and resumed on
 * first use (autoplay policy: until the user has interacted once, the context
 * may stay suspended - we fail silent, never throw).
 */

let ctx: AudioContext | null = null;

function audioCtx(): AudioContext | null {
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx ??= new Ctor();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** One soft sine note with a fast decay. */
function note(c: AudioContext, freq: number, at: number, dur: number, peak = 0.07) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(at);
  osc.stop(at + dur + 0.05);
}

/** Message chime: quick ascending two-tone (Slack/Discord-adjacent, quiet). */
export function playChime() {
  const c = audioCtx();
  if (!c) return;
  const t = c.currentTime;
  note(c, 740, t, 0.16); // F#5
  note(c, 988, t + 0.09, 0.22); // B5
}

/** Call-event chime: brighter three-tone rise, still short. */
export function playCallChime() {
  const c = audioCtx();
  if (!c) return;
  const t = c.currentTime;
  note(c, 659, t, 0.14); // E5
  note(c, 831, t + 0.1, 0.14); // G#5
  note(c, 988, t + 0.2, 0.26); // B5
}

/** Someone joined the call: short ascending blip (Discord-style). */
export function playJoinBlip() {
  const c = audioCtx();
  if (!c) return;
  const t = c.currentTime;
  note(c, 523, t, 0.1, 0.06); // C5
  note(c, 784, t + 0.07, 0.16, 0.06); // G5
}

/** Someone left the call: the same blip descending. */
export function playLeaveBlip() {
  const c = audioCtx();
  if (!c) return;
  const t = c.currentTime;
  note(c, 784, t, 0.1, 0.06);
  note(c, 523, t + 0.07, 0.16, 0.06);
}

/** The call ended (you hung up or were disconnected): low resolving two-tone. */
export function playCallEnd() {
  const c = audioCtx();
  if (!c) return;
  const t = c.currentTime;
  note(c, 494, t, 0.16, 0.06); // B4
  note(c, 330, t + 0.12, 0.3, 0.06); // E4
}

let ringTimer: ReturnType<typeof setInterval> | null = null;

/** One "brrring" burst: two close tones beating against each other. */
function ringBurst(c: AudioContext) {
  const t = c.currentTime;
  for (const f of [440, 480]) {
    note(c, f, t, 0.9, 0.05);
    note(c, f, t + 1.1, 0.9, 0.05);
  }
}

/**
 * Looping incoming-call ring (classic double-burst every ~3s) + vibration on
 * devices that support it. Call stopRing() to end; starting twice is a no-op.
 */
export function startRing() {
  if (ringTimer) return;
  const c = audioCtx();
  const burst = () => {
    if (c) ringBurst(c);
    try {
      navigator.vibrate?.([400, 200, 400]);
    } catch {
      /* unsupported */
    }
  };
  burst();
  ringTimer = setInterval(burst, 3200);
}

export function stopRing() {
  if (ringTimer) clearInterval(ringTimer);
  ringTimer = null;
  try {
    navigator.vibrate?.(0);
  } catch {
    /* unsupported */
  }
}
