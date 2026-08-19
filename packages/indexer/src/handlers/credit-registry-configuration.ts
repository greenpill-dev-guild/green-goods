import type { CreditRegistryConfiguration } from "envio";

import { cursorWins } from "./commitment-pool-projections";
import { putLoanEvent, type CreditContext, type CreditEvent } from "./credit-registry-projections";
import { normalizeAddress } from "./shared";

function configurationId(chainId: number, registry: string): string {
  return `${chainId}-${normalizeAddress(registry)}`;
}

export async function registryConfiguration(
  context: CreditContext,
  event: CreditEvent
): Promise<CreditRegistryConfiguration> {
  const id = configurationId(event.chainId, event.srcAddress);
  return (
    (await context.CreditRegistryConfiguration.get(id)) ?? {
      id,
      chainId: event.chainId,
      registry: normalizeAddress(event.srcAddress),
      owner: undefined,
      hatsModule: undefined,
      commitmentPoolingModule: undefined,
      settlementModule: undefined,
      paused: true,
      initializedAt: undefined,
      hatsUpdateBlockNumber: undefined,
      hatsUpdateLogIndex: undefined,
      poolingUpdateBlockNumber: undefined,
      poolingUpdateLogIndex: undefined,
      settlementUpdateBlockNumber: undefined,
      settlementUpdateLogIndex: undefined,
      pauseUpdateBlockNumber: undefined,
      pauseUpdateLogIndex: undefined,
      updatedAt: event.block.timestamp,
    }
  );
}

export async function updateRegistryAddress(
  context: CreditContext,
  event: CreditEvent,
  input: {
    eventType: string;
    field: "hatsModule" | "commitmentPoolingModule" | "settlementModule";
    blockField:
      | "hatsUpdateBlockNumber"
      | "poolingUpdateBlockNumber"
      | "settlementUpdateBlockNumber";
    logField: "hatsUpdateLogIndex" | "poolingUpdateLogIndex" | "settlementUpdateLogIndex";
    previousModule: string;
    newModule: string;
  }
): Promise<void> {
  if (
    !(await putLoanEvent(context, event, {
      eventType: input.eventType,
      data: { previousModule: input.previousModule, newModule: input.newModule },
    }))
  )
    return;
  const current = await registryConfiguration(context, event);
  if (
    !cursorWins(
      event.block.number,
      event.logIndex,
      current[input.blockField],
      current[input.logField]
    )
  )
    return;
  context.CreditRegistryConfiguration.set({
    ...current,
    [input.field]: normalizeAddress(input.newModule),
    [input.blockField]: BigInt(event.block.number),
    [input.logField]: event.logIndex,
    updatedAt: Math.max(current.updatedAt, event.block.timestamp),
  });
}
