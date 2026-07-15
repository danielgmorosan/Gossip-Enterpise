import { Avatar } from "@gossip/ui/stack";
import { useAvatars, resolveAvatarSrc } from "@/stores/useAvatars";
import { useRelay } from "@/stores/useRelay";

/**
 * Drop-in replacement for the Stack `Avatar` that resolves an image source:
 * local override > workspace-synced member avatar (T3, via relay hello) >
 * deterministic DiceBear identicon from the handle. Same props as `Avatar`,
 * so call sites can alias the import.
 */
export function UserAvatar({
  name,
  id,
  size,
  className,
}: {
  name: string;
  id?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const overrides = useAvatars((s) => s.overrides);
  const memberAvatar = useRelay((s) => (id ? s.workspace?.members.find((m) => m.userId === id)?.avatar : undefined));
  const src = (id && overrides[id] ? undefined : memberAvatar) ?? resolveAvatarSrc(id, overrides);
  return <Avatar name={name} id={id} size={size} className={className} src={src} />;
}
