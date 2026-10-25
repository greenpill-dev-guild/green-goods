import { indexer } from "envio";
import { cursorWins } from "./commitment-pool-projections";
import {
  assertSame,
  cosmoId,
  flag,
  identity,
  integer,
  position,
  text,
  type CosmoContext,
  type CosmoEvent,
} from "./cosmo-local-projections";
import { sameFacts } from "./voucher-service-projections";

/** A source binding can be revoked; it never rewrites previously snapshotted terms. */
export async function projectIssuerAuthority(
  event: CosmoEvent,
  context: CosmoContext
): Promise<void> {
  if (event.eventName !== "IssuerAuthorityConfigured")
    throw new Error("Unrouted issuer authority event");
  const facts = {
    issuer: text(event.params, "issuer"),
    token: text(event.params, "token"),
    authority: text(event.params, "authority"),
  };
  const id = cosmoId(event.chainId, event.srcAddress, `${facts.issuer}-${facts.token}`);
  const existing = await context.VoucherIssuerAuthority.get(id);
  if (
    existing?.blockNumber === BigInt(event.block.number) &&
    existing.logIndex === event.logIndex
  ) {
    sameFacts(existing, { ...facts, ...position(event) }, "issuer authority event position");
    return;
  }
  if (!cursorWins(event.block.number, event.logIndex, existing?.blockNumber, existing?.logIndex))
    return;
  await context.VoucherIssuerAuthority.set({
    ...identity(event),
    id,
    ...facts,
    ...position(event),
  });
}

/** Reserve configuration says nothing about stock, minting or fulfilled service capacity. */
export async function projectReserveAsset(event: CosmoEvent, context: CosmoContext): Promise<void> {
  if (event.eventName !== "AssetConfigured") throw new Error("Unrouted reserve asset event");
  const facts = {
    issuer: text(event.params, "issuer"),
    token: text(event.params, "token"),
    issuerAuthority: text(event.params, "issuerAuthority"),
    enabled: flag(event.params, "enabled"),
  };
  const id = cosmoId(event.chainId, event.srcAddress, `${facts.issuer}-${facts.token}`);
  const existing = await context.VoucherReserveAsset.get(id);
  if (
    existing?.blockNumber === BigInt(event.block.number) &&
    existing.logIndex === event.logIndex
  ) {
    sameFacts(existing, { ...facts, ...position(event) }, "reserve asset event position");
    return;
  }
  if (!cursorWins(event.block.number, event.logIndex, existing?.blockNumber, existing?.logIndex))
    return;
  await context.VoucherReserveAsset.set({ ...identity(event), id, ...facts, ...position(event) });
}

/** Settlement omits the learner. Do not turn the initiator into an inferred recipient. */
export async function projectPoolExchange(event: CosmoEvent, context: CosmoContext): Promise<void> {
  if (event.eventName !== "SwapSettlement") throw new Error("Unrouted pool exchange event");
  const facts = {
    initiator: text(event.params, "initiator"),
    tokenIn: text(event.params, "tokenIn"),
    tokenOut: text(event.params, "tokenOut"),
    amountIn: integer(event.params, "amountIn"),
    quotedAmountOut: integer(event.params, "quotedAmountOut"),
    nominalAmountOut: integer(event.params, "nominalAmountOut"),
    amountOut: integer(event.params, "amountOut"),
    poolFee: integer(event.params, "poolFee"),
    protocolFee: integer(event.params, "protocolFee"),
    ...position(event),
  };
  const id = cosmoId(event.chainId, event.srcAddress, `${facts.txHash}-${event.logIndex}`);
  const existing = await context.VoucherPoolExchange.get(id);
  if (existing) {
    sameFacts(existing, facts, "immutable pool exchange");
    return;
  }
  assertSame(facts.tokenIn === facts.tokenOut, false, "pool exchange asset pair");
  await context.VoucherPoolExchange.set({ ...identity(event), id, ...facts });
}

indexer.contractRegister(
  { contract: "CommitmentPoolingModule", event: "EarnedVoucherModulePinned" },
  async ({ event, context }) => {
    context.chain.VoucherEntitlementModule.add(event.params.module);
  }
);
indexer.onEvent(
  { contract: "VoucherEntitlementModule", event: "IssuerAuthorityConfigured" },
  async ({ event, context }) => {
    await projectIssuerAuthority(event, context);
  }
);
indexer.onEvent(
  { contract: "GnosisVoucherAdapter", event: "AssetConfigured" },
  async ({ event, context }) => {
    await projectReserveAsset(event, context);
  }
);
indexer.onEvent(
  { contract: "CLCSwapPool", event: "SwapSettlement" },
  async ({ event, context }) => {
    await projectPoolExchange(event, context);
  }
);
