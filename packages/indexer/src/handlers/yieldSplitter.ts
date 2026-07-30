import { indexer, type YieldAllocation } from "envio";

import { getTxHash, getYieldAllocationId, normalizeAddress } from "./shared";

// ============================================================================
// YIELD SPLITTER EVENT HANDLERS
// ============================================================================

indexer.onEvent({ contract: "YieldSplitter", event: "YieldSplit" }, async ({ event, context }) => {
  const garden = normalizeAddress(event.params.garden);
  const asset = normalizeAddress(event.params.asset);
  const txHash = getTxHash(event.transaction);
  const allocationId = getYieldAllocationId(event.chainId, txHash, event.logIndex);

  const allocationEntity: YieldAllocation = {
    id: allocationId,
    chainId: event.chainId,
    garden,
    asset,
    cookieJarAmount: event.params.cookieJarAmount,
    fractionsAmount: event.params.fractionsAmount,
    juiceboxAmount: event.params.juiceboxAmount,
    totalAmount: event.params.totalYield,
    txHash,
    timestamp: event.block.timestamp,
  };

  context.YieldAllocation.set(allocationEntity);

  context.log.info("Yield split executed", {
    garden,
    asset,
    cookieJarAmount: event.params.cookieJarAmount.toString(),
    fractionsAmount: event.params.fractionsAmount.toString(),
    juiceboxAmount: event.params.juiceboxAmount.toString(),
    chainId: event.chainId,
    blockNumber: event.block.number,
    correlationId: txHash,
  });
});
