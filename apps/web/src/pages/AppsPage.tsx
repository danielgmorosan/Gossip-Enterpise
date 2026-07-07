import { Link, useParams } from "react-router-dom";
import { Mail, Calendar, FileText, NotebookPen, Video, ShieldCheck } from "lucide-react";
import { PaneHeader } from "@/components/chat/PaneHeader";
import { Button } from "@gossip/ui/stack";

const apps = [
  { id: "mail", icon: Mail, name: "Mail", provider: "JMAP / IMAP", desc: "Inbox, threads, send to channel." },
  { id: "calendar", icon: Calendar, name: "Calendar", provider: "CalDAV", desc: "Schedule, invites, huddles." },
  { id: "files", icon: FileText, name: "Files", provider: "Nextcloud · WebDAV", desc: "Browse and share workspace files." },
  { id: "notes", icon: NotebookPen, name: "Notes", provider: "Standard Notes · E2E", desc: "Encrypted notes & meeting docs." },
  { id: "calls", icon: Video, name: "Calls", provider: "LiveKit", desc: "Huddles with the AI notetaker." },
];

export function AppsPage() {
  const { workspaceId = "" } = useParams();
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PaneHeader
        title="Mini-apps"
        subtitle="Privacy-respecting tools, docked into the workspace"
        actions={
          <Link to="/settings/integrations">
            <Button size="sm" variant="outline">
              Manage integrations
            </Button>
          </Link>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-6 py-6">
          <div className="mb-4 flex items-center gap-2 rounded-control bg-field px-3 py-2 text-[12.5px] text-ink-mute">
            <ShieldCheck className="size-4 shrink-0 text-positive" />
            Every mini-app runs in a sandboxed iframe with least-privilege access. Built on open
            standards, so your own provider drops in.
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {apps.map((a) => (
              <Link
                key={a.id}
                to={`/w/${workspaceId}/apps/${a.id}`}
                className="group flex flex-col rounded-card border border-line bg-paper p-4 transition-colors hover:border-line-strong hover:bg-paper-2"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="grid size-11 place-items-center rounded-control bg-field text-ink">
                    <a.icon className="size-5" />
                  </span>
                  <span className="rounded-control bg-field px-2 py-0.5 text-[11px] font-medium text-ink-mute">
                    not connected
                  </span>
                </div>
                <div className="text-[15px] font-semibold text-ink">{a.name}</div>
                <div className="font-mono text-[10.5px] text-ink-faint">{a.provider}</div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-mute">{a.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
