import { isAddress } from "viem";
import type { Address, GardenMemberHistory } from "../../types/domain";
import {
  GARDEN_ROLE_IDS,
  GARDEN_ROLE_ORDER,
  type GardenRole,
} from "../../utils/blockchain/garden-roles";
import { greenGoodsIndexer, type GraphQLReader } from "./graphql-client";

interface GardenMemberHistoryScope {
  garden?: Address;
  account?: Address;
  chainId: number;
}

interface RoleEvent {
  id: string;
  garden: Address;
  account: Address;
  role: GardenRole;
  action: "GRANTED" | "REVOKED";
  timestamp: number;
  blockNumber: bigint;
  logIndex: number;
}

const QUERY = `query GardenMemberHistory($where: GardenRoleEvent_bool_exp!, $limit: Int!, $offset: Int!) {
  GardenRoleEvent(where: $where, order_by: [{blockNumber: asc}, {logIndex: asc}, {id: asc}], limit: $limit, offset: $offset) {
    id chainId garden account role action timestamp blockNumber logIndex txHash
  }
}`;

function parseEvent(value: unknown, scope: GardenMemberHistoryScope): RoleEvent {
  const row = value as Record<string, unknown> | null;
  const role = Object.entries(GARDEN_ROLE_IDS).find(([, id]) => id === row?.role)?.[0] as
    | GardenRole
    | undefined;
  if (
    !row ||
    typeof row.id !== "string" ||
    !row.id ||
    row.chainId !== scope.chainId ||
    typeof row.garden !== "string" ||
    !isAddress(row.garden, { strict: false }) ||
    typeof row.account !== "string" ||
    !isAddress(row.account, { strict: false }) ||
    !role ||
    (row.action !== "GRANTED" && row.action !== "REVOKED") ||
    typeof row.timestamp !== "number" ||
    !Number.isSafeInteger(row.timestamp) ||
    row.timestamp <= 0 ||
    row.timestamp * 1000 > 8_640_000_000_000_000 ||
    typeof row.logIndex !== "number" ||
    !Number.isSafeInteger(row.logIndex) ||
    row.logIndex < 0 ||
    typeof row.blockNumber !== "string" ||
    !/^\d+$/.test(row.blockNumber) ||
    typeof row.txHash !== "string" ||
    !/^0x[\da-f]{64}$/i.test(row.txHash) ||
    (scope.garden && row.garden.toLowerCase() !== scope.garden.toLowerCase()) ||
    (scope.account && row.account.toLowerCase() !== scope.account.toLowerCase())
  ) {
    throw new Error("Invalid garden membership history event");
  }
  return {
    id: row.id,
    garden: row.garden.toLowerCase() as Address,
    account: row.account.toLowerCase() as Address,
    role,
    action: row.action,
    timestamp: row.timestamp * 1000,
    blockNumber: BigInt(row.blockNumber),
    logIndex: row.logIndex,
  };
}

/** Read every event before reducing: a missing revoke must never become a false membership date. */
export async function getGardenMemberHistory(
  scope: GardenMemberHistoryScope,
  reader: GraphQLReader = greenGoodsIndexer,
  signal?: AbortSignal
): Promise<GardenMemberHistory[]> {
  if (
    !Number.isSafeInteger(scope.chainId) ||
    scope.chainId <= 0 ||
    (!scope.garden && !scope.account) ||
    (scope.garden && !isAddress(scope.garden, { strict: false })) ||
    (scope.account && !isAddress(scope.account, { strict: false }))
  ) {
    throw new Error("Invalid garden membership history scope");
  }
  const ordered = await readOrderedEvents(scope, reader, signal);
  const members = new Map<string, GardenMemberHistory>();
  const recordedRoles = new Map<string, Set<GardenRole>>();
  for (const event of ordered) {
    const key = `${event.garden}:${event.account}`;
    let member = members.get(key);
    if (!member) {
      member = {
        garden: event.garden,
        account: event.account,
        joinedAt: null,
        memberSince: null,
        roleSince: {},
      };
      members.set(key, member);
      recordedRoles.set(key, new Set());
    }
    recordedRoles.get(key)?.add(event.role);
    if (event.action === "GRANTED") {
      if (Object.keys(member.roleSince).length === 0) member.memberSince = event.timestamp;
      member.joinedAt ??= event.timestamp;
      member.roleSince[event.role] ??= event.timestamp;
    } else {
      delete member.roleSince[event.role];
      if (Object.keys(member.roleSince).length === 0) member.memberSince = null;
    }
  }
  for (const [key, member] of members) {
    const recorded = recordedRoles.get(key);
    member.recordedRoles = GARDEN_ROLE_ORDER.filter((role) => recorded?.has(role));
  }
  return [...members.values()];
}

