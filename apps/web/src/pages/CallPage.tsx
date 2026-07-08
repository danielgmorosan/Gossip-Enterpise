import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import type { RoomOptions } from "livekit-client";
import { Video, Loader2, ServerCog, ArrowLeft } from "lucide-react";
import "@livekit/components-styles";
import { RoomContext, VideoConference } from "@livekit/components-react";
import { Button } from "@gossip/ui/stack";
import { useSession } from "@/stores/useSession";
import { useRelay } from "@/stores/useRelay";
import { useContacts } from "@/stores/useContacts";
import { useAudioSettings } from "@/stores/useAudioSettings";
import { useCall, sameTarget, type CallTarget } from "@/stores/useCall";
import { relayUrl } from "@/lib/relayBase";
import { dmRoomName } from "@/lib/call";
import { truncateHandle } from "@/lib/utils";

type State =
  | { phase: "loading" }
  | { phase: "unconfigured" }
  | { phase: "error"; message: string }
  | { phase: "ready" };

/**
 * Call surface. The LiveKit Room itself lives in the global call store (T-14),
 * NOT in this component — navigating away keeps the call alive (the CallDock
 * takes over audio + controls); coming back re-binds the UI to the same room.
 */
export function CallPage() {
  // Channel call: /w/:workspaceId/call/:channelId — DM call: /w/:workspaceId/call/dm/:peerId
  const { workspaceId = "", channelId = "", peerId = "" } = useParams();
  const isDm = !!peerId;
  const nav = useNavigate();
  const userId = useSession((s) => s.userId);
  const displayName = useSession((s) => s.displayName);
  const workspace = useRelay((s) => s.workspace);
  const channel = workspace?.channels.find((c) => c.id === channelId);
  const peerName = useContacts((s) => s.contacts.find((c) => c.userId === peerId)?.name);
  const callRoom = useCall((s) => s.room);
  const callStatus = useCall((s) => s.status);
  const callTarget = useCall((s) => s.target);
  const [state, setState] = useState<State>({ phase: "loading" });

  const target = useMemo<CallTarget>(
    () =>
      isDm
        ? { kind: "dm", workspaceId, peerId, label: peerName || truncateHandle(peerId, 10, 4) }
        : { kind: "channel", workspaceId, channelId, label: channel?.name ?? channelId },
    [isDm, workspaceId, channelId, peerId, peerName, channel?.name],
  );

  // Persisted audio prefs (Settings → Calls & audio) → LiveKit room options.
  const audio = useAudioSettings();
  const roomOptions = useMemo<RoomOptions>(
    () => ({
      audioCaptureDefaults: {
        deviceId: audio.inputId || undefined,
        echoCancellation: audio.echoCancellation,
        noiseSuppression: audio.noiseSuppression,
        autoGainControl: audio.autoGainControl,
      },
      ...(audio.outputId ? { audioOutput: { deviceId: audio.outputId } } : {}),
    }),
    [audio.inputId, audio.outputId, audio.echoCancellation, audio.noiseSuppression, audio.autoGainControl],
  );

  const back = () =>
    nav(isDm ? `/w/${workspaceId}/dm/${encodeURIComponent(peerId)}` : `/w/${workspaceId}/c/${channelId}`);

  // Join (or re-bind to) the call. Idempotent: if the store is already on this
  // target the connect() is a no-op and we just render the existing room.
  const ran = useRef(false);
  useEffect(() => {
    if (useCall.getState().status !== "idle" && sameTarget(useCall.getState().target, target)) {
      setState({ phase: "ready" });
      return;
    }
    if (ran.current) return;
    ran.current = true;
    let active = true;
    (async () => {
      try {
        const cfg = await fetch(relayUrl("/livekit-config")).then((r) => r.json());
        if (!cfg.configured) {
          if (active) setState({ phase: "unconfigured" });
          return;
        }
        let room: string;
        if (isDm) {
          if (!userId) throw new Error("Unlock your session to start a DM call.");
          // Opaque digest of the sorted pair — both sides derive the same room.
          room = await dmRoomName(userId, peerId);
        } else {
          room = `${workspaceId}:${channelId}`;
        }
        const identity = userId ?? `guest-${Math.random().toString(36).slice(2, 8)}`;
        const res = await fetch(relayUrl("/livekit-token"), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ room, identity, name: displayName || "Guest" }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "token request failed");
        await useCall.getState().connect({ url: data.url, token: data.token, target, options: roomOptions });
        if (active) setState({ phase: "ready" });
      } catch (e) {
        if (active) setState({ phase: "error", message: e instanceof Error ? e.message : "Failed to start call" });
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- join once per mount; store handles idempotency
  }, []);

  // If the call ends while we're on this page (dock leave, in-call leave,
  // server disconnect), bounce back to the conversation.
  const wasLive = useRef(false);
  useEffect(() => {
    if (callStatus !== "idle") wasLive.current = true;
    else if (wasLive.current) back();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callStatus]);

  const boundToThisCall = callRoom && callStatus !== "idle" && sameTarget(callTarget, target);

  if (state.phase === "ready" && boundToThisCall) {
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-paper font-stack" data-lk-theme="default">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line bg-paper px-4 font-stack">
          <span className="grid size-6 place-items-center rounded-control bg-field text-ink">
            <Video className="size-3.5" />
          </span>
          <span className="text-[14px] font-semibold text-ink">
            {isDm ? `Call · ${peerName || truncateHandle(peerId, 10, 4)}` : `Huddle · #${channel?.name ?? channelId}`}
          </span>
          <span className="ml-1 font-mono text-[10px] text-ink-faint">LiveKit · E2E-capable</span>
          <span className="ml-auto text-[11px] text-ink-faint">navigating away keeps the call running</span>
        </header>
        <div className="min-h-0 flex-1">
          {callStatus === "connected" ? (
            <RoomContext.Provider value={callRoom}>
              <VideoConference />
            </RoomContext.Provider>
          ) : (
            <div className="grid h-full place-items-center text-ink-mute">
              <span className="inline-flex items-center gap-2 text-[14px]">
                <Loader2 className="size-5 animate-spin" /> Connecting…
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-0 flex-1 place-items-center bg-paper p-6 font-stack">
      <div className="max-w-md text-center">
        {state.phase === "loading" && (
          <>
            <Loader2 className="mx-auto size-7 animate-spin text-ink-mute" />
            <p className="mt-3 text-[14px] text-ink-mute">Connecting to the huddle…</p>
          </>
        )}
        {state.phase === "error" && (
          <>
            <p className="text-[15px] font-semibold text-negative">Couldn't start the call</p>
            <p className="mt-1 font-mono text-[12px] text-ink-mute">{state.message}</p>
            <Button className="mt-4" variant="secondary" onClick={back}>
              <ArrowLeft className="size-4" /> Back to channel
            </Button>
          </>
        )}
        {state.phase === "unconfigured" && (
          <>
            <span className="mx-auto grid size-12 place-items-center rounded-card bg-field text-ink">
              <ServerCog className="size-6" />
            </span>
            <h2 className="mt-3 text-xl font-bold tracking-tight text-ink">Calls need a LiveKit project</h2>
            <p className="mt-1 text-[14px] leading-relaxed text-ink-mute">
              Add a free LiveKit Cloud project's URL, API key, and secret to{" "}
              <span className="font-mono text-ink">services/relay/.env</span> and restart the relay.
            </p>
            <Link to={isDm ? `/w/${workspaceId}/dm/${encodeURIComponent(peerId)}` : `/w/${workspaceId}/c/${channelId}`}>
              <Button className="mt-4" variant="secondary">
                <ArrowLeft className="size-4" /> {isDm ? "Back to conversation" : "Back to channel"}
              </Button>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
