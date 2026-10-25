import type { Address } from "../../../types/domain";
import type {
  PilotRewardItem,
  ServiceAccessPilot,
  ServiceAccessPilotAction,
} from "../service-access-pilot-types";
import type { ServiceAccessKey, ServiceAccessSnapshot } from "../service-access-types";
import { rehearsalHash } from "./demo-service-identities";

export const PILOT_ASSETS = {
  a: {
    chainId: 100,
    token: "0x000000000000000000000000000000000000fa01" as Address,
    symbol: "TEST-A",
    decimals: 6,
  },
  b: {
    chainId: 100,
    token: "0x000000000000000000000000000000000000fb01" as Address,
    symbol: "TEST-B",
    decimals: 6,
  },
};
export const PILOT_ISSUERS = {
  a: "0x000000000000000000000000000000000000fa02" as Address,
  b: "0x000000000000000000000000000000000000fb02" as Address,
};
const POOL = "0x000000000000000000000000000000000000fc01" as Address;
const PILOT_SERVICE = {
  access: "full" as const,
  units: 1n as const,
  durationMinutes: 60 as const,
  voucherUnits: 1_000_000n as const,
  validUntil: 5000n,
};

type Reward = NonNullable<ServiceAccessPilot["reward"]>;
export interface PilotLedger {
  holdings: { a: bigint; b: bigint };
  reserve: { a: bigint; b: bigint };
  allowance: { a: bigint; b: bigint };
  escrowAllowance: bigint;
  rewards: Map<bigint, Reward>;
  exchange: ServiceAccessPilot["exchange"];
  clock: bigint;
  configuration: bigint;
}
export function createPilotLedger(): PilotLedger {
  return {
    holdings: { a: 0n, b: 0n },
    reserve: { a: 0n, b: 0n },
    allowance: { a: 0n, b: 0n },
    escrowAllowance: 0n,
    rewards: new Map(),
    clock: 1000n,
    configuration: 1n,
    exchange: {
      pool: POOL,
      inventory: 10_000_000n,
      inputHolding: 0n,
      inputLimit: 10_000_000n,
      listed: true,
      allowance: 0n,
      status: "none",
      failure: null,
      quote: null,
      receipt: null,
    },
  };
}
export function pilotLedgerIdentity(k: ServiceAccessKey): string {
  return `${k.sourceChainId}:${k.coreModule.toLowerCase()}:${k.buyer.toLowerCase()}`;
}
export function isPilotCommitment(id: bigint): boolean {
  return id === 1023n || id === 1025n || id === 1026n;
}
function item(k: ServiceAccessKey, kind: "voucher" | "gd"): PilotRewardItem {
  const token = k.commitmentId === 1025n ? "b" : "a";
  return {
    id: rehearsalHash(`pilot-reward:${pilotLedgerIdentity(k)}:${k.commitmentId}:${kind}:revision1`),
    asset:
      kind === "voucher"
        ? PILOT_ASSETS[token]
        : {
            chainId: 42220,
            token: "0x000000000000000000000000000000000000fd01" as Address,
            symbol: "TEST-G$",
            decimals: 18,
          },
    amount: kind === "voucher" ? (token === "b" ? 1_000_000n : 2_044_986n) : 100n * 10n ** 18n,
    recipient: k.buyer,
    funder: PILOT_ISSUERS[token],
    paymentMethod: kind === "voucher" ? "issuer-reserve-allowance" : "celo-gd",
    state: "pending",
    acknowledgment: "none",
    attempts: 0n,
    receipt: null,
  };
}
export function attachPilot(s: ServiceAccessSnapshot, l: PilotLedger): void {
  if (!isPilotCommitment(s.key.commitmentId)) return;
  if (s.key.commitmentId !== 1023n && !l.rewards.has(s.key.commitmentId))
    l.rewards.set(s.key.commitmentId, {
      workFulfilled: false,
      voucher: item(s.key, "voucher"),
      gd: s.key.commitmentId === 1026n ? item(s.key, "gd") : null,
    });
  const reward = l.rewards.get(s.key.commitmentId) ?? null;
  const token = s.key.commitmentId === 1026n ? "a" : "b";
  s.pilot = {
    evidence: "local-rehearsal",
    serviceCommitmentId: 1023n,
    service: PILOT_SERVICE,
    assets: PILOT_ASSETS,
    holdings: { ...l.holdings },
    reward: reward ? structuredClone(reward) : null,
    inventory: {
      asset: PILOT_ASSETS[token],
      reserve: l.reserve[token],
      allowance: l.allowance[token],
      acceptedUndelivered: [...l.rewards.values()]
        .filter(
          (r) =>
            r.voucher.asset.token === PILOT_ASSETS[token].token && r.voucher.state !== "delivered"
        )
        .reduce((sum, r) => sum + r.voucher.amount, 0n),
    },
    exchange: structuredClone(l.exchange),
  };
  if (s.key.commitmentId !== 1023n) s.coreState = reward!.workFulfilled ? "FULFILLED" : "ACCEPTED";
  for (const row of s.voucherSetups)
    if (row.authorization.token === PILOT_ASSETS.b.token && row.destination) {
      row.destination.holderBalance = l.holdings.b;
      row.destination.allowance = l.escrowAllowance;
    }
}

