import { useState } from "react";
import { Mail, Calendar, FileText, NotebookPen, Video, ShieldCheck, ShieldAlert } from "lucide-react";
import { SettingsPage } from "./SettingsLayout";
import { SearchFilterTabs } from "@gossip/ui/stack";
import { integrations, type IntegrationDef } from "@/data/mock";
import { cn } from "@/lib/utils";

const kindMeta = {
  calls: { icon: Video, label: "Calls" },
  files: { icon: FileText, label: "Files" },
  mail: { icon: Mail, label: "Mail" },
  calendar: { icon: Calendar, label: "Calendar" },
  notes: { icon: NotebookPen, label: "Notes" },
} as const;

const privacyMeta: Record<IntegrationDef["privacy"], string> = {
  "self-hosted": "self-hosted",
  e2e: "end-to-end",
  standards: "open standard",
  bridge: "bridge",
};

function StatusPill({ status }: { status: IntegrationDef["status"] }) {
  const label =
    status === "desktop-only" ? "desktop only" : status === "unavailable" ? "unavailable" : "planned";
  return (
    <span className="rounded-control bg-field px-2 py-0.5 text-[11px] font-medium text-ink-mute">
      {label}
    </span>
  );
}

export function IntegrationsSettings() {
  const [filter, setFilter] = useState<string>("all");
  const list = integrations.filter((i) => filter === "all" || i.kind === filter);

  return (
    <SettingsPage
      title="Integrations"
      desc="Privacy-respecting mini-apps. We build against open protocols, so your own provider drops in."
    >
      {/* Design principle banner */}
      <div className="flex items-start gap-3 rounded-card border border-line bg-paper-2 p-4">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-positive" />
        <p className="text-[13px] leading-relaxed text-ink-mute">
          <span className="font-medium text-ink">The sweet spot is self-hostable open source:</span>{" "}
          you run the server, so you own the data and still get a real API. Closed E2E suites
          (Proton, Tuta) are handled as desktop-bridge special cases; we never promise an API that
          doesn't exist.
        </p>
      </div>

      <SearchFilterTabs
        value={filter}
        onChange={setFilter}
        items={[
          { id: "all", label: "All" },
          { id: "calls", label: "Calls" },
          { id: "files", label: "Files" },
          { id: "mail", label: "Mail" },
          { id: "calendar", label: "Calendar" },
          { id: "notes", label: "Notes" },
        ]}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {list.map((it) => {
          const Kind = kindMeta[it.kind].icon;
          const dim = it.status === "unavailable" || it.status === "desktop-only";
          return (
            <div
              key={it.id}
              className={cn(
                "flex flex-col rounded-card border border-line bg-paper p-4",
                dim && "opacity-70",
              )}
            >
              <div className="flex items-start justify-between">
                <span className="grid size-10 place-items-center rounded-control bg-field text-ink">
                  <Kind className="size-5" />
                </span>
                <span className="inline-flex items-center gap-1 rounded-control bg-field px-2 py-0.5 text-[11px] font-medium text-ink-mute">
                  {it.privacy === "bridge" ? <ShieldAlert className="size-3" /> : <ShieldCheck className="size-3" />}
                  {privacyMeta[it.privacy]}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-[15px] font-semibold text-ink">{it.name}</span>
              </div>
              <div className="font-mono text-[10.5px] text-ink-faint">{it.protocol}</div>
              <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-ink-mute">{it.blurb}</p>
              <div className="mt-3 flex items-center justify-end">
                <StatusPill status={it.status} />
              </div>
            </div>
          );
        })}
      </div>
    </SettingsPage>
  );
}
