import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Video, Loader2, ServerCog, ArrowLeft } from "lucide-react";
import "@livekit/components-styles";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import { Button } from "@gossip/ui";
import { useSession } from "@/stores/useSession";
import { useRelay } from "@/stores/useRelay";

type State =
  | { phase: "loading" }
  | { phase: "unconfigured" }
  | { phase: "error"; message: string }
  | { phase: "ready"; token: string; url: string };

export function CallPage() {
  const { workspaceId = "", channelId = "" } = useParams();
  const nav = useNavigate();
  const userId = useSession((s) => s.userId);
  const displayName = useSession((s) => s.displayName);
  const workspace = useRelay((s) => s.workspace);
  const channel = workspace?.channels.find((c) => c.id === channelId);
  const [state, setState] = useState<State>({ phase: "loading" });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const cfg = await fetch("/livekit-config").then((r) => r.json());
        if (!cfg.configured) {
          if (active) setState({ phase: "unconfigured" });
          return;
        }
        const room = `${workspaceId}:${channelId}`;
        const identity = userId ?? `guest-${Math.random().toString(36).slice(2, 8)}`;
        const res = await fetch("/livekit-token", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ room, identity, name: displayName || "Guest" }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "token request failed");
        if (active) setState({ phase: "ready", token: data.token, url: data.url });
      } catch (e) {
        if (active) setState({ phase: "error", message: e instanceof Error ? e.message : "Failed to start call" });
      }
    })();
    return () => {
      active = false;
    };
  }, [workspaceId, channelId, userId, displayName]);

  const back = () => nav(`/w/${workspaceId}/c/${channelId}`);

  if (state.phase === "ready") {
    return (
      <div className="flex min-h-0 flex-1 flex-col" data-lk-theme="default" style={{ background: "#0a0c0f" }}>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
          <span className="grid size-6 place-items-center rounded-md bg-[color:var(--accent-faint)] text-accent">
            <Video className="size-3.5" />
          </span>
          <span className="font-display text-[14px] font-bold text-text">Huddle · #{channel?.name ?? channelId}</span>
          <span className="ml-1 font-mono text-[10px] text-faint">LiveKit · E2E-capable</span>
        </header>
        <div className="min-h-0 flex-1">
          <LiveKitRoom
            token={state.token}
            serverUrl={state.url}
            connect
            video
            audio
            onDisconnected={back}
            style={{ height: "100%" }}
          >
            <VideoConference />
          </LiveKitRoom>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-0 flex-1 place-items-center bg-[#0a0c0f] p-6">
      <div className="max-w-md text-center">
        {state.phase === "loading" && (
          <>
            <Loader2 className="mx-auto size-7 animate-spin text-accent" />
            <p className="mt-3 text-[14px] text-muted">Connecting to the huddle…</p>
          </>
        )}
        {state.phase === "error" && (
          <>
            <p className="text-[15px] font-semibold text-danger">Couldn't start the call</p>
            <p className="mt-1 font-mono text-[12px] text-muted">{state.message}</p>
            <Button className="mt-4" variant="secondary" onClick={back}>
              <ArrowLeft className="size-4" /> Back to channel
            </Button>
          </>
        )}
        {state.phase === "unconfigured" && (
          <>
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[color:var(--accent-faint)] text-accent">
              <ServerCog className="size-6" />
            </span>
            <h2 className="mt-3 font-display text-xl font-bold text-text">Calls need a LiveKit project</h2>
            <p className="mt-1 text-[14px] leading-relaxed text-muted">
              Add a free LiveKit Cloud project's URL, API key, and secret to{" "}
              <span className="font-mono text-text">services/relay/.env</span> and restart the relay.
            </p>
            <Link to={`/w/${workspaceId}/c/${channelId}`}>
              <Button className="mt-4" variant="secondary">
                <ArrowLeft className="size-4" /> Back to channel
              </Button>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
