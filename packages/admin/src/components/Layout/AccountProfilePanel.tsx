import {
  AddressDisplay,
  SheetBody,
  SheetDivider,
  SheetFooter,
  cn,
  compareAddresses,
  DEFAULT_CHAIN_ID,
  formatAddress,
  getBlockExplorerAddressUrl,
  type Address,
  useAdminGardenWorkspaceSelection,
  useAuthActions,
  useAuthState,
  useEligibleAdminGardens,
  useEnsName,
  useGardenUrlSync,
  useRole,
  useSheetOrchestratorStore,
  type UserRole,
} from "@green-goods/shared";
import {
  RiExternalLinkLine,
  RiLogoutBoxLine,
  RiSeedlingLine,
  RiWallet3Line,
} from "@remixicon/react";
import { useCallback, type ReactNode } from "react";
import { useIntl } from "react-intl";
import { formatEnsAddressName } from "@/components/EnsAddressText";
import { AdminChoiceGroup } from "../AdminChoiceGroup";
import { AccountProfileAvatarEditor } from "./AccountProfileAvatarEditor";

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

const AUTH_METHOD_MESSAGES = {
  wallet: { id: "cockpit.account.authMethod.wallet", defaultMessage: "Wallet" },
  passkey: { id: "cockpit.account.authMethod.passkey", defaultMessage: "Passkey" },
  embedded: { id: "cockpit.account.authMethod.embedded", defaultMessage: "Embedded wallet" },
} as const;

interface AccountProfilePanelProps {
  className?: string;
}

function getInitials(value: string | null | undefined): string {
  if (!value) return "GG";

  const sanitized = value
    .replace(/\.eth$/i, "")
    .replace(/^0x/i, "")
    .trim();
  const parts = sanitized.split(/[\s._-]+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }

  return sanitized.slice(0, 2).toUpperCase();
}

/** Quiet capsule label — identity metadata (role, auth method), not a control. */
function IdentityChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-stroke-soft bg-bg-soft px-2.5 py-0.5 text-xs font-medium capitalize text-text-sub">
      {children}
    </span>
  );
}

/**
 * Account panel — the identity surface behind the AppBar avatar (desktop side
 * sheet) and the mobile Profile tab's "Account" tab.
 *
 * Anatomy (flat M3 list sections, no nested cards — panel padding must not
 * compound with shell padding):
 * 1. Identity header — avatar, ENS name / truncated address as the headline,
 *    role + auth-method chips.
 * 2. Wallet — one address row with copy affordance + block-explorer link.
 * 3. Your gardens — the gardens this account operates; selecting one switches
 *    the workspace (same action as the AppBar GardenChip).
 * 4. Sign out — pinned footer (identity action lives with identity).
 */
