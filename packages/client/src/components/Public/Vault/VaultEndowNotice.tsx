import { VaultDepositStageError } from "@green-goods/shared/hooks/vault/vault-helpers";
import { parseContractError } from "@green-goods/shared/utils/errors/contract-errors";
import { mayStillLand } from "@green-goods/shared/utils/errors/tx-error-classifier";
import { useIntl } from "react-intl";

/**
 * What the checkout says once a Wallet Endow stops on an error. A send with no receipt yet may
 * still go through, so it gets a neutral note in its own words, never "try again" (PRD-1570).
 */
export function VaultEndowNotice({ error }: { error: Error }) {
  const { formatMessage } = useIntl();

  if (mayStillLand(error)) {
    const parsed = parseContractError(error);
    return (
      <p
        role="status"
        className="rounded-none bg-bg-weak-50 p-4 text-sm leading-[1.55] text-text-sub-600"
      >
        {parsed.messageKey
          ? formatMessage({ id: parsed.messageKey, defaultMessage: parsed.message })
          : parsed.message}
      </p>
    );
  }

  return (
    <p className="rounded-none bg-error-lighter/30 p-4 text-sm leading-[1.55] text-error-base">
      {error instanceof VaultDepositStageError && error.reason === "insufficientBalance"
        ? formatMessage({
            id: "public.vaults.walletEndow.insufficientWeth",
            defaultMessage:
              "This wallet needs more WETH for this endowment. Wrap ETH to WETH first, then try again.",
          })
        : formatMessage({
            id: "public.vaults.walletEndow.error",
            defaultMessage:
              "We couldn't submit this endowment. Review the wallet message and try again.",
          })}
    </p>
  );
}
