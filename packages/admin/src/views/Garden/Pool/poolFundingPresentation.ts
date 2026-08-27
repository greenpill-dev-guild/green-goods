import type {
  PoolFundingState,
  SettlementUnavailableReason,
} from "@green-goods/shared/modules/commitment-pooling/pool-funding";
import type { Address } from "@green-goods/shared/types/domain";
import { formatTokenAmount } from "@green-goods/shared/utils/blockchain/vaults";
import type { IntlShape } from "react-intl";

export function formatGdollar(value: bigint | null, locale: string, detailed = false): string {
  return value === null
    ? "—"
    : `${formatTokenAmount(value, 18, detailed ? 18 : 2, locale, true)} G$`;
}

export function shortAddress(address: Address): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function fundingStateMessage(state: PoolFundingState, intl: IntlShape): string {
  const messages: Record<PoolFundingState, { id: string; defaultMessage: string }> = {
    unavailable: {
      id: "cockpit.garden.pool.funding.state.unavailable",
      defaultMessage: "Funding unavailable",
    },
    insufficient: {
      id: "cockpit.garden.pool.funding.state.insufficient",
      defaultMessage: "Insufficient",
    },
    low: { id: "cockpit.garden.pool.funding.state.low", defaultMessage: "Low balance" },
    healthy: { id: "cockpit.garden.pool.funding.state.healthy", defaultMessage: "Healthy" },
    "no-demand": {
      id: "cockpit.garden.pool.funding.state.noDemand",
      defaultMessage: "No current demand",
    },
  };
  return intl.formatMessage(messages[state]);
}

export function readinessReasonMessage(
  reason: SettlementUnavailableReason,
  intl: IntlShape
): string {
  const messages: Record<SettlementUnavailableReason, { id: string; defaultMessage: string }> = {
    missing_account: {
      id: "cockpit.garden.pool.funding.reason.missingAccount",
      defaultMessage: "No settlement Safe is configured.",
    },
    inactive_account: {
      id: "cockpit.garden.pool.funding.reason.inactiveAccount",
      defaultMessage: "The settlement account is inactive.",
    },
    missing_route: {
      id: "cockpit.garden.pool.funding.reason.missingRoute",
      defaultMessage: "No Celo settlement route is configured.",
    },
    inactive_route: {
      id: "cockpit.garden.pool.funding.reason.inactiveRoute",
      defaultMessage: "The Celo settlement route is inactive.",
    },
    route_mismatch: {
      id: "cockpit.garden.pool.funding.reason.routeMismatch",
      defaultMessage: "The indexed account and live Celo route do not agree.",
    },
    balance_unreadable: {
      id: "cockpit.garden.pool.funding.reason.balanceUnreadable",
      defaultMessage: "The current G$ balance could not be read.",
    },
    ledger_unavailable: {
      id: "cockpit.garden.pool.funding.reason.ledgerUnavailable",
      defaultMessage: "Settlement obligations could not be read.",
    },
    ledger_stale: {
      id: "cockpit.garden.pool.funding.reason.ledgerStale",
      defaultMessage: "Settlement obligations are too stale to calculate availability.",
    },
    ledger_inconsistent: {
      id: "cockpit.garden.pool.funding.reason.ledgerInconsistent",
      defaultMessage: "Settlement records are inconsistent and need review.",
    },
    fee_policy_unavailable: {
      id: "cockpit.garden.pool.funding.reason.feePolicyUnavailable",
      defaultMessage: "The sender-paid fee policy could not be read.",
    },
    source_paused: {
      id: "cockpit.garden.pool.funding.reason.sourcePaused",
      defaultMessage: "Settlement is paused on Arbitrum.",
    },
    executor_paused: {
      id: "cockpit.garden.pool.funding.reason.executorPaused",
      defaultMessage: "The Celo settlement executor is paused.",
    },
    token_paused: {
      id: "cockpit.garden.pool.funding.reason.tokenPaused",
      defaultMessage: "The G$ token is paused.",
    },
    source_unreadable: {
      id: "cockpit.garden.pool.funding.reason.sourceUnreadable",
      defaultMessage: "The Arbitrum settlement status could not be read.",
    },
    executor_unreadable: {
      id: "cockpit.garden.pool.funding.reason.executorUnreadable",
      defaultMessage: "The Celo executor status could not be read.",
    },
    token_unreadable: {
      id: "cockpit.garden.pool.funding.reason.tokenUnreadable",
      defaultMessage: "The G$ token status could not be read.",
    },
    fee_quote_unavailable: {
      id: "cockpit.garden.pool.funding.reason.feeQuoteUnavailable",
      defaultMessage: "One or more current G$ fee quotes could not be read.",
    },
    receiver_paid_fee: {
      id: "cockpit.garden.pool.funding.reason.receiverPaidFee",
      defaultMessage: "A recipient-paid G$ fee is not supported.",
    },
    fee_policy_breach: {
      id: "cockpit.garden.pool.funding.reason.feePolicyBreach",
      defaultMessage: "A current G$ fee quote exceeds the settlement policy.",
    },
    allowance_unreadable: {
      id: "cockpit.garden.pool.funding.reason.allowanceUnreadable",
      defaultMessage: "The Safe allowance could not be read.",
    },
    period_unreadable: {
      id: "cockpit.garden.pool.funding.reason.periodUnreadable",
      defaultMessage: "The settlement-period allowance could not be read.",
    },
    roles_allowance_exhausted: {
      id: "cockpit.garden.pool.funding.reason.rolesAllowanceExhausted",
      defaultMessage: "The Safe allowance is exhausted.",
    },
    period_allowance_exhausted: {
      id: "cockpit.garden.pool.funding.reason.periodAllowanceExhausted",
      defaultMessage: "The settlement-period allowance is exhausted.",
    },
    transfer_cap_exceeded: {
      id: "cockpit.garden.pool.funding.reason.transferCapExceeded",
      defaultMessage: "An obligation exceeds the per-transfer cap.",
    },
    batch_cap_exceeded: {
      id: "cockpit.garden.pool.funding.reason.batchCapExceeded",
      defaultMessage: "A settlement batch exceeds the batch cap.",
    },
  };
  return intl.formatMessage(messages[reason]);
}