export function AccountProfilePanel({ className }: AccountProfilePanelProps) {
  const { formatMessage } = useIntl();
  const { eoaAddress, authMode } = useAuthState();
  const { signOut } = useAuthActions();
  const { role } = useRole();
  const { data: ensName } = useEnsName(eoaAddress as Address | null | undefined);
  const { eligibleGardens } = useEligibleAdminGardens();
  const { selectedGarden } = useAdminGardenWorkspaceSelection();
  const { setGarden } = useGardenUrlSync();
  const closeSheet = useSheetOrchestratorStore((state) => state.closeSheet);

  const roleLabel = formatMessage(ROLE_LABEL_MESSAGES[role]);
  const authMethodLabel = authMode ? formatMessage(AUTH_METHOD_MESSAGES[authMode]) : null;
  const ensDisplayName =
    eoaAddress && ensName ? formatEnsAddressName(eoaAddress as Address, ensName) : null;
  const headline = ensDisplayName ?? (eoaAddress ? formatAddress(eoaAddress) : roleLabel);
  const avatarFallback = getInitials(ensDisplayName ?? eoaAddress ?? roleLabel);
  const selectedGardenChoiceId =
    selectedGarden && eligibleGardens.length > 0
      ? (eligibleGardens.find((garden) => compareAddresses(garden.id, selectedGarden.id))?.id ??
        selectedGarden.id)
      : null;

  const handleSelectGarden = useCallback(
    (gardenId: string) => {
      const fullGarden = eligibleGardens.find((garden) => compareAddresses(garden.id, gardenId));
      if (!fullGarden) return;
      setGarden(fullGarden);
      closeSheet();
    },
    [closeSheet, eligibleGardens, setGarden]
  );

  return (
    <>
      <SheetBody padded={true} className={cn("flex flex-col gap-4", className)}>
        {/* Identity header — who is signed in, at headline weight. */}
        <div className="flex items-center gap-4">
          <AccountProfileAvatarEditor fallbackInitials={avatarFallback} />
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-text-strong" title={headline}>
              {headline}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <IdentityChip>{roleLabel}</IdentityChip>
              {authMethodLabel ? <IdentityChip>{authMethodLabel}</IdentityChip> : null}
            </div>
          </div>
        </div>

        {eoaAddress ? (
          <>
            <SheetDivider />

            {/* Wallet — one address row: copy + explorer. */}
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <RiWallet3Line className="h-4 w-4 text-text-soft" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-text-strong">
                  {formatMessage({ id: "app.account.wallet", defaultMessage: "Wallet" })}
                </h2>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-stroke-soft bg-bg-white-0 px-3 py-2">
                <AddressDisplay address={eoaAddress as Address} showCopyButton />
                <a
                  href={getBlockExplorerAddressUrl(DEFAULT_CHAIN_ID, eoaAddress)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-text-sub transition-colors hover:text-text-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--tone-focus-ring,var(--m3-primary)))]"
                >
                  {formatMessage({
                    id: "cockpit.account.viewOnExplorer",
                    defaultMessage: "View on explorer",
                  })}
                  <RiExternalLinkLine className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </div>
            </section>
          </>
        ) : null}

        <SheetDivider />

        {/* Your gardens — workspace scope switcher. */}
        <section className="space-y-2">
          <div>
            <h2 className="text-sm font-semibold text-text-strong">
              {formatMessage({ id: "cockpit.account.gardens", defaultMessage: "Your gardens" })}
            </h2>
            <p className="mt-0.5 text-sm text-text-sub">
              {formatMessage({
                id: "cockpit.account.gardensDescription",
                defaultMessage: "Switch the garden this canvas is scoped to.",
              })}
            </p>
          </div>
          {eligibleGardens.length > 0 ? (
            <AdminChoiceGroup
              ariaLabel={formatMessage({
                id: "cockpit.account.gardens",
                defaultMessage: "Your gardens",
              })}
              value={selectedGardenChoiceId}
              onChange={handleSelectGarden}
              options={eligibleGardens.map((garden) => ({
                value: garden.id,
                label: garden.name,
                leadingVisual: <RiSeedlingLine className="h-4 w-4" aria-hidden="true" />,
              }))}
            />
          ) : (
            <p className="text-sm text-text-sub">
              {formatMessage({
                id: "cockpit.account.gardensEmpty",
                defaultMessage: "No gardens yet.",
              })}
            </p>
          )}
        </section>
      </SheetBody>

      {/* Sign out — identity action pinned with the identity surface. */}
      <SheetFooter>
        <button
          type="button"
          onClick={() => signOut()}
          className={cn(
            "flex min-h-11 w-full items-center justify-between rounded-full px-4 py-3",
            "text-sm font-medium text-error-base transition-colors hover:bg-error-lighter"
          )}
        >
          <span>
            {formatMessage({ id: "cockpit.settings.disconnect", defaultMessage: "Disconnect" })}
          </span>
          <RiLogoutBoxLine className="h-4 w-4" />
        </button>
      </SheetFooter>
    </>
  );
}
