import type { ReactNode } from "react";
import { SettingsCard } from "@gossip/ui/stack";

export function SettingGroup({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section>
      {title && (
        <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-ink-faint">{title}</div>
      )}
      <SettingsCard className="divide-y divide-[color:var(--st-line)]">{children}</SettingsCard>
    </section>
  );
}

export function SettingRow({
  label,
  desc,
  control,
  children,
}: {
  label: ReactNode;
  desc?: ReactNode;
  control?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 px-4 py-3.5">
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-medium text-ink">{label}</div>
        {desc && <div className="mt-0.5 text-[12.5px] leading-relaxed text-ink-mute">{desc}</div>}
        {children}
      </div>
      {control && <div className="shrink-0">{control}</div>}
    </div>
  );
}
