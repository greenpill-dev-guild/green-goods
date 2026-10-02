import { isHash, parseEventLogs, type PublicClient } from "viem";
import { getEASConfig } from "../../config/blockchain";
import type { Action } from "../../types/domain";
import { markStaleActionTranslations } from "../../utils/action/translations";
import {
  ActionRegistryABI,
  createClients,
  EASABI,
  getNetworkContracts,
} from "../../utils/blockchain/contracts";
import { parseDataToWork, parseEasAttestationRecord } from "./eas-parse";
import { easGraphQL } from "./graphql";
import { createEasClient, type GraphQLReader } from "./graphql-client";
import { getActionInstructionFallback, parseInstructionMetadata } from "./greengoods";
import { getFileByHash, resolveIPFSUrl } from "./ipfs/resolve";

type HistoricalClient = Pick<PublicClient, "getTransactionReceipt" | "readContract" | "getLogs">;

/** Replay the submission block only up to the Work's attestation, including intra-tx ordering. */
export async function getActionAtWork(
  actionUID: number,
  workUID: string,
  chainId: number,
  reader: GraphQLReader = createEasClient(chainId),
  client: HistoricalClient = createClients(chainId).publicClient
): Promise<Pick<Action, "instructions" | "inputs" | "defaultLocale" | "translations"> | null> {
  if (!isHash(workUID) || !Number.isSafeInteger(actionUID) || actionUID < 0) return null;
  const query = easGraphQL(/* GraphQL */ `
    query WorkActionBlock($where: AttestationWhereInput) {
      attestations(where: $where, take: 1) {
        id
        attester
        recipient
        timeCreated
        decodedDataJson
        txid
      }
    }
  `);
  const { data, error } = await reader.query(
    query,
    {
      where: {
        id: { equals: workUID },
        schemaId: { equals: getEASConfig(chainId).WORK.uid },
        revoked: { equals: false },
      },
    },
    "getActionAtWork"
  );
  if (error) throw error;
  if (!Array.isArray(data?.attestations)) throw new Error("Work history is unavailable");
  const row = data.attestations[0];
  if (!row) return null;
  const record = parseEasAttestationRecord(row);
  const work = parseDataToWork(
    record.id,
    {
      attester: record.attester,
      recipient: record.recipient,
      time: Number(record.timeCreated),
    },
    record.decodedDataJson
  );
  if (
    record.id.toLowerCase() !== workUID.toLowerCase() ||
    work.actionUID !== actionUID ||
    typeof row.txid !== "string" ||
    !isHash(row.txid)
  ) {
    throw new Error("Work history does not identify the requested action");
  }
  const receipt = await client.getTransactionReceipt({ hash: row.txid });
  if (receipt.status !== "success") throw new Error("Work transaction did not succeed");
  const eas = getEASConfig(chainId);
  const attestation = parseEventLogs({
    abi: EASABI,
    eventName: "Attested",
    logs: receipt.logs,
  }).find((log) => {
    const args = log.args as { uid?: string; schemaUID?: string };
    return (
      log.address.toLowerCase() === eas.EAS.address.toLowerCase() &&
      args.uid?.toLowerCase() === workUID.toLowerCase() &&
      args.schemaUID?.toLowerCase() === eas.WORK.uid.toLowerCase()
    );
  });
  if (!attestation || attestation.logIndex === null || receipt.blockNumber === 0n) {
    throw new Error("Work attestation position is unavailable");
  }
  const registry = getNetworkContracts(chainId).actionRegistry;
  const action = (await client.readContract({
    address: registry,
    abi: ActionRegistryABI,
    functionName: "getAction",
    args: [BigInt(actionUID)],
    blockNumber: receipt.blockNumber - 1n,
  })) as {
    title: string;
    slug: string;
    instructions: string;
  };
  const logs = await client.getLogs({ address: registry, blockHash: receipt.blockHash });
  const events = parseEventLogs({
    abi: ActionRegistryABI,
    eventName: ["ActionRegistered", "ActionTitleUpdated", "ActionInstructionsUpdated"],
    logs,
  }).sort((a, b) => (a.logIndex ?? 0) - (b.logIndex ?? 0));
  for (const event of events) {
    if (event.logIndex === null) throw new Error("Action history position is unavailable");
    if (event.logIndex >= attestation.logIndex) continue;
    const args = event.args as Record<string, unknown>;
    if (args.actionUID !== BigInt(actionUID)) continue;
    if (event.eventName === "ActionRegistered") {
      action.title = args.title as string;
      action.slug = args.slug as string;
      action.instructions = args.instructions as string;
    } else if (event.eventName === "ActionTitleUpdated") {
      action.title = args.title as string;
    } else {
      action.instructions = args.instructions as string;
    }
  }
  if (!action.instructions) return null;
  const file = await getFileByHash(action.instructions, { timeoutMs: 5_000 });
  const { config, defaultLocale, translations } = await parseInstructionMetadata(
    file.data,
    getActionInstructionFallback(action.slug),
    true
  );
  return {
    instructions: resolveIPFSUrl(action.instructions),
    inputs: config.uiConfig.details.inputs,
    defaultLocale,
    translations: markStaleActionTranslations(action.title, config, translations),
  };
}
