import { AddressDisplay, cn, useAuth, useRole, type UserRole } from "@green-goods/shared";
import { RiUserLine, RiWallet3Line } from "@remixicon/react";
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

export function AccountProfilePanel({ className }: AccountProfilePanelProps) {
  const { formatMessage } = useIntl();
  const { eoaAddress } = useAuth();
  const { role } = useRole();

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <section className="surface-inset space-y-4 p-4 sm:p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-alpha-10 text-primary-dark shadow-[var(--edge-rest)]">
            <RiUserLine className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-soft">
              {formatMessage({ id: "cockpit.settings.userProfile", defaultMessage: "Profile" })}
            </p>
            <p className="text-base font-semibold capitalize text-text-strong">
              {formatMessage(ROLE_LABEL_MESSAGES[role])}
            </p>
          </div>
        </div>

        <p className="text-sm text-text-sub">
          {formatMessage({
            id: "cockpit.profile.description",
            defaultMessage: "Manage your cockpit identity, appearance, and operator preferences.",
          })}
        </p>
      </section>

      {eoaAddress ? (
        <section className="surface-inset space-y-3 p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <RiWallet3Line className="h-4 w-4 text-text-soft" />
            <h2 className="text-sm font-semibold text-text-strong">
              {formatMessage({ id: "app.account.wallet", defaultMessage: "Wallet" })}
            </h2>
          </div>

          <div className="rounded-2xl bg-bg-soft/80 p-3 shadow-[inset_0_0_0_1px_rgb(0_0_0_/_0.04)]">
            <AddressDisplay address={eoaAddress} showCopyButton />
          </div>
        </section>
      ) : null}
    </div>
  );
}
