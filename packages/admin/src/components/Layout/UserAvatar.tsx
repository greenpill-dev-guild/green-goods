import { cn, type UserRole, useRole } from "@green-goods/shared";
import { RiUserLine } from "@remixicon/react";
import { useIntl } from "react-intl";

interface UserAvatarProps {
  onOpenProfile: () => void;
}

const ROLE_LABEL_MESSAGES: Record<UserRole, { defaultMessage: string; id: string }> = {
  deployer: {
    id: "cockpit.role.deployer",
    defaultMessage: "deployer",
  },
  operator: {
    id: "cockpit.role.operator",
    defaultMessage: "operator",
  },
  user: {
    id: "cockpit.role.user",
    defaultMessage: "user",
  },
};

export function UserAvatar({ onOpenProfile }: UserAvatarProps) {
  const { formatMessage } = useIntl();
  const { role } = useRole();

  const roleLabel = formatMessage(ROLE_LABEL_MESSAGES[role]);

  return (
    <button
      type="button"
      onClick={onOpenProfile}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-lg",
        "border border-white/65 bg-[rgba(255,255,255,0.64)] text-text-sub",
        "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.45),0_8px_18px_rgba(15,23,42,0.08)]",
        "transition-all duration-200 hover:border-[rgb(var(--workspace-tint,59_130_246)/0.24)]",
        "hover:bg-[rgb(var(--workspace-tint,59_130_246)/0.10)] hover:text-[rgb(var(--workspace-tint,59_130_246))]",
        "active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100",
        "focus-visible:ring-2 focus-visible:ring-[rgb(var(--workspace-tint,59_130_246))] focus-visible:outline-none"
      )}
      aria-label={formatMessage(
        {
          id: "cockpit.nav.openRoleProfile",
          defaultMessage: "Open {role} profile",
        },
        { role: roleLabel }
      )}
    >
      <RiUserLine className="h-5 w-5" />
    </button>
  );
}
