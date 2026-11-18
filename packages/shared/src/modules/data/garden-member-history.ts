import { isAddress } from "viem";
import type { Address, GardenMemberHistory } from "../../types/domain";
import { GARDEN_ROLE_IDS, type GardenRole } from "../../utils/blockchain/garden-roles";
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
  const ordered = [...events.values()].sort((a, b) =>
    a.blockNumber < b.blockNumber
      ? -1
      : a.blockNumber > b.blockNumber
        ? 1
        : a.logIndex - b.logIndex || a.id.localeCompare(b.id)
  );
  const members = new Map<string, GardenMemberHistory>();
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
    }
    if (event.action === "GRANTED") {
      if (Object.keys(member.roleSince).length === 0) member.memberSince = event.timestamp;
      member.joinedAt ??= event.timestamp;
      member.roleSince[event.role] ??= event.timestamp;
    } else {
      delete member.roleSince[event.role];
      if (Object.keys(member.roleSince).length === 0) member.memberSince = null;
    }
  }
  return [...members.values()];
}
