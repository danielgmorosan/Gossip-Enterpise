import { MessagesSquare } from "lucide-react";
import { PaneHeader } from "@/components/chat/PaneHeader";
import { PaneEmptyState } from "@gossip/ui/stack";

export function Threads() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PaneHeader title="Threads" subtitle="Conversations you follow" />
      <PaneEmptyState
        icon={<MessagesSquare />}
        title="No threads yet"
        description="Threads you follow will appear here once channel replies land."
      />
    </div>
  );
}
