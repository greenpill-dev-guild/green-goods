// The checks a production QA case passes before any upload, queue admission or signature. An
// approved write case carries Afo's approval as a private file (never in Git): the case, its chain,
// garden, signer role and address, its limits and how many broadcasts it may make. A run claims a
// broadcast before it signs, so a repeated or duplicated job is refused until the earlier attempt
// is reconciled.
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, writeSync } from "node:fs";
import { join } from "node:path";

export type GuardCode =
  | "not-approved"
  | "expired"
  | "wrong-target"
  | "wrong-chain"
  | "wrong-garden"
  | "wrong-signer"
  | "over-limit"
  | "duplicate";

export class GuardRefusal extends Error {
  constructor(
    readonly code: GuardCode,
    message: string
  ) {
    super(`${code}: ${message}`);
    this.name = "GuardRefusal";
  }
}

/** One case of Afo's approval, as the private approval file records it. */
export interface ApprovedCase {
  caseId: string;
  machine: string;
  origin: string;
  chainId: number;
  gardenAddress: string;
  signerRole: "gardener" | "steward";
  signerAddress: string;
  maxBroadcasts: number;
  /** The largest network fee the signer may accept for one broadcast, in wei. */
  maxFeeWei: string;
}

export interface Approval {
  id: string;
  approvedBy: string;
  approvedAt: string;
  expiresAt: string;
  cases: ApprovedCase[];
}

/** What the run observed in the browser and the wallet just before the first write. */
export interface Observed {
  caseId: string;
  machine: string;
  origin: string;
  chainId: number;
  gardenAddress: string;
  signerAddress: string;
  /** The wallet's fee estimate for the broadcast about to be signed, in wei, when known. */
  feeWei?: string;
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** Returns the approved case the observation matches, or throws the first refusal. */
export function preflight(approval: Approval, observed: Observed, now = new Date()): ApprovedCase {
  const approved = approval.cases.find((c) => c.caseId === observed.caseId);
  if (!approved) {
    throw new GuardRefusal("not-approved", `${observed.caseId} is not in approval ${approval.id}`);
  }
  if (!(Date.parse(approval.expiresAt) > now.getTime())) {
    throw new GuardRefusal("expired", `approval ${approval.id} expired at ${approval.expiresAt}`);
  }
  if (approved.machine !== observed.machine || approved.origin !== observed.origin) {
    throw new GuardRefusal(
      "wrong-target",
      `approved for ${approved.origin} on ${approved.machine}, observed ${observed.origin} on ${observed.machine}`
    );
  }
  if (approved.chainId !== observed.chainId) {
    throw new GuardRefusal(
      "wrong-chain",
      `approved chain ${approved.chainId}, the app or wallet is on ${observed.chainId}`
    );
  }
  if (!same(approved.gardenAddress, observed.gardenAddress)) {
    throw new GuardRefusal("wrong-garden", "the selected garden is not the approved garden");
  }
  if (!same(approved.signerAddress, observed.signerAddress)) {
    throw new GuardRefusal("wrong-signer", `the wallet is not the approved ${approved.signerRole}`);
  }
  if (observed.feeWei !== undefined && BigInt(observed.feeWei) > BigInt(approved.maxFeeWei)) {
    throw new GuardRefusal(
      "over-limit",
      `fee ${observed.feeWei} wei is above the approved ${approved.maxFeeWei} wei`
    );
  }
  return approved;
}

/**
 * Claims the next broadcast for a case before signing. Each claim is a create-only file, so two
 * jobs racing for the same broadcast cannot both win. A claim stays until someone reconciles the
 * attempt (records its hash or that nothing was sent); only then may a retry claim again, and
 * never beyond maxBroadcasts.
 */
export function claimBroadcast(
  ledgerDir: string,
  approval: Approval,
  approved: ApprovedCase,
  jobId: string
): string {
  const dir = join(ledgerDir, approval.id, approved.caseId);
  mkdirSync(dir, { recursive: true });
  for (let n = 1; n <= approved.maxBroadcasts; n++) {
    const claim = join(dir, `broadcast-${n}.json`);
    if (existsSync(claim)) {
      const prior = JSON.parse(readFileSync(claim, "utf8")) as {
        reconciled?: unknown;
        jobId: string;
      };
      if (!prior.reconciled) {
        throw new GuardRefusal(
          "duplicate",
          `broadcast ${n} of ${approved.caseId} was claimed by job ${prior.jobId} and is not reconciled`
        );
      }
      continue;
    }
    let fd: number;
    try {
      fd = openSync(claim, "wx");
    } catch {
      throw new GuardRefusal(
        "duplicate",
        `another job claimed broadcast ${n} of ${approved.caseId}`
      );
    }
    writeSync(fd, `${JSON.stringify({ jobId, claimedAt: new Date().toISOString() })}\n`);
    closeSync(fd);
    return claim;
  }
  throw new GuardRefusal(
    "over-limit",
    `${approved.caseId} already used its ${approved.maxBroadcasts} approved broadcast(s)`
  );
}
