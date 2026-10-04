import { getEASConfig, getEasGraphqlUrl } from "@green-goods/shared/config/blockchain";
import type { PermissionModuleEntry } from "@green-goods/shared/modules/agent-reporting";
import {
  createPermissionReader,
  KERNEL_PERMISSION_ABI,
} from "@green-goods/shared/modules/agent-reporting/kernel-permissions";
import { GARDEN_ACCOUNT_ROLE_ABI } from "@green-goods/shared/utils/blockchain/abis/garden";
import {
  ActionRegistryABI,
  EASABI,
  getNetworkContracts,
} from "@green-goods/shared/utils/blockchain/contracts";
import {
  type Chain,
  ContractFunctionRevertedError,
  ContractFunctionZeroDataError,
  createPublicClient,
  decodeAbiParameters,
  decodeFunctionData,
  getAddress,
  type Hex,
  http,
  parseAbi,
  parseAbiItem,
  parseAbiParameters,
  TransactionReceiptNotFoundError,
  type Transport,
  zeroHash,
  keccak256,
} from "viem";
import type {
  AccountKind,
  Addr,
  AttestationView,
  AttestedEvent,
  PublishedWorkView,
  ReportingChain,
} from "./chain";

/**
 * Arbitrum reads for the reporting workflow through the Agent's RPC. Receipts, attestations and
 * events come from the chain itself; the EAS GraphQL index is used only to list pending work, and
 * each listed work is still decoded from its attestation data with the configured schema. Every
 * method throws on transport failure so callers can tell "unknown" from "no".
 */
const ATTESTED = parseAbiItem(
  "event Attested(address indexed recipient, address indexed attester, bytes32 uid, bytes32 indexed schemaUID)"
);
const ACCOUNT_ID_ABI = parseAbi(["function accountId() view returns (string)"]);
const META_FACTORY_ABI = parseAbi([
  "function deployWithFactory(address factory, bytes createData, bytes32 salt) payable returns (address)",
]);
/** Kernel 0.3.1 as Shared's passkey adapter deploys it: the meta factory wrapping the v3.1 factory. */
const KERNEL_META_FACTORY = "0xd703aae79538628d27099b8c4f621be4ccd142d5";
const KERNEL_FACTORY = "0xaac5d4240af87249b3f71bc8e4a2cae074a3e419";
const EIP7702_DESIGNATOR = "0xef0100";
const WORK_LIST_LIMIT = 50;
const DECISION_LIMIT = 200;

class PermissionStateUnavailableError extends Error {
  constructor() {
    super("Kernel permission state is not readable until the module compatibility gate passes");
    this.name = "PermissionStateUnavailableError";
  }
}

export interface LiveChainOptions {
  chain: Chain;
  rpcUrl: string;
  fetch?: typeof fetch;
  /** Replaces the RPC transport; tests use it to answer JSON-RPC calls directly. */
  transport?: Transport;
  delegationModules?: readonly PermissionModuleEntry[];
}

const lower = (value: string) => value.toLowerCase() as Addr;

function isRevert(error: unknown): boolean {
  const walk = (error as { walk?: (fn: (e: unknown) => boolean) => unknown }).walk;
  return Boolean(
    walk?.call(
      error,
      (inner) =>
        inner instanceof ContractFunctionRevertedError ||
        inner instanceof ContractFunctionZeroDataError
    )
  );
}

function kernelFactory(factory: string, factoryData?: Hex): boolean {
  if (factory.toLowerCase() === KERNEL_FACTORY) return true;
  if (factory.toLowerCase() !== KERNEL_META_FACTORY || !factoryData) return false;
  try {
    const { args } = decodeFunctionData({ abi: META_FACTORY_ABI, data: factoryData });
    return String(args[0]).toLowerCase() === KERNEL_FACTORY;
  } catch {
    return false;
  }
}

