import type { CommitmentSeries } from "envio";

import { createSeries, cursorWins, poolingEntityId } from "./commitment-pool-projections";
import { type PoolingContext, type RuntimeEvent, value } from "./commitment-pool-runtime";
import { normalizeAddress } from "./shared";

export async function handleSeriesEvent(
  event: RuntimeEvent,
  context: PoolingContext
): Promise<void> {
  const seriesId = value<bigint>(event, "seriesId");
  const entityId = poolingEntityId(event.chainId, seriesId);
  const series =
    (await context.CommitmentSeries.get(entityId)) ??
    createSeries(event.chainId, seriesId, event.block.timestamp);
  if (event.eventName === "CommitmentSeriesCreated") {
    const holder = normalizeAddress(value<string>(event, "holder"));
    const poolId = value<bigint>(event, "poolId");
    context.CommitmentSeries.set({
      ...series,
      creationSeen: true,
      poolId,
      poolEntityId: poolingEntityId(event.chainId, poolId),
      createdBy: holder,
      currentHolder: holder,
      state: series.latestLifecycleBlock === undefined ? "ACTIVE" : series.state,
      metadataCID:
        series.latestMetadataBlock === undefined
          ? value<string>(event, "metadataCID")
          : series.metadataCID,
      createdAt: series.createdAt ?? event.block.timestamp,
      updatedAt: Math.max(series.updatedAt, event.block.timestamp),
    });
    return;
  }
  if (event.eventName === "CommitmentSeriesMetadataUpdated") {
    if (
      !cursorWins(
        event.block.number,
        event.logIndex,
        series.latestMetadataBlock,
        series.latestMetadataLogIndex
      )
    )
      return;
    context.CommitmentSeries.set({
      ...series,
      metadataCID: value<string>(event, "metadataCID"),
      latestMetadataBlock: BigInt(event.block.number),
      latestMetadataLogIndex: event.logIndex,
      updatedAt: Math.max(series.updatedAt, event.block.timestamp),
    });
    return;
  }
  if (
    !cursorWins(
      event.block.number,
      event.logIndex,
      series.latestLifecycleBlock,
      series.latestLifecycleLogIndex
    )
  )
    return;
  const states: Readonly<Record<string, CommitmentSeries["state"]>> = {
    CommitmentSeriesRested: "RESTING",
    CommitmentSeriesResumed: "ACTIVE",
    CommitmentSeriesRetired: "RETIRED",
  };
  context.CommitmentSeries.set({
    ...series,
    state: states[event.eventName],
    latestLifecycleBlock: BigInt(event.block.number),
    latestLifecycleLogIndex: event.logIndex,
    updatedAt: Math.max(series.updatedAt, event.block.timestamp),
  });
}
