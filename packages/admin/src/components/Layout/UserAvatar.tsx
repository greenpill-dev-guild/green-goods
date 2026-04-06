import { cn, type UserRole, useRole } from "@green-goods/shared";
import { useIntl } from "react-intl";

interface UserAvatarProps {
  onOpenSettings: () => void;
}

const ROLE_INITIALS: Record<UserRole, string> = {
  deployer: "D",
  operator: "O",
  user: "U",
};

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

export function UserAvatar({ onOpenSettings }: UserAvatarProps) {
  const { formatMessage } = useIntl();
  const { role } = useRole();

  const roleLabel = formatMessage(ROLE_LABEL_MESSAGES[role]);

  return (
    <button
      type="button"
      onClick={onOpenSettings}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-full",
        "bg-primary-alpha-10 text-primary-dark text-sm font-semibold",
        "focus-visible:ring-2 focus-visible:ring-primary-base focus-visible:outline-none"
      )}
      aria-label={formatMessage(
        {
          id: "cockpit.nav.openRoleSettings",
          defaultMessage: "Open {role} settings",
        },
        { role: roleLabel }
      )}
    >
      {ROLE_INITIALS[role]}
    </button>
  );
}
