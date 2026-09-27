import { isHash, type PublicClient } from "viem";
import { getEASConfig } from "../../config/blockchain";
import type { Action } from "../../types/domain";
import { markStaleActionTranslations } from "../../utils/action/translations";
import {
  ActionRegistryABI,
  createClients,
  getNetworkContracts,
} from "../../utils/blockchain/contracts";
import { parseDataToWork, parseEasAttestationRecord } from "./eas-parse";
import { easGraphQL } from "./graphql";
import { createEasClient, type GraphQLReader } from "./graphql-client";
import { getActionInstructionFallback, parseInstructionMetadata } from "./greengoods";
import { getFileByHash, resolveIPFSUrl } from "./ipfs/resolve";

type HistoricalClient = Pick<PublicClient, "getTransactionReceipt" | "readContract">;

/** Read the immutable instruction CID at the Work's submission block, never the current row. */
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
  const action = (await client.readContract({
    address: getNetworkContracts(chainId).actionRegistry,
    abi: ActionRegistryABI,
    functionName: "getAction",
    args: [BigInt(actionUID)],
    blockNumber: receipt.blockNumber,
  })) as {
    title: string;
    slug: string;
    instructions: string;
  };
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
