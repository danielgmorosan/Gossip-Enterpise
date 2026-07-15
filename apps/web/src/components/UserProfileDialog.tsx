import { useState } from "react";
import { Link } from "react-router-dom";
import { MessageSquareText, Phone, Copy, Check, ShieldCheck } from "lucide-react";
import { Button, StackModal, ModalBody } from "@gossip/ui/stack";
import { UserAvatar } from "@/components/UserAvatar";
import { useRelay } from "@/stores/useRelay";
import { useSession } from "@/stores/useSession";
import { useStartDm } from "@/lib/useStartDm";
import { truncateHandle } from "@/lib/utils";

/**
 * Profile card popup (T3) — opens when you click someone's avatar or name.
 * Shows who they are (avatar, name, pseudonymous handle, workspace role) and
 * the two things you'd do next: message or call them (E2E, via /home).
 */
export function UserProfileDialog({
  userId,
  name,
  onClose,
}: {
  userId: string;
  name: string;
  onClose: () => void;
}) {
  const myId = useSession((s) => s.userId);
  const member = useRelay((s) => s.workspace?.members.find((m) => m.userId === userId));
  const startDm = useStartDm();
  const [copied, setCopied] = useState(false);
  const me = userId === myId;

  const copyHandle = () => {
    navigator.clipboard?.writeText(userId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <StackModal onClose={onClose} width="md">
      <ModalBody>
        <div className="flex flex-col items-center pb-1 pt-2 text-center">
          <UserAvatar name={name} id={userId} className="!size-20 !text-[26px] !rounded-full" />
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[17px] font-bold tracking-tight text-ink">{name}</span>
            {member?.role && (
              <span className="rounded-control bg-field px-2 py-0.5 text-[11px] font-medium capitalize text-ink-mute">
                {member.role}
              </span>
            )}
            {me && <span className="text-[12px] text-ink-faint">you</span>}
          </div>
          <button
            onClick={copyHandle}
            title="Copy handle"
            className="mt-1 inline-flex items-center gap-1.5 rounded-control px-2 py-1 font-mono text-[11px] text-ink-faint transition-colors hover:bg-field hover:text-ink"
          >
            {truncateHandle(userId, 16, 8)}
            {copied ? <Check className="size-3 text-positive" /> : <Copy className="size-3" />}
          </button>
          <div className="mt-1 inline-flex items-center gap-1 text-[11.5px] text-ink-faint">
            <ShieldCheck className="size-3 text-positive" /> DMs with this member are end-to-end encrypted
          </div>

          {!me && (
            <div className="mt-5 grid w-full grid-cols-2 gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  onClose();
                  startDm(userId, name);
                }}
              >
                <MessageSquareText className="size-4" /> Message
              </Button>
              <Link to={`/home/call/dm/${encodeURIComponent(userId)}`} onClick={onClose} className="contents">
                <Button variant="secondary" className="w-full">
                  <Phone className="size-4" /> Call
                </Button>
              </Link>
            </div>
          )}
        </div>
      </ModalBody>
    </StackModal>
  );
}