export function createLiveReportingChain(options: LiveChainOptions): ReportingChain {
  const client = createPublicClient({
    chain: options.chain,
    transport: options.transport ?? http(options.rpcUrl),
  });
  const request = options.fetch ?? fetch;
  const eas = (chainId: number) => getEASConfig(chainId);

  async function decodeWork(chainId: number, uid: Hex): Promise<PublishedWorkView | null> {
    const attestation = await readAttestation(chainId, uid);
    if (!attestation || attestation.schema.toLowerCase() !== eas(chainId).WORK.uid.toLowerCase())
      return null;
    const [actionUID, title, feedback, , media] = decodeAbiParameters(
      parseAbiParameters(eas(chainId).WORK.schema),
      attestation.data
    ) as readonly [bigint, string, string, string, readonly string[]];
    return {
      workUID: uid,
      gardenAddress: attestation.recipient,
      gardenerAddress: attestation.attester,
      actionUID: Number(actionUID),
      title,
      feedback,
      mediaCids: [...media],
    };
  }

  async function readAttestation(chainId: number, uid: Hex): Promise<AttestationView | null> {
    const result = (await client.readContract({
      address: eas(chainId).EAS.address as Addr,
      abi: EASABI,
      functionName: "getAttestation",
      args: [uid],
    })) as {
      uid: Hex;
      schema: Hex;
      recipient: Addr;
      attester: Addr;
      expirationTime: bigint;
      revocable: boolean;
      refUID: Hex;
      data: Hex;
      revocationTime: bigint;
    };
    if (!result || result.uid === zeroHash || result.revocationTime > 0n) return null;
    return {
      uid: result.uid,
      schema: result.schema,
      recipient: lower(result.recipient),
      attester: lower(result.attester),
      expirationTime: result.expirationTime,
      revocable: result.revocable,
      refUID: result.refUID,
      data: result.data,
    };
  }

  async function graphql<T>(chainId: number, query: string, variables: object): Promise<T> {
    const response = await request(getEasGraphqlUrl(chainId), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error(`EAS index returned ${response.status}`);
    const body = (await response.json()) as { data?: T; errors?: unknown };
    if (!body.data || body.errors) throw new Error("EAS index query failed");
    return body.data;
  }

  return {
    async gardenRoles(_chainId, garden, account) {
      const [gardener, operator, owner] = await client.multicall({
        allowFailure: false,
        contracts: (["isGardener", "isOperator", "isOwner"] as const).map((functionName) => ({
          address: garden as Addr,
          abi: GARDEN_ACCOUNT_ROLE_ABI,
          functionName,
          args: [account as Addr],
        })),
      });
      return { gardener: Boolean(gardener), operator: Boolean(operator), owner: Boolean(owner) };
    },

    async gardenDomainMask(chainId, garden) {
      const registry = getNetworkContracts(chainId).actionRegistry as Addr;
      const mask = await client.readContract({
        address: registry,
        abi: ActionRegistryABI,
        functionName: "gardenDomains",
        args: [garden as Addr],
      });
      return Number(mask);
    },

    async accountKind(_chainId, account, factory, factoryData): Promise<AccountKind> {
      const code = await client.getCode({ address: account as Addr });
      if (!code || code === "0x") {
        if (!factory) return "eoa";
        return kernelFactory(factory, factoryData) ? "kernel" : "unsupported";
      }
      // Delegated EOAs (EIP-7702) are outside this prototype.
      if (code.toLowerCase().startsWith(EIP7702_DESIGNATOR)) return "unsupported";
      try {
        const id = await client.readContract({
          address: account as Addr,
          abi: ACCOUNT_ID_ABI,
          functionName: "accountId",
        });
        return id.startsWith("kernel.") ? "kernel" : "unsupported";
      } catch (error) {
        if (isRevert(error)) return "unsupported";
        throw error;
      }
    },

    async blockNumber() {
      return client.getBlockNumber();
    },

    async transactionReceipt(_chainId, hash) {
      try {
        const receipt = await client.getTransactionReceipt({ hash });
        return {
          transactionHash: receipt.transactionHash,
          blockHash: receipt.blockHash,
          blockNumber: receipt.blockNumber,
          status: receipt.status,
          logs: receipt.logs.map((log) => ({
            address: lower(log.address),
            topics: log.topics as readonly Hex[],
            data: log.data,
            logIndex: log.logIndex ?? 0,
          })),
        };
      } catch (error) {
        if (error instanceof TransactionReceiptNotFoundError) return null;
        throw error;
      }
    },

    attestation: readAttestation,

    async attestedEvents(_chainId, filter): Promise<AttestedEvent[]> {
      const logs = await client.getLogs({
        address: filter.eas,
        event: ATTESTED,
        args: {
          recipient: filter.recipient,
          attester: filter.attester,
          schemaUID: filter.schemaUID,
        },
        fromBlock: filter.fromBlock,
        toBlock: filter.toBlock,
        strict: true,
      });
      return logs.map((log) => ({
        uid: log.args.uid as Hex,
        recipient: lower(log.args.recipient as string),
        attester: lower(log.args.attester as string),
        schemaUID: log.args.schemaUID as Hex,
        transactionHash: log.transactionHash as Hex,
        blockHash: log.blockHash as Hex,
        blockNumber: log.blockNumber as bigint,
        logIndex: log.logIndex as number,
      }));
    },

    async pendingWork(chainId, garden) {
      const recipient = getAddress(garden);
      const data = await graphql<{
        works: Array<{ id: Hex }>;
        decisions: Array<{ data: Hex }>;
      }>(
        chainId,
        `query Pending($work: String!, $decision: String!, $garden: String!, $take: Int!, $decisions: Int!) {
          works: attestations(where: { schemaId: { equals: $work }, recipient: { equals: $garden }, revoked: { equals: false } },
            orderBy: [{ timeCreated: desc }, { id: asc }], take: $take) { id }
          decisions: attestations(where: { schemaId: { equals: $decision }, recipient: { equals: $garden }, revoked: { equals: false } },
            orderBy: [{ timeCreated: desc }, { id: asc }], take: $decisions) { data }
        }`,
        {
          work: eas(chainId).WORK.uid,
          decision: eas(chainId).WORK_APPROVAL.uid,
          garden: recipient,
          take: WORK_LIST_LIMIT,
          decisions: DECISION_LIMIT,
        }
      );
      const decided = new Set(
        data.decisions.map((decision) => {
          const [, workUID] = decodeAbiParameters(
            parseAbiParameters(eas(chainId).WORK_APPROVAL.schema),
            decision.data
          );
          return String(workUID).toLowerCase();
        })
      );
      const pending = data.works.filter((work) => !decided.has(work.id.toLowerCase()));
      const works = await Promise.all(pending.map((work) => decodeWork(chainId, work.id)));
      return works.filter((work): work is PublishedWorkView => work !== null);
    },

    work: decodeWork,

    async permissionInstalled(chainId, account, permissionId) {
      const module = options.delegationModules?.find((entry) => entry.chainId === chainId);
      if (!module?.singleCallPolicy || !module.singleCallPolicyCodeHash)
        throw new PermissionStateUnavailableError();
      const reader = createPermissionReader(
        client as unknown as Parameters<typeof createPermissionReader>[0]
      );
      await reader.assertKernel(account as Addr);
      const view = await reader.permission(account as Addr, permissionId);
      if (
        !view.active ||
        view.signerAddress.toLowerCase() !== module.validatorAddress.toLowerCase()
      )
        return false;
      const guardCode = await client.getCode({ address: module.singleCallPolicy });
      const signerCode = await client.getCode({ address: module.validatorAddress });
      if (
        !guardCode ||
        !signerCode ||
        keccak256(guardCode) !== module.singleCallPolicyCodeHash ||
        keccak256(signerCode) !== module.validatorCodeHash
      )
        throw new PermissionStateUnavailableError();
      const config = await client.readContract({
        address: account as Addr,
        abi: KERNEL_PERMISSION_ABI,
        functionName: "permissionConfig",
        args: [permissionId],
      });
      return config.policyData.some(
        (policy) =>
          `0x${policy.slice(-40)}`.toLowerCase() === module.singleCallPolicy?.toLowerCase()
      );
    },
  };
}
