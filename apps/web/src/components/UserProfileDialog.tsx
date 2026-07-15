import { useState } from "react";
import { Link } from "react-router-dom";
import { MessageSquareText, Phone, Copy, Check, ShieldCheck, Pencil } from "lucide-react";
import { Button, Input, StackModal, ModalBody } from "@gossip/ui/stack";
import { UserAvatar } from "@/components/UserAvatar";
import { useRelay } from "@/stores/useRelay";
import { useSession } from "@/stores/useSession";
import { useContacts } from "@/stores/useContacts";
import { useStartDm } from "@/lib/useStartDm";
import { truncateHandle } from "@/lib/utils";

/**
 * Profile card popup (T3) - opens when you click someone's avatar or name.
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
  const contact = useContacts((s) => s.contacts.find((c) => c.userId === userId));
  const startDm = useStartDm();
  const [copied, setCopied] = useState(false);
  const me = userId === myId;

  // Nickname (T3): your local label for this contact - SDK-persisted, shows
  // everywhere in your DMs. Only editable once they're actually a contact.
  const shownName = contact?.name || name;
  const [editing, setEditing] = useState(false);
  const [nick, setNick] = useState(shownName);
  const [nickErr, setNickErr] = useState<string | null>(null);
  const saveNick = async () => {
    const res = await useContacts.getState().rename(userId, nick);
    if (res.ok) {
      setEditing(false);
      setNickErr(null);
    } else setNickErr(res.error ?? "Couldn't rename.");
  };

  const copyHandle = () => {
    navigator.clipboard?.writeText(userId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <StackModal onClose={onClose} width="md">
      <ModalBody>
        <div className="flex flex-col items-center pb-1 pt-2 text-center">
          <UserAvatar name={shownName} id={userId} className="!size-20 !text-[26px] !rounded-full" />
          {editing ? (
            <form
              className="mt-3 flex w-full max-w-[260px] items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void saveNick();
              }}
            >
              <Input autoFocus value={nick} onChange={(e) => setNick(e.target.value)} placeholder="Nickname" className="h-9 text-[14px]" />
              <Button size="sm" type="submit">
                Save
              </Button>
            </form>
          ) : (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-[17px] font-bold tracking-tight text-ink">{shownName}</span>
              {member?.role && (
                <span className="rounded-control bg-field px-2 py-0.5 text-[11px] font-medium capitalize text-ink-mute">
                  {member.role}
                </span>
              )}
              {me && <span className="text-[12px] text-ink-faint">you</span>}
              {!me && contact && (
                <button
                  onClick={() => {
                    setNick(shownName);
                    setEditing(true);
                  }}
                  title="Set a nickname (only you see it)"
                  aria-label="Set a nickname"
                  className="grid size-6 place-items-center rounded-control text-ink-faint transition-colors hover:bg-field hover:text-ink"
                >
                  <Pencil className="size-3.5" />
                </button>
              )}
            </div>
          )}
          {nickErr && <p className="mt-1 text-[12px] text-negative">{nickErr}</p>}
          {member?.name && contact && member.name !== shownName && (
            <div className="mt-0.5 text-[11.5px] text-ink-faint">workspace name: {member.name}</div>
          )}
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
