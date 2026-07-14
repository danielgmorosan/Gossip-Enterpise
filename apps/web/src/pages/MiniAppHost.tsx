import { useParams, Link } from "react-router-dom";
import { Mail, Calendar, FileText, NotebookPen, Video, Lock, Settings2 } from "lucide-react";
import { PaneHeader, HeaderIconButton } from "@/components/chat/PaneHeader";
import { BackButton } from "@/components/BackButton";
import { Button, PaneEmptyState } from "@gossip/ui/stack";

const meta: Record<string, { icon: typeof Mail; name: string; provider: string }> = {
  mail: { icon: Mail, name: "Mail", provider: "JMAP / IMAP" },
  calendar: { icon: Calendar, name: "Calendar", provider: "CalDAV" },
  files: { icon: FileText, name: "Files", provider: "Nextcloud · WebDAV" },
  notes: { icon: NotebookPen, name: "Notes", provider: "Standard Notes" },
  calls: { icon: Video, name: "Calls", provider: "LiveKit" },
};

export function MiniAppHost() {
  const { workspaceId = "", appId = "mail" } = useParams();
  const m = meta[appId] ?? meta.mail;
  const Icon = m.icon;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PaneHeader
        back={<BackButton to={`/w/${workspaceId}/apps`} label="Back to mini-apps" />}
        icon={
          <span className="grid size-7 place-items-center rounded-control bg-field text-ink">
            <Icon className="size-4" />
          </span>
        }
        title={m.name}
        subtitle={<span className="font-mono text-[11px]">{m.provider}</span>}
        badge={
          <span className="ml-1 inline-flex items-center gap-1 rounded-control bg-field px-2 py-0.5 text-[11px] font-medium text-ink-mute">
            <Lock className="size-3" /> sandboxed
          </span>
        }
        actions={
          <Link to="/settings/integrations" state={{ from: `/w/${workspaceId}/apps/${appId}` }}>
            <HeaderIconButton label="Configure">
              <Settings2 className="size-4" />
            </HeaderIconButton>
          </Link>
        }
      />
      <PaneEmptyState
        icon={<Icon />}
        title={`${m.name} isn't connected yet`}
        description={`This mini-app loads in a sandboxed iframe against ${m.provider}. Connect a provider to enable it.`}
        action={
          <Link to="/settings/integrations" state={{ from: `/w/${workspaceId}/apps/${appId}` }}>
            <Button variant="outline" size="sm">Open integrations</Button>
          </Link>
        }
      />
    </div>
  );
}
