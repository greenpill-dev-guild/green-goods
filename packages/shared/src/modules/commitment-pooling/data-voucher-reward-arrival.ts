import type { Hex } from "viem";
import type { Address } from "../../types/domain";
import type { GraphQLReader } from "../data/graphql-client";
import { logger } from "../app/logger";
import { serviceAddress, serviceHash, serviceTuple } from "./service-access-chain-values";

/** Enrich a canonically received reward without letting indexer lag change its delivery status. */
export async function readVoucherRewardArrival(
  key: { chainId: number; adapter: Address; entitlement: Hex; payloadHash: Hex; sequence: bigint },
  reader: GraphQLReader
): Promise<number | null> {
  try {
    const result = await reader.query<{
      VoucherDistributionCommand: unknown[];
      VoucherDistributionAttempt: unknown[];
    }>(
      `query VoucherRewardArrival($chain: Int!, $adapter: String!, $entitlement: String!, $sequence: numeric!) {
        VoucherDistributionCommand(where: {chainId: {_eq: $chain}, moduleAddress: {_eq: $adapter}, entitlementId: {_eq: $entitlement}}, limit: 2) {
          id chainId moduleAddress entitlementId payloadHash recordedSeen delivered latestSequence
        }
        VoucherDistributionAttempt(where: {chainId: {_eq: $chain}, moduleAddress: {_eq: $adapter}, entitlementId: {_eq: $entitlement}, sequence: {_eq: $sequence}, success: {_eq: true}}, limit: 2) {
          id chainId moduleAddress entitlementId commandEntityId sequence success timestamp
        }
      }`,
      {
        chain: key.chainId,
        adapter: key.adapter.toLowerCase(),
        entitlement: key.entitlement,
        sequence: key.sequence.toString(),
      },
      "readVoucherRewardArrival"
    );
    if (result.error) throw result.error;
    const { VoucherDistributionCommand: commands, VoucherDistributionAttempt: attempts } =
      result.data;
    if (!Array.isArray(commands) || !Array.isArray(attempts))
      throw new Error("Incomplete reward arrival read");
    if (commands.length === 0 || attempts.length === 0) return null;
    if (commands.length !== 1 || attempts.length !== 1) throw new Error("Ambiguous reward arrival");
    const command = serviceTuple(commands[0], [
      "id",
      "chainId",
      "moduleAddress",
      "entitlementId",
      "payloadHash",
      "recordedSeen",
      "delivered",
      "latestSequence",
    ]);
    const attempt = serviceTuple(attempts[0], [
      "id",
      "chainId",
      "moduleAddress",
      "entitlementId",
      "commandEntityId",
      "sequence",
      "success",
      "timestamp",
    ]);
    const id = `${key.chainId}-${key.adapter.toLowerCase()}-${key.entitlement}`;
    const matches = (row: Record<string, unknown>) =>
      row.chainId === key.chainId &&
      serviceAddress(row.moduleAddress) === key.adapter.toLowerCase() &&
      serviceHash(row.entitlementId) === key.entitlement;
    if (
      !matches(command) ||
      !matches(attempt) ||
      command.id !== id ||
      attempt.id !== `${id}-${key.sequence}` ||
      attempt.commandEntityId !== id ||
      serviceHash(command.payloadHash) !== key.payloadHash ||
      command.recordedSeen !== true ||
      command.delivered !== true ||
      command.latestSequence !== key.sequence.toString() ||
      attempt.sequence !== key.sequence.toString() ||
      attempt.success !== true ||
      typeof attempt.timestamp !== "number" ||
      !Number.isSafeInteger(attempt.timestamp) ||
      attempt.timestamp <= 0 ||
      !Number.isFinite(new Date(attempt.timestamp * 1000).getTime())
    )
      throw new Error("Reward arrival identity or timestamp mismatch");
    return attempt.timestamp;
  } catch (error) {
    logger.warn("Voucher reward arrival time unavailable", { error });
    return null;
  }
}