/** Called only after the public local action selector. Role observations are deliberately explicit. */
export function applyPilotAction(
  s: ServiceAccessSnapshot,
  l: PilotLedger,
  a: ServiceAccessPilotAction,
  transfer: () => boolean
): void {
  const reward = l.rewards.get(s.key.commitmentId);
  if (a.action === "observePilotRole") {
    if (a.observation === "work-fulfilled") {
      reward!.workFulfilled = true;
      return;
    }
    if (a.observation === "voucher-budget-repaired") {
      const token = reward!.voucher.asset.token === PILOT_ASSETS.a.token ? "a" : "b";
      l.reserve[token] = reward!.voucher.amount;
      l.allowance[token] = reward!.voucher.amount;
      return;
    }
    const row = s.voucherSetups.find((r) => r.setupId === s.currentVoucherSetupId)!;
    if (a.observation === "issuer-approved") {
      row.destination!.result.issuerApproved = true;
      row.destination!.issuerReturnCeiling = row.authorization.voucherUnits;
      return;
    }
    if (a.observation === "deposit-acknowledged") {
      row.source.setupResult = structuredClone(row.destination!.result);
      row.acknowledgments.setup.sourceObservedSequence = row.destination!.result.sequence;
      row.acknowledgments.setup.pending = false;
      return;
    }
    s.consent!.state = "accepted";
    s.coreState = "ACCEPTED";
    row.source.acceptedEver = {
      setupModule: row.authorization.sourceModule,
      claimHash: row.authorization.claimHash,
      termsRevision: row.authorization.termsRevision,
      requestNonce: row.authorization.requestNonce,
      setupId: row.setupId,
      authorizationHash: row.authorizationHash,
      depositReceiptHash: row.destination!.result.depositReceiptHash!,
    };
    row.source.acceptedReceiptHash = rehearsalHash(`pilot-accepted:${row.setupId}`);
    return;
  }
  if (a.action === "deliverPilotReward") {
    const r = reward![a.asset]!;
    r.attempts++;
    const token = r.asset.token === PILOT_ASSETS.a.token ? "a" : "b";
    if (
      (a.asset === "voucher" && (l.reserve[token] < r.amount || l.allowance[token] < r.amount)) ||
      !transfer()
    ) {
      r.state = "failed";
      return;
    }
    if (a.asset === "voucher") {
      l.reserve[token] -= r.amount;
      l.allowance[token] -= r.amount;
      l.holdings[token] += r.amount;
    }
    r.state = "delivered";
    r.acknowledgment = "pending";
    r.receipt = `local-rehearsal:reward:${r.id}`;
    return;
  }
  if (a.action === "acknowledgePilotReward") {
    reward![a.asset]!.acknowledgment = "observed";
    return;
  }
  if (a.action === "quotePilotExchange") {
    const input = 2_044_986n,
      grossOutput = (input * 1_000_000n) / 2_000_000n;
    const poolFee = (grossOutput * 20_000n) / 1_000_000n,
      protocolFee = (poolFee * 100_000n) / 1_000_000n;
    const q = {
      chainId: 100 as const,
      pool: POOL,
      holder: s.key.buyer,
      inputToken: PILOT_ASSETS.a.token,
      outputToken: PILOT_ASSETS.b.token,
      input,
      grossOutput,
      poolFee,
      protocolFee,
      netOutput: grossOutput - poolFee - protocolFee,
      minimumOutput: 1_000_000n,
      deadline: l.clock + 1000n,
      configuration: l.configuration,
    };
    l.exchange.quote = { ...q, id: rehearsalHash(`pilot-quote:${Object.values(q).join(":")}`) };
    l.exchange.status = "quoted";
    l.exchange.failure = null;
    return;
  }
  if (a.action === "approvePilotExchange") {
    l.exchange.allowance = l.exchange.quote!.input;
    return;
  }
  if (a.action === "resolvePilotExchange") {
    l.exchange.status = "confirmed";
    return;
  }
  if (a.action !== "executePilotExchange") throw new Error("Unknown local pilot action");
  const q = a.quote,
    x = l.exchange;
  const failure = !x.listed
    ? "listing"
    : l.clock > q.deadline
      ? "deadline"
      : q.configuration !== l.configuration || q.netOutput < q.minimumOutput
        ? "minimum"
        : x.allowance < q.input
          ? "allowance"
          : x.inventory < q.grossOutput
            ? "inventory"
            : x.inputHolding + q.input > x.inputLimit
              ? "limit"
              : !transfer()
                ? "transfer"
                : null;
  if (failure) {
    x.status = "failed";
    x.failure = failure;
    return;
  }
  l.holdings.a -= q.input;
  l.holdings.b += q.netOutput;
  x.allowance -= q.input;
  x.inventory -= q.grossOutput;
  x.inputHolding += q.input;
  x.status = "unknown";
  x.receipt = {
    evidence: "local-rehearsal",
    observationId: `local-rehearsal:swap:${q.id}`,
    pool: POOL,
    chainId: 100,
  };
}
