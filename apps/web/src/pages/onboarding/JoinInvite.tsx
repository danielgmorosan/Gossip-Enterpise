import { useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useSession } from "@/stores/useSession";
import { useRelay } from "@/stores/useRelay";
import { setPendingInvite } from "@/lib/invite";

/**
 * Invite-link landing: /join/:code.
 * Open session → join immediately and drop into the workspace.
 * No session → stash the code and route through identity unlock/create;
 * WorkspaceJoin picks the code back up prefilled.
 */
export function JoinInvite() {
  const { code = "" } = useParams();
  const nav = useNavigate();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const clean = code.trim().toUpperCase();
    if (!clean) {
      nav("/workspace/join", { replace: true });
      return;
    }
    setPendingInvite(clean);

    const { status } = useSession.getState();
    if (status === "open") {
      useRelay
        .getState()
        .joinWorkspace(clean)
        .then((res) => {
          if (res.ok) nav(`/w/${res.workspace.id}`, { replace: true });
          else nav("/workspace/join", { replace: true }); // prefilled; shows the form + error path
        });
      return;
    }

    // No open session: returning users unlock, new users create an identity first.
    const hasIdentity = !!localStorage.getItem("gossip-display-name");
    nav(hasIdentity ? "/identity/unlock" : "/identity/create?next=join", { replace: true });
  }, [code, nav]);

  return (
    <div className="grid min-h-dvh place-items-center bg-paper font-stack text-ink-mute">
      <div className="flex items-center gap-2 text-[14px]">
        <Loader2 className="size-5 animate-spin" /> Opening your invite…
      </div>
    </div>
  );
}
