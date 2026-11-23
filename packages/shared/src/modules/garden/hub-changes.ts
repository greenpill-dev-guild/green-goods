/**
 * What changed in a garden for the Hub's bell (PRD-1536, decided 22 November 2026): people
 * asking to join, people joining, roles given and taken away, and the decisions other stewards
 * made on work and promises. Each kind is listed only for someone who can act on it. Times are
 * in seconds, as the installed app's bell keeps them, so both share one seen record model.
 */
import type { Address } from "../../types/domain";
import type { EASWorkListRow } from "../../types/eas-responses";
import { compareAddresses } from "../../utils/blockchain/address";
import type { GardenRole } from "../../utils/blockchain/garden-roles";
import type { JoinRequestsRead } from "./notifications";

/** A member's role changing: their first role (a join), a later one, or one taken away. */
interface GardenRoleChange {
  id: string;
  account: Address;
  role: GardenRole;
  kind: "joined" | "granted" | "revoked";
  /** Seconds. */
  at: number;
}

/** A steward's decision on a promise, from the pool's event log. */
export interface PromiseDecision {
  id: string;
  commitmentId: bigint;
  decision: "accepted" | "declined" | "confirmed" | "cancelled" | "resolved";
  by: Address;
  /** Seconds. */
  at: number;
}

export type HubGardenChange =
  | { kind: "joinRequested"; id: string; at: number; waiting: number }
  | {
      kind: "joined" | "roleGranted" | "roleRevoked";
      id: string;
      at: number;
      account: Address;
      role: GardenRole;
    }
  | {
      kind: "workDecided";
      id: string;
      at: number;
      work: EASWorkListRow;
      approved: boolean;
      by: Address;
    }
  | {
      kind: "promiseDecided";
      id: string;
      at: number;
      commitmentId: bigint;
      decision: PromiseDecision["decision"];
      by: Address;
    };

interface HubGardenChangeSources {
  account: string;
  /** Who may answer join requests and change roles. */
  canManageMembers: boolean;
  canReviewWork: boolean;
  canDecidePromises: boolean;
  joinRequests?: JoinRequestsRead;
  roleChanges: readonly GardenRoleChange[];
  /** The window's works, each with its latest decision. */
  activity: readonly EASWorkListRow[];
  promiseDecisions: readonly PromiseDecision[];
}

const ROLE_KIND = { joined: "joined", granted: "roleGranted", revoked: "roleRevoked" } as const;

/** The garden's changes for the account, newest first. Its own decisions are not news to it. */
export function deriveHubGardenChanges(sources: HubGardenChangeSources): HubGardenChange[] {
  const byOther = (address: Address) => !compareAddresses(address, sources.account);
  const changes: HubGardenChange[] = [];
  if (sources.canManageMembers) {
    if (sources.joinRequests) {
      const { waiting, since } = sources.joinRequests;
      changes.push({ kind: "joinRequested", id: `joinRequests:${since}`, at: since, waiting });
    }
    for (const change of sources.roleChanges) {
      changes.push({
        kind: ROLE_KIND[change.kind],
        id: `role:${change.id}`,
        at: change.at,
        account: change.account,
        role: change.role,
      });
    }
  }
  if (sources.canReviewWork) {
    for (const work of sources.activity) {
      const decision = work.approval;
      if (!decision || !byOther(decision.stewardAddress)) continue;
      changes.push({
        kind: "workDecided",
        id: `decision:${decision.id}`,
        at: decision.createdAt,
        work,
        approved: decision.approved,
        by: decision.stewardAddress,
      });
    }
  }
  if (sources.canDecidePromises) {
    for (const decision of sources.promiseDecisions) {
      if (!byOther(decision.by)) continue;
      changes.push({
        kind: "promiseDecided",
        id: `promise:${decision.id}`,
        at: decision.at,
        commitmentId: decision.commitmentId,
        decision: decision.decision,
        by: decision.by,
      });
    }
  }
  return changes.sort((left, right) => right.at - left.at);
}
