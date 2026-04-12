import {
  AddressDisplay,
  Surface,
  cn,
  type Address,
  useAuth,
  useEnsAvatar,
  useEnsName,
  useRole,
  type UserRole,
} from "@green-goods/shared";
import { RiWallet3Line } from "@remixicon/react";
import { useIntl } from "react-intl";

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

interface AccountProfilePanelProps {
  className?: string;
}

function getInitials(value: string | null | undefined): string {
  if (!value) return "GG";

  const sanitized = value.replace(/\.eth$/i, "").replace(/^0x/i, "").trim();
  const parts = sanitized.split(/[\s._-]+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }

  return sanitized.slice(0, 2).toUpperCase();
}

export function AccountProfilePanel({ className }: AccountProfilePanelProps) {
  const { formatMessage } = useIntl();
  const { eoaAddress } = useAuth();
  const { role } = useRole();
  const { data: ensName } = useEnsName(eoaAddress as Address | null | undefined);
  const { data: avatarUrl } = useEnsAvatar(eoaAddress as Address | null | undefined);
  const roleLabel = formatMessage(ROLE_LABEL_MESSAGES[role]);
  const avatarFallback = getInitials(ensName ?? eoaAddress ?? roleLabel);

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <Surface elevation="raised" padding="default" className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-[1.1rem] bg-[linear-gradient(135deg,rgba(var(--workspace-tint,124_58_237),0.2),rgba(var(--workspace-accent,124_58_237),0.36))] text-[rgb(var(--workspace-accent,124_58_237))] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.5),0_18px_32px_rgba(15,23,42,0.16)]">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={formatMessage({
                  id: "cockpit.profile.title",
                  defaultMessage: "Profile",
                })}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-sm font-semibold tracking-[0.08em]">{avatarFallback}</span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-soft">
              {formatMessage({ id: "cockpit.settings.userProfile", defaultMessage: "Profile" })}
            </p>
            <p className="text-base font-semibold capitalize text-text-strong">
              {roleLabel}
            </p>
            <p className="mt-1 text-sm text-text-sub">
              {ensName ?? (eoaAddress ? formatMessage({ id: "app.account.wallet", defaultMessage: "Wallet" }) : "")}
            </p>
          </div>
        </div>

        <p className="text-sm text-text-sub">
          {formatMessage({
            id: "cockpit.profile.description",
            defaultMessage: "Manage your canvas identity, appearance, and operator preferences.",
          })}
        </p>
      </Surface>

      {eoaAddress ? (
        <Surface elevation="raised" padding="default" className="space-y-3">
          <div className="flex items-center gap-2">
            <RiWallet3Line className="h-4 w-4 text-text-soft" />
            <h2 className="text-sm font-semibold text-text-strong">
              {formatMessage({ id: "app.account.wallet", defaultMessage: "Wallet" })}
            </h2>
          </div>

          <div className="rounded-2xl bg-bg-soft/80 p-3 shadow-[inset_0_0_0_1px_rgb(0_0_0_/_0.04)]">
            <AddressDisplay address={eoaAddress} showCopyButton />
          </div>
        </Surface>
      ) : null}
    </div>
  );
}
