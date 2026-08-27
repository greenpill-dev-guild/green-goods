import type {
  PoolFundingCalculationInput,
  PoolFundingSnapshot,
  PoolFundingState,
} from "./pool-funding";
import { clampPoolFundingAtZero } from "./pool-funding-calculations";
import { derivePoolFundingObligations } from "./pool-funding-obligations";
import {
  deriveFundingUnavailableReasons,
  deriveSettlementUnavailableReasons,
} from "./pool-funding-readiness";

export function selectPoolFundingSnapshot(input: PoolFundingCalculationInput): PoolFundingSnapshot {
  const fundingUnavailableReasons = deriveFundingUnavailableReasons(input);
  const obligationData = derivePoolFundingObligations(input);
  if (obligationData.ledgerInconsistent) {
    fundingUnavailableReasons.push("ledger_inconsistent");
  }

  const committedGroups = obligationData.groups.filter((row) => row.kind !== "expected");
  const expectedGroups = obligationData.groups.filter((row) => row.kind === "expected");
  const committed = committedGroups.reduce((sum, row) => sum + row.netAmount, 0n);
  const expected = expectedGroups.reduce((sum, row) => sum + row.netAmount, 0n);
  const authorizedFeeBuffer = committedGroups.reduce((sum, row) => sum + row.feeBuffer, 0n);
  const expectedFeeBuffer = expectedGroups.reduce((sum, row) => sum + row.feeBuffer, 0n);
  const feeBuffer = authorizedFeeBuffer + expectedFeeBuffer;
  const authorizedDemand = committed + authorizedFeeBuffer;
  const demand = authorizedDemand + expected + expectedFeeBuffer;
  const settlementReasons = deriveSettlementUnavailableReasons(
    input,
    fundingUnavailableReasons,
    obligationData.pendingTransfers,
    authorizedDemand
  );

  const canDerive = fundingUnavailableReasons.length === 0 && input.balance !== null;
  const available = canDerive ? clampPoolFundingAtZero(input.balance!.value - demand) : null;
  const shortfall = canDerive
    ? clampPoolFundingAtZero(authorizedDemand - input.balance!.value)
    : null;
  const suggestedTopUp = canDerive ? clampPoolFundingAtZero(demand - input.balance!.value) : null;
  let fundingState: PoolFundingState = "unavailable";
  if (canDerive) {
    if (demand === 0n) fundingState = "no-demand";
    else if (input.balance!.value < authorizedDemand) fundingState = "insufficient";
    else if (input.balance!.value < demand) fundingState = "low";
    else fundingState = "healthy";
  }

  return {
    safe: input.safe,
    routeAddresses: input.routeAddresses ?? {
      account: input.safe,
      indexed: input.safe,
      live: input.safe,
    },
    token: input.token,
    balance: input.balance,
    ledgerReadAt: input.ledgerReadAt,
    committed: canDerive ? committed : null,
    expected: canDerive ? expected : null,
    authorizedFeeBuffer: canDerive ? authorizedFeeBuffer : null,
    expectedFeeBuffer: canDerive ? expectedFeeBuffer : null,
    feeBuffer: canDerive ? feeBuffer : null,
    quotedFees: input.feeQuotes.every((quote) => quote.fee !== null)
      ? input.feeQuotes.reduce((sum, quote) => sum + (quote.fee ?? 0n), 0n)
      : null,
    feeQuotes: input.feeQuotes,
    available,
    shortfall,
    suggestedTopUp,
    fundingState,
    fundingUnavailableReasons: [...new Set(fundingUnavailableReasons)],
    settlementReadiness: settlementReasons.length === 0 ? "ready" : "unavailable",
    settlementUnavailableReasons: settlementReasons,
    obligations: obligationData.groups,
    transit: obligationData.transit,
    limits: input.limits,
    nativeFeeBalance: input.nativeFeeBalance,
  };
}
