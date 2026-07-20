# Screenshare audio — echo-free capture (native, from scratch)

> **Problem.** Screen share uses `getDisplayMedia({ systemAudio: "include" })`, which
> captures the **whole system audio mix**. That mix already contains the call playback
> (remote participants' voices coming out of your speakers), so we re-publish everyone's
> voices back into the call → each remote hears themselves = echo/feedback.
>
> **Why it can't be fixed in Chromium.** `getDisplayMedia` system audio is all-or-nothing;
> there is no "system audio minus my own process" API. WebRTC's AEC only runs on the *mic*
> track. Headphones don't help — this is the digital output mix, captured before the speakers.
>
> **Fix.** Capture audio natively with **our own process excluded** (or capture only the
> shared app's audio), and feed that clean PCM into a `MediaStreamTrack` we publish instead
> of the browser loopback.

## Architecture

```
 ┌─────────────── native (per-OS, main process) ───────────────┐
 │  capture engine: system audio EXCLUDING Umbry's own process  │
 │   macOS  → ScreenCaptureKit SCStream + SCContentFilter        │
 │            (excludingApplications: [Umbry])                   │
 │   Windows→ WASAPI process loopback (AUDIOCLIENT_ACTIVATION_   │
 │            PARAMS, PROCESS_LOOPBACK_MODE_EXCLUDE_TARGET_TREE)  │
 │   Linux  → PipeWire stream (target = sink monitor, filter     │
 │            our node) — hardest / least standard               │
 └───────────────┬──────────────────────────────────────────────┘
                 │ float32 PCM frames (48kHz, stereo) + format
                 │ over an Electron IPC / MessagePort channel
                 ▼
 ┌─────────────── renderer (the SPINE — cross-OS, TS) ──────────┐
 │  AudioContext(48k) → AudioWorklet ringbuffer source →         │
 │  MediaStreamAudioDestinationNode → .stream.getAudioTracks()[0]│
 │  → LiveKit localParticipant.publishTrack(track,               │
 │       { source: ScreenShareAudio })                           │
 └──────────────────────────────────────────────────────────────┘
```

The **spine is one implementation for all OSes**; only the capture engine is per-OS. Prove
the spine + one OS end-to-end first, then the other two are "just" another capture backend.

### The hard part: native PCM → MediaStreamTrack (no virtual audio driver)
We deliberately avoid installing a virtual audio device (a kernel/driver dependency and a
signing/permissions nightmare). Instead:
1. Native engine captures process-excluded PCM in the **main** process.
2. Frames stream to the **renderer** over a dedicated `MessagePort` (transferable
   `ArrayBuffer`s; avoid the main IPC queue for realtime audio).
3. An **AudioWorklet** with a lock-free ring buffer plays the frames into a Web Audio graph.
4. `MediaStreamAudioDestinationNode.stream` yields a real `MediaStreamTrack` we publish via
   LiveKit as `ScreenShareAudio` — the video track stays exactly as today.

Video is unchanged; we only swap the **audio** source of the share.

## Integration points (existing code)
- `apps/web/src/stores/useCall.ts` `toggleScreen`: today calls
  `setScreenShareEnabled(enabling, { systemAudio: "include", ... })`. New path: request
  **video-only** display media, and separately publish the native audio track when the
  desktop capture engine is available.
- `apps/desktop/src/main.ts`: `setDisplayMediaRequestHandler` already returns
  `{ video: source, audio: "loopback" }` — drop `audio: "loopback"` when native capture is
  active; the native engine supplies audio instead.
- `apps/desktop/src/preload.ts`: add a narrow `umbryDesktop.audioCapture` surface (start,
  stop, onFrames MessagePort) — same hardened pattern as `screen` / `updater`.

## Phasing (build order)
1. **Spine + Windows** *(Daniel can test on his own machine — fastest loop)*: AudioWorklet
   bridge + MessagePort + LiveKit publish; WASAPI process-loopback capturer. Prove: share a
   YouTube video in a 2-person call, remote hears the video but **not** themselves.
2. **macOS**: ScreenCaptureKit capturer behind the same spine. (Electron 38 pin still holds.)
3. **Linux**: PipeWire capturer. Gate the feature off where PipeWire isn't present.

Each native capturer ships as a prebuilt N-API addon per os/arch (or a signed helper), built
in CI on that OS runner — I write it, CI/you build it, we iterate on real audio.

## Fallback / safety
- If the native engine is unavailable or errors, fall back to **video-only** share (no echo)
  rather than the old system-audio loopback. Never regress to the feedback loop.
- A per-call toggle "share system audio" stays, but now maps to the clean native path.

## Considered and rejected
- **AEC on the loopback using the remote mix as reference** (cross-platform, no native): can
  cancel the call-audio portion while keeping a shared video's audio, but it's imperfect
  (residual echo, cancels wanted content that resembles the reference) and fiddly. Keep as a
  possible degraded fallback, not the primary.
- **Virtual audio driver**: works but adds a kernel-level dependency, install friction, and
  signing/permission problems. Rejected.
- **Tab/window-only audio**: Chromium can't reliably capture window-specific audio in the
  Electron shell (see the existing note in `main.ts`).
