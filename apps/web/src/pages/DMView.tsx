import { Navigate, useParams } from "react-router-dom";
import { MessageSquareOff } from "lucide-react";
import { PaneEmptyState } from "@gossip/ui/stack";
import { RealDmView } from "@/components/chat/RealDmView";
import { useContacts } from "@/stores/useContacts";
import { useCall } from "@/stores/useCall";

function contactName(userId: string): string | undefined {
  return useContacts.getState().contacts.find((c) => c.userId === userId)?.name;
}

export function DMView() {
  const { dmId = "dm_self" } = useParams();
  // Live call with this exact contact → the call page IS this conversation
  // (full chat under the stage), so keep the call on screen (T3).
  const inCallHere = useCall((s) => s.status !== "idle" && s.target?.kind === "dm" && s.target.peerId === dmId);
  if (inCallHere) return <Navigate to={`/home/call/dm/${encodeURIComponent(dmId)}`} replace />;

  // Real, SDK-backed conversations.
  if (dmId === "dm_self") return <RealDmView peerId="self" />;
  if (dmId.startsWith("gossip1")) return <RealDmView peerId={dmId} peerName={contactName(dmId)} />;

  // Unknown conversation id (stale link) - no mock content.
  return (
    <PaneEmptyState
      icon={<MessageSquareOff />}
      title="Conversation not found"
      description="Pick a contact from the sidebar, or start a new message."
    />
  );
}
