import { useCallback } from "react";
import { useIntl } from "react-intl";
import type { Address, Garden } from "../../../types/domain";
import type { AuthMode } from "../../../types/auth";
import { formatAddress } from "../../../utils/app/text";
import { compareAddresses } from "../../../utils/blockchain/address";
import { useAuthActions, useAuthState } from "../../../providers/Auth";
import { useEnsName } from "../../blockchain/useEnsName";
import { useAdminGardenWorkspaceSelection } from "../../garden/useAdminGardenWorkspaceSelection";
import { useEligibleAdminGardens } from "../../garden/useEligibleAdminGardens";
import { useRole, type UserRole } from "../../gardener/useRole";
import { useGardenUrlSync } from "../../navigation/useGardenUrlSync";
import { useSheetOrchestratorStore } from "../../../stores/useSheetOrchestratorStore";

const ROLE_LABEL_MESSAGES: Record<UserRole, { defaultMessage: string; id: string }> = {
  deployer: { id: "cockpit.role.deployer", defaultMessage: "deployer" },
  operator: { id: "cockpit.role.operator", defaultMessage: "operator" },
  user: { id: "cockpit.role.user", defaultMessage: "user" },
};

const AUTH_METHOD_MESSAGES: Record<
  Exclude<AuthMode, null>,
  { defaultMessage: string; id: string }
> = {
  wallet: { id: "cockpit.account.authMethod.wallet", defaultMessage: "Wallet" },
  passkey: { id: "cockpit.account.authMethod.passkey", defaultMessage: "Passkey" },
  embedded: {
    id: "cockpit.account.authMethod.embedded",
    defaultMessage: "Embedded wallet",
  },
};

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

export interface AccountProfileController {
  authMethodLabel: string | null;
  avatarFallback: string;
  eligibleGardens: Garden[];
  eoaAddress: Address | null;
  headline: string;
  roleLabel: string;
  selectedGardenChoiceId: string | null;
  selectGarden: (gardenId: string) => void;
  signOut: () => void;
}

export function useAccountProfileController(): AccountProfileController {
  const { formatMessage } = useIntl();
  const { eoaAddress, authMode } = useAuthState();
  const { signOut } = useAuthActions();
  const { role } = useRole();
  const address = eoaAddress as Address | null;
  const { data: ensName } = useEnsName(address);
  const { eligibleGardens } = useEligibleAdminGardens();
  const { selectedGarden } = useAdminGardenWorkspaceSelection();
  const { setGarden } = useGardenUrlSync();
  const closeSheet = useSheetOrchestratorStore((state) => state.closeSheet);

  const roleLabel = formatMessage(ROLE_LABEL_MESSAGES[role]);
  const authMethodLabel = authMode ? formatMessage(AUTH_METHOD_MESSAGES[authMode]) : null;
  const headline = address ? formatAddress(address, { ensName }) : roleLabel;
  const selectedGardenChoiceId =
    selectedGarden && eligibleGardens.length > 0
      ? (eligibleGardens.find((garden) => compareAddresses(garden.id, selectedGarden.id))?.id ??
        selectedGarden.id)
      : null;

  const selectGarden = useCallback(
    (gardenId: string) => {
      const garden = eligibleGardens.find((candidate) => compareAddresses(candidate.id, gardenId));
      if (!garden) return;
      setGarden(garden);
      closeSheet();
    },
    [closeSheet, eligibleGardens, setGarden]
  );

  return {
    authMethodLabel,
    avatarFallback: getInitials(headline),
    eligibleGardens,
    eoaAddress: address,
    headline,
    roleLabel,
    selectedGardenChoiceId,
    selectGarden,
    signOut,
  };
}
