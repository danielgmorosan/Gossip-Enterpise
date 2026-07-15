import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Hash, Loader2, Plus } from "lucide-react";
import { Button } from "@gossip/ui/stack";
import { useRelay } from "@/stores/useRelay";
import { CreateChannelDialog } from "@/components/chat/CreateChannelDialog";

export function WorkspaceIndex() {
  const { workspaceId = "" } = useParams();
  const nav = useNavigate();
  const workspace = useRelay((s) => s.workspace);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    let active = true;
    useRelay
      .getState()
      .openWorkspace(workspaceId)
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [workspaceId]);

  useEffect(() => {
    // Desktop only: the root auto-opens the first channel. On mobile the root
    // IS the sidebar screen (Discord-style) - redirecting would trap the user
    // in the channel with no way back.
    const desktop = window.matchMedia("(min-width: 768px)").matches;
    if (desktop && workspace?.id === workspaceId && workspace.channels.length > 0) {
      nav(`/w/${workspaceId}/c/${workspace.channels[0].id}`, { replace: true });
    }
  }, [workspace, workspaceId, nav]);

  if (loading) {
    return (
      <div className="grid flex-1 place-items-center text-ink-mute">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  // Workspace with no channels yet
  return (
    <div className="grid flex-1 place-items-center p-6">
      <div className="max-w-sm text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-card bg-field text-ink">
          <Hash className="size-6" />
        </span>
        <h2 className="mt-3 text-xl font-bold tracking-tight text-ink">No channels yet</h2>
        <p className="mt-1 text-[14px] text-ink-mute">Create the first channel to start the conversation.</p>
        <Button className="mt-4" onClick={() => setShowCreate(true)}>
          <Plus className="size-4" /> Create a channel
        </Button>
      </div>
      {showCreate && <CreateChannelDialog workspaceId={workspaceId} onClose={() => setShowCreate(false)} />}
    </div>
  );
}
