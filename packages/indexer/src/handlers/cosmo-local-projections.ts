import type { Entity } from "envio";

import { getTxHash } from "./event-access";

export type CosmoEvent = {
  readonly eventName: string;
  readonly chainId: number;
  readonly srcAddress: string;
  readonly params: Readonly<Record<string, unknown>>;
  readonly block: { readonly number: number; readonly timestamp: number };
  readonly transaction: unknown;
  readonly logIndex: number;
};

type Store<Name extends ParametersForEntity> = {
  get(id: string): Promise<Entity<Name> | undefined>;
  set(entity: Entity<Name>): void | Promise<void>;
};
type ParametersForEntity =
  | "ServiceOfferRevision"
  | "ServiceClaimConsent"
  | "PersonalServicePurchase"
  | "PersonalServiceDepositReceipt"
  | "VoucherEndpointConfiguration"
  | "VoucherRedemption"
  | "VoucherRedemptionCustody"
  | "VoucherRedemptionAction"
  | "VoucherRedemptionActionResult"
  | "VoucherRedemptionAcknowledgment"
  | "VoucherCoreConfiguration"
  | "EarnedVoucherRevision"
  | "VoucherServiceAcceptance"
  | "VoucherServiceSetup"
  | "VoucherServiceCustody"
  | "VoucherServiceSetupResult"
  | "VoucherServiceSetupAction"
  | "VoucherServiceFinalAllocation"
  | "VoucherServiceFinalLegResult"
  | "VoucherServiceFinalResult"
  | "VoucherServiceAcknowledgment"
  | "VoucherIssuerAuthority"
  | "VoucherReserveAsset"
  | "VoucherPoolExchange";
export type CosmoContext = { readonly [Name in ParametersForEntity]: Store<Name> };

/** The emitting module is part of every new projection identity. */
export function cosmoId(
  chainId: number | bigint,
  moduleAddress: string,
  key?: string | bigint
): string {
  return `${chainId}-${moduleAddress.toLowerCase()}${key === undefined ? "" : `-${String(key).toLowerCase()}`}`;
}

export function identity(event: CosmoEvent, key?: string | bigint) {
  return {
    id: cosmoId(event.chainId, event.srcAddress, key),
    chainId: event.chainId,
    moduleAddress: event.srcAddress.toLowerCase(),
  };
}

export function position(event: CosmoEvent) {
  return {
    blockNumber: BigInt(event.block.number),
    logIndex: event.logIndex,
    txHash: getTxHash(event.transaction).toLowerCase(),
    timestamp: event.block.timestamp,
  };
}

export function times(event: CosmoEvent, existing?: { createdAt: number; updatedAt: number }) {
  return {
    createdAt: Math.min(existing?.createdAt ?? event.block.timestamp, event.block.timestamp),
    updatedAt: Math.max(existing?.updatedAt ?? event.block.timestamp, event.block.timestamp),
  };
}

export function integer(params: Readonly<Record<string, unknown>>, key: string): bigint {
  const value = params[key];
  if (typeof value !== "bigint" || value < 0n)
    throw new Error(`Invalid unsigned event field: ${key}`);
  return value;
}

export function text(params: Readonly<Record<string, unknown>>, key: string): string {
  const value = params[key];
  if (typeof value !== "string") throw new Error(`Invalid string event field: ${key}`);
  return value.toLowerCase();
}

export function flag(params: Readonly<Record<string, unknown>>, key: string): boolean {
  const value = params[key];
  if (typeof value !== "boolean") throw new Error(`Invalid boolean event field: ${key}`);
  return value;
}

export function smallInteger(
  params: Readonly<Record<string, unknown>>,
  key: string,
  max: bigint
): number {
  const value = integer(params, key);
  if (value > max) throw new Error(`Unsupported event discriminator: ${key}=${value}`);
  return Number(value);
}

export function tuple(
  params: Readonly<Record<string, unknown>>,
  key: string
): Readonly<Record<string, unknown>> {
  const value = params[key];
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Invalid tuple event field: ${key}`);
  }
  return value as Readonly<Record<string, unknown>>;
}

export function maximum(left: bigint, right: bigint): bigint {
  return left > right ? left : right;
}

export function assertSame(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) throw new Error(`Conflicting ${label}`);
}

type Cursor<Prefix extends string> = {
  [Key in `${Prefix}BlockNumber`]: bigint | undefined;
} & { [Key in `${Prefix}LogIndex` | `${Prefix}At`]: number | undefined } & {
  [Key in `${Prefix}TxHash`]: string | undefined;
};

export function cursor<Prefix extends string>(prefix: Prefix, event?: CosmoEvent): Cursor<Prefix> {
  return {
    [`${prefix}BlockNumber`]: event ? BigInt(event.block.number) : undefined,
    [`${prefix}LogIndex`]: event?.logIndex,
    [`${prefix}TxHash`]: event ? getTxHash(event.transaction).toLowerCase() : undefined,
    [`${prefix}At`]: event?.block.timestamp,
  } as Cursor<Prefix>;
}

/** Peer/pause observations are local facts; they do not hydrate cross-chain custody state. */
export async function projectVoucherEndpoint(
  event: CosmoEvent,
  context: CosmoContext
): Promise<void> {
  const id = cosmoId(event.chainId, event.srcAddress);
  const existing = await context.VoucherEndpointConfiguration.get(id);
  const endpoint = existing ?? {
    ...identity(event),
    pinSeen: false,
    localChainId: undefined,
    router: undefined,
    remoteChainSelector: undefined,
    remoteChainId: undefined,
    remotePeer: undefined,
    paused: undefined,
    ...cursor("pinned"),
    ...cursor("pause"),
    ...times(event),
  };
  if (event.eventName === "VoucherEndpointPinned") {
    const fields = {
      localChainId: integer(event.params, "localChainId"),
      router: text(event.params, "router"),
      remoteChainSelector: integer(event.params, "remoteChainSelector"),
      remoteChainId: integer(event.params, "remoteChainId"),
      remotePeer: text(event.params, "remotePeer"),
    };
    assertSame(fields.localChainId, BigInt(event.chainId), "voucher endpoint local chain");
    if (endpoint.pinSeen) {
      for (const key of [
        "localChainId",
        "router",
        "remoteChainSelector",
        "remoteChainId",
        "remotePeer",
      ] as const) {
        assertSame(endpoint[key], fields[key], `immutable voucher endpoint ${key}`);
      }
      return;
    }
    await context.VoucherEndpointConfiguration.set({
      ...endpoint,
      ...fields,
      pinSeen: true,
      ...cursor("pinned", event),
      ...times(event, endpoint),
    });
  } else if (event.eventName === "VoucherPauseChanged") {
    const block = BigInt(event.block.number);
    if (block === endpoint.pauseBlockNumber && event.logIndex === endpoint.pauseLogIndex) {
      assertSame(endpoint.paused, flag(event.params, "paused"), "voucher pause event position");
      return;
    }
    if (
      endpoint.pauseBlockNumber !== undefined &&
      (block < endpoint.pauseBlockNumber ||
        (block === endpoint.pauseBlockNumber && event.logIndex <= (endpoint.pauseLogIndex ?? -1)))
    )
      return;
    await context.VoucherEndpointConfiguration.set({
      ...endpoint,
      paused: flag(event.params, "paused"),
      ...cursor("pause", event),
      ...times(event, endpoint),
    });
  } else {
    throw new Error(`Unrouted voucher endpoint event: ${event.eventName}`);
  }
}
