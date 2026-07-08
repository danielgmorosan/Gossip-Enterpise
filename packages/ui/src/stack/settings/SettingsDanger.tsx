import type { ReactNode } from "react";
import { cn } from "../../utils";
import { Button } from "../Button";
import { Input } from "../Input";

export function DangerZone({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mb-8", className)}>
      <h2 className="mb-3 text-[15px] font-semibold text-negative">Danger zone</h2>
      <div className="overflow-hidden rounded-card border border-negative/25 bg-negative/5">
        {children}
      </div>
    </section>
  );
}

export function DangerRow({
  label,
  description,
  action,
  className,
}: {
  label: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-4 px-4 py-3.5", className)}>
      <div>
        <p className="text-[14px] font-medium text-ink">{label}</p>
        {description && <p className="mt-0.5 text-[13px] text-ink-mute">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function ConfirmDestructiveModal({
  title,
  description,
  codeLabel,
  codeValue,
  onCodeChange,
  acknowledgeLabel,
  acknowledged,
  onAcknowledgeChange,
  confirmLabel = "Delete",
  onConfirm,
  onClose,
}: {
  title: string;
  description: ReactNode;
  codeLabel: string;
  codeValue: string;
  onCodeChange: (v: string) => void;
  acknowledgeLabel: string;
  acknowledged: boolean;
  onAcknowledgeChange: (v: boolean) => void;
  confirmLabel?: string;
  onConfirm?: () => void;
  onClose?: () => void;
}) {
  return (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-6">
    <div role="dialog" aria-modal className="w-full max-w-md rounded-card border border-line bg-paper p-6 shadow-[var(--st-shadow-card)]">
      <h2 className="text-lg font-bold tracking-tight text-ink">{title}</h2>
      <div className="mt-3 text-[14px] leading-relaxed text-ink-soft">{description}</div>
      <div className="mt-5 space-y-4">
        <div>
          <label className="mb-2 block text-[13px] font-medium text-ink">{codeLabel}</label>
          <Input value={codeValue} onChange={(e) => onCodeChange(e.target.value)} />
        </div>
        <label className="flex items-start gap-2.5 text-[13px] text-ink-soft">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => onAcknowledgeChange(e.target.checked)}
            className="mt-0.5"
          />
          {acknowledgeLabel}
        </label>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        )}
        <Button
          variant="danger"
          size="sm"
          disabled={!acknowledged || !codeValue.trim()}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </div>
  </div>
  );
}

export function StackToast({
  message,
  onDismiss,
  tone = "success",
  className,
}: {
  message: string;
  onDismiss?: () => void;
  /** success = confirmation checkmark; info = neutral notice. */
  tone?: "success" | "info";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-card border border-line bg-paper px-4 py-2.5",
        "text-[13px] text-ink shadow-[var(--st-shadow-card)]",
        className,
      )}
    >
      {tone === "success" ? <span className="text-positive">✓</span> : <span className="text-ink-faint">ℹ</span>}
      {message}
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="ml-2 text-ink-faint hover:text-ink">×</button>
      )}
    </div>
  );
}
