import type { Address, Hex } from "viem";
import type { Domain, WorkInput } from "../../types/domain";
import { canonicalJson, reportingDigest } from "./canonical";

/**
 * The offchain field contract of one Action as the gardener confirmed it.
 *
 * A confirmed report revision is validated against this frozen definition, never against whatever
 * the Action's instructions say later: an instruction update does not reinterpret a pending
 * transaction. Live eligibility (membership, dates, domain) is still rechecked before upload and
 * send, and the resolver enforces it at inclusion.
 */
export interface ActionDefinition {
  chainId: number;
  actionUID: number;
  slug: string;
  title: string;
  /** Epoch milliseconds, as Shared's action readers normalize them. */
  startTime: number;
  endTime: number;
  domain: Domain | null;
  inputs: WorkInput[];
  media: {
    required: boolean;
    minImageCount: number;
    maxImageCount: number | null;
  };
}

export interface ActionDefinitionSource {
  registry: Address;
  /** Instructions reference (CID) the inputs were read from. */
  instructionsRef: string;
}

export interface ActionDefinitionSnapshot {
  definition: ActionDefinition;
  source: ActionDefinitionSource;
  /** Block the definition was observed at, as a decimal string. */
  observedBlock: string;
  digest: Hex;
}

export class ActionSnapshotError extends Error {}

function snapshotBody(snapshot: Omit<ActionDefinitionSnapshot, "digest">) {
  return {
    definition: snapshot.definition,
    source: { ...snapshot.source, registry: snapshot.source.registry.toLowerCase() },
    observedBlock: snapshot.observedBlock,
  };
}

export function snapshotActionDefinition(
  definition: ActionDefinition,
  source: ActionDefinitionSource,
  observedBlock: bigint
): ActionDefinitionSnapshot {
  if (!Number.isSafeInteger(definition.actionUID) || definition.actionUID < 0) {
    throw new ActionSnapshotError("Action UID must be a non-negative safe integer");
  }
  if (!source.instructionsRef) {
    // A built-in fallback template is not the Action's published contract.
    throw new ActionSnapshotError("Action instructions reference is required for a snapshot");
  }
  const body = { definition, source, observedBlock: observedBlock.toString(10) };
  return { ...body, digest: reportingDigest("action-definition", snapshotBody(body)) };
}

/** Parses persisted snapshot bytes and rejects any whose digest does not match their content. */
export function parseActionSnapshot(serialized: string): ActionDefinitionSnapshot {
  const snapshot = JSON.parse(serialized) as ActionDefinitionSnapshot;
  const expected = reportingDigest("action-definition", snapshotBody(snapshot));
  if (snapshot.digest !== expected) {
    throw new ActionSnapshotError("Action snapshot digest does not match its content");
  }
  return snapshot;
}

export function serializeActionSnapshot(snapshot: ActionDefinitionSnapshot): string {
  return canonicalJson(snapshot);
}

export type ActionEligibilityIssue = "not_started" | "ended" | "domain_mismatch";

/** Offchain eligibility preflight; the Work resolver remains the authority at inclusion. */
export function actionEligibilityIssues(
  definition: ActionDefinition,
  gardenDomainMask: number | null,
  nowMs: number
): ActionEligibilityIssue[] {
  const issues: ActionEligibilityIssue[] = [];
  if (nowMs < definition.startTime) issues.push("not_started");
  if (nowMs > definition.endTime) issues.push("ended");
  if (
    definition.domain !== null &&
    gardenDomainMask !== null &&
    (gardenDomainMask & (1 << definition.domain)) === 0
  ) {
    issues.push("domain_mismatch");
  }
  return issues;
}