/** Every role event in scope, in chain order. */
async function readOrderedEvents(
  scope: GardenMemberHistoryScope,
  reader: GraphQLReader,
  signal?: AbortSignal
): Promise<RoleEvent[]> {
  const where = {
    chainId: { _eq: scope.chainId },
    ...(scope.garden ? { garden: { _eq: scope.garden.toLowerCase() } } : {}),
    ...(scope.account ? { account: { _eq: scope.account.toLowerCase() } } : {}),
  };
  const events = new Map<string, RoleEvent>();
  const limit = 200;
  for (let offset = 0; ; offset += limit) {
    const { data, error } = await reader.query<{ GardenRoleEvent?: unknown[] }>(
      QUERY,
      { where, limit, offset },
      "getGardenMemberHistory",
      signal
    );
    if (error) throw error;
    if (!Array.isArray(data?.GardenRoleEvent)) throw new Error("Missing garden membership history");
    for (const value of data.GardenRoleEvent) {
      const event = parseEvent(value, scope);
      events.set(event.id, event);
    }
    if (data.GardenRoleEvent.length < limit) break;
  }
  return [...events.values()].sort((a, b) =>
    a.blockNumber < b.blockNumber
      ? -1
      : a.blockNumber > b.blockNumber
        ? 1
        : a.logIndex - b.logIndex || a.id.localeCompare(b.id)
  );
}

/** A member's role changing in a garden: their first role (a join), a later one, or one taken away. */
interface GardenRoleChangeEvent {
  id: string;
  account: Address;
  role: GardenRole;
  kind: "joined" | "granted" | "revoked";
  /** When it happened, in milliseconds. */
  at: number;
}

/**
 * Each role change in one garden, newest first. A member's first role is their join, so a role
 * given later is never counted as someone new; a grant of a role already held and a revoke of
 * one not held change nothing and are left out.
 */
export async function getGardenRoleChanges(
  scope: { garden: Address; chainId: number },
  reader: GraphQLReader = greenGoodsIndexer,
  signal?: AbortSignal
): Promise<GardenRoleChangeEvent[]> {
  const held = new Map<string, Set<GardenRole>>();
  const changes: GardenRoleChangeEvent[] = [];
  if (!Number.isSafeInteger(scope.chainId) || !isAddress(scope.garden, { strict: false })) {
    throw new Error("Invalid garden role change scope");
  }
  for (const event of await readOrderedEvents(scope, reader, signal)) {
    const roles = held.get(event.account);
    if (event.action === "GRANTED") {
      if (roles?.has(event.role)) continue;
      changes.push({
        id: event.id,
        account: event.account,
        role: event.role,
        // A first role, or a return after every role was taken away, is a join.
        kind: roles === undefined || roles.size === 0 ? "joined" : "granted",
        at: event.timestamp,
      });
      held.set(event.account, new Set([...(roles ?? []), event.role]));
    } else if (roles?.delete(event.role)) {
      changes.push({
        id: event.id,
        account: event.account,
        role: event.role,
        kind: "revoked",
        at: event.timestamp,
      });
    }
  }
  return changes.reverse();
}
