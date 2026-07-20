# Umbry loopback capturer (Windows) — Phase 2

Native WASAPI **process-loopback** capturer for echo-free screenshare audio. It
captures system audio while **excluding Umbry's own process tree**, so the call
playback (everyone's voices) is never recaptured → no echo. It can also capture
only a single app (for window share). Outputs raw interleaved **48 kHz stereo
32-bit float** PCM on stdout. See `../../../../docs/screenshare-audio.md`.

## 1. Build
Requires **Visual Studio Build Tools** (Desktop C++ workload) + **Windows SDK
10.0.20348 or newer** (process-loopback headers). Open the **x64 Native Tools
Command Prompt for VS**, then:

```
cd apps\desktop\native\loopback
build.bat
```

Produces `loopback.exe` next to the source.

## 2. Test it standalone (no Umbry, no call needed)
This is the key checkpoint — prove the capture works in isolation first.

Play some music (Spotify/YouTube), then capture ~5 seconds of everything except a
chosen process to a file:

```
loopback.exe --pid 0 --mode exclude > out.f32
```

(`--pid 0` excludes nothing → captures all system audio; or pass a real PID to
exclude, e.g. a Notepad instance.) Press Ctrl+C to stop, then play the raw PCM:

```
ffplay -f f32le -ar 48000 -ch_layout stereo out.f32
```

(or import into Audacity as *Raw Data → 32-bit float, little-endian, 2 channels,
48000 Hz*). **You should hear the music.** If you exclude a music app's PID, that
app should be silent while everything else remains. That confirms capture +
exclusion work.

## 3. In Umbry
`apps/desktop/src/audioCapture.ts` auto-detects this exe (dev: this folder;
packaged: resources root) and spawns `loopback.exe --pid <umbry-main-pid> --mode
exclude`, streaming its PCM to the renderer in place of the Phase-1 test tone. So
once `loopback.exe` is built here, a **dev run** uses real capture automatically.

Test end to end: dev-run the shell, join a call with a second participant, share
screen with audio → they hear your system audio, and **no one hears an echo**.

## Modes
- `--mode exclude --pid <umbry>` — whole-screen share (everything but Umbry).
- `--mode include --pid <app>`  — window share (only that app's audio).

## Packaging (later, after validation)
Add a CI build step (MSVC on the windows runner) and ship `loopback.exe` via
electron-builder `extraResources`. Deferred until the capture is confirmed good
on real hardware.
