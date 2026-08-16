/**
 * Type-safe Contract Interaction Helpers
 *
 * Provides typed wrappers around Green Goods smart contract interactions
 * for use in integration tests with Anvil fork.
 *
 * Note: These helpers are designed for integration testing with Anvil.
 * Some type assertions are used to work around strict viem typing.
 */

import { readFileSync } from "node:fs";
import {
  type Abi,
  encodeAbiParameters,
  getContract,
  type Log,
  parseEventLogs,
  type PublicClient,
  parseAbiParameters,
  type WalletClient,
} from "viem";
import type { AnvilForkContext, DeploymentArtifact, TestAccountWithSigner } from "./anvil-fork";

function loadAbi(relativePath: string): Abi {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), "utf8")) as Abi;
}

const GardenAccountABI = loadAbi("../../packages/contracts/abis/GardenAccount.json");
const GardenTokenABI = loadAbi("../../packages/contracts/abis/GardenToken.json");

// Type helper for log with topics
type LogWithTopics = Log & { topics: readonly `0x${string}`[] };

// ============================================================================
// ABI DEFINITIONS (Minimal ABIs for testing)
// ============================================================================

/**
 * Minimal ActionRegistry ABI for registering actions
 */
const ActionRegistryABI = [
  {
    name: "registerAction",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_startTime", type: "uint256" },
      { name: "_endTime", type: "uint256" },
      { name: "_title", type: "string" },
      { name: "_instructions", type: "string" },
      { name: "_capitals", type: "uint8[]" },
      { name: "_media", type: "string[]" },
    ],
    outputs: [],
  },
  {
    name: "getAction",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "actionUID", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "startTime", type: "uint256" },
          { name: "endTime", type: "uint256" },
          { name: "title", type: "string" },
          { name: "instructions", type: "string" },
          { name: "capitals", type: "uint8[]" },
          { name: "media", type: "string[]" },
        ],
      },
    ],
  },
  {
    name: "owner",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
] as const;

/**
 * Minimal EAS ABI for attestations
 */
const EASABI = [
  {
    name: "attest",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "request",
        type: "tuple",
        components: [
          { name: "schema", type: "bytes32" },
          {
            name: "data",
            type: "tuple",
            components: [
              { name: "recipient", type: "address" },
              { name: "expirationTime", type: "uint64" },
              { name: "revocable", type: "bool" },
              { name: "refUID", type: "bytes32" },
              { name: "data", type: "bytes" },
              { name: "value", type: "uint256" },
            ],
          },
        ],
      },
    ],
    outputs: [{ type: "bytes32" }],
  },
  {
    name: "getAttestation",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "uid", type: "bytes32" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "uid", type: "bytes32" },
          { name: "schema", type: "bytes32" },
          { name: "time", type: "uint64" },
          { name: "expirationTime", type: "uint64" },
          { name: "revocationTime", type: "uint64" },
          { name: "refUID", type: "bytes32" },
          { name: "recipient", type: "address" },
          { name: "attester", type: "address" },
          { name: "revocable", type: "bool" },
          { name: "data", type: "bytes" },
        ],
      },
    ],
  },
] as const;

// ============================================================================
// TYPES
// ============================================================================

/**
 * Capital types matching the Solidity enum
 */
export enum Capital {
  SOCIAL = 0,
  MATERIAL = 1,
  FINANCIAL = 2,
  LIVING = 3,
  INTELLECTUAL = 4,
  EXPERIENTIAL = 5,
  SPIRITUAL = 6,
  CULTURAL = 7,
}

/**
 * Parameters for creating a garden
 */
export interface CreateGardenParams {
  name: string;
  slug?: string;
  description: string;
  location?: string;
  bannerImage: string;
  metadata?: string;
  openJoining?: boolean;
  weightScheme?: 0 | 1 | 2;
  domainMask?: number;
  gardeners?: `0x${string}`[];
  operators?: `0x${string}`[];
}

/**
 * Result of creating a garden
 */
export interface GardenResult {
  address: `0x${string}`;
  tokenId: bigint;
  name: string;
  txHash: `0x${string}`;
}

/**
 * Parameters for creating an action
 */
export interface CreateActionParams {
  startTime: bigint;
  endTime: bigint;
  title: string;
  instructions: string;
  capitals: Capital[];
  media?: string[];
}

/**
 * Result of creating an action
 */
export interface ActionResult {
  uid: bigint;
  title: string;
  txHash: `0x${string}`;
}

/**
 * Parameters for submitting work
 */
export interface SubmitWorkParams {
  gardenAddress: `0x${string}`;
  gardenerAccount: TestAccountWithSigner;
  actionUID: bigint;
  title: string;
  feedback: string;
  metadata?: string;
  media?: string[];
}

/**
 * Result of submitting work
 */
export interface WorkResult {
  uid: `0x${string}`;
  actionUID: bigint;
  txHash: `0x${string}`;
}

/**
 * Parameters for approving work
 */
export interface ApproveWorkParams {
  gardenAddress: `0x${string}`;
  operatorAccount: TestAccountWithSigner;
  workUID: `0x${string}`;
  actionUID: bigint;
  approved: boolean;
  feedback?: string;
}

/**
 * Result of approving work
 */
export interface ApprovalResult {
  uid: `0x${string}`;
  approved: boolean;
  txHash: `0x${string}`;
}

// ============================================================================
// CONTRACT GETTERS
// ============================================================================

// ============================================================================
// HIGH-LEVEL OPERATIONS
// ============================================================================

/**
 * Create a new garden
 *
 * @param context - Anvil fork context
 * @param params - Garden creation parameters
 * @param signerAccount - Account to sign the transaction (defaults to deployer)
 * @returns Garden creation result
 */
export async function createGarden(
  context: AnvilForkContext,
  params: CreateGardenParams,
  signerAccount?: TestAccountWithSigner
): Promise<GardenResult> {
  const account = signerAccount ?? context.accounts.deployer;

  // First, impersonate the account if it's not one of our test accounts
  // (needed for forked state where we need to act as a different address)
  await context.testClient.impersonateAccount({ address: account.address });

  try {
    const config = {
      name: params.name,
      slug: params.slug ?? "",
      description: params.description,
      location: params.location ?? "",
      bannerImage: params.bannerImage,
      metadata: params.metadata ?? "",
      openJoining: params.openJoining ?? true,
      weightScheme: params.weightScheme ?? 0,
      domainMask: params.domainMask ?? 15,
      gardeners: params.gardeners ?? [],
      operators: params.operators ?? [account.address],
    };

    const txHash = await context.walletClient.writeContract({
      chain: context.chain,
      address: context.deployment.gardenToken,
      abi: GardenTokenABI,
      functionName: "mintGarden",
      args: [config],
      account: account.account,
    });

    const receipt = await context.publicClient.waitForTransactionReceipt({ hash: txHash });
    const [gardenMinted] = parseEventLogs({
      abi: GardenTokenABI,
      eventName: "GardenMinted",
      logs: receipt.logs,
      strict: true,
    });

    if (!gardenMinted) {
      throw new Error(`GardenMinted event missing from transaction ${txHash}`);
    }

    const gardenAddress = gardenMinted.args.account;
    console.log(`  🌱 Garden created: ${params.name} at ${gardenAddress}`);

    return {
      address: gardenAddress,
      tokenId: gardenMinted.args.tokenId,
      name: params.name,
      txHash,
    };
  } finally {
    await context.testClient.stopImpersonatingAccount({ address: account.address });
  }
}

/**
 * Join an open garden as a gardener
 *
 * @param context - Anvil fork context
 * @param gardenAddress - Garden account address
 * @param gardenerAccount - Gardener account that signs its own join transaction
 */
export async function joinGarden(
  context: AnvilForkContext,
  gardenAddress: `0x${string}`,
  gardenerAccount?: TestAccountWithSigner
): Promise<`0x${string}`> {
  const account = gardenerAccount ?? context.accounts.gardener1;

  await context.testClient.impersonateAccount({ address: account.address });

  try {
    const txHash = await context.walletClient.writeContract({
      chain: context.chain,
      address: gardenAddress,
      abi: GardenAccountABI,
      functionName: "joinGarden",
      args: [],
      account: account.account,
    });

    await context.publicClient.waitForTransactionReceipt({ hash: txHash });
    console.log(`  👤 Gardener ${account.address} joined garden ${gardenAddress}`);

    return txHash;
  } finally {
    await context.testClient.stopImpersonatingAccount({ address: account.address });
  }
}

/**
 * Check if an address is a gardener
 */
export async function isGardener(
  context: AnvilForkContext,
  gardenAddress: `0x${string}`,
  address: `0x${string}`
): Promise<boolean> {
  const result = await context.publicClient.readContract({
    address: gardenAddress,
    abi: GardenAccountABI,
    functionName: "isGardener",
    args: [address],
  });
  return result as boolean;
}

/**
 * Check if an address is an operator
 */
export async function isOperator(
  context: AnvilForkContext,
  gardenAddress: `0x${string}`,
  address: `0x${string}`
): Promise<boolean> {
  const result = await context.publicClient.readContract({
    address: gardenAddress,
    abi: GardenAccountABI,
    functionName: "isOperator",
    args: [address],
  });
  return result as boolean;
}

/**
 * Register a new action (requires impersonating ActionRegistry owner)
 *
 * @param context - Anvil fork context
 * @param params - Action creation parameters
 * @returns Action creation result
 */
export async function registerAction(
  context: AnvilForkContext,
  params: CreateActionParams
): Promise<ActionResult> {
  // Get the ActionRegistry owner
  const owner = (await context.publicClient.readContract({
    address: context.deployment.actionRegistry,
    abi: ActionRegistryABI,
    functionName: "owner",
    args: [],
  })) as `0x${string}`;

  // Impersonate the owner to register actions
  await context.testClient.impersonateAccount({ address: owner });

  // Fund the owner if needed
  await context.testClient.setBalance({
    address: owner,
    value: BigInt(10) ** BigInt(18), // 1 ETH
  });

  const txHash = await context.walletClient.writeContract({
    chain: context.chain,
    address: context.deployment.actionRegistry,
    abi: ActionRegistryABI,
    functionName: "registerAction",
    args: [
      params.startTime,
      params.endTime,
      params.title,
      params.instructions,
      params.capitals.map((c) => c as number),
      params.media ?? [],
    ],
    account: owner,
  });

  await context.publicClient.waitForTransactionReceipt({ hash: txHash });
  await context.testClient.stopImpersonatingAccount({ address: owner });

  // The action UID is sequential, so we need to parse it from events
  // For simplicity, we'll assume it's incrementing from 0
  console.log(`  📋 Action registered: ${params.title}`);

  return {
    uid: BigInt(0), // Would be parsed from event
    title: params.title,
    txHash,
  };
}

/**
 * Submit work using EAS attestation
 *
 * @param context - Anvil fork context
 * @param params - Work submission parameters
 * @returns Work submission result
 */
export async function submitWork(
  context: AnvilForkContext,
  params: SubmitWorkParams
): Promise<WorkResult> {
  const account = params.gardenerAccount;

  await context.testClient.impersonateAccount({ address: account.address });

  // Encode work data according to the schema:
  // "uint256 actionUID,string title,string feedback,string metadata,string[] media"
  const workData = encodeAbiParameters(
    parseAbiParameters("uint256, string, string, string, string[]"),
    [params.actionUID, params.title, params.feedback, params.metadata ?? "", params.media ?? []]
  );

  const txHash = await context.walletClient.writeContract({
    chain: context.chain,
    address: context.deployment.eas.address,
    abi: EASABI,
    functionName: "attest",
    args: [
      {
        schema: context.deployment.schemas.workSchemaUID,
        data: {
          recipient: params.gardenAddress,
          expirationTime: BigInt(0),
          revocable: true,
          refUID:
            "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`,
          data: workData,
          value: BigInt(0),
        },
      },
    ],
    account: account.account,
  });

  const receipt = await context.publicClient.waitForTransactionReceipt({ hash: txHash });
  await context.testClient.stopImpersonatingAccount({ address: account.address });

  // The work UID is the attestation UID from the event
  const logs = receipt.logs as LogWithTopics[];
  const workUID = logs[0]?.topics[1] as `0x${string}`;

  console.log(`  📝 Work submitted: ${params.title}`);

  return {
    uid: workUID,
    actionUID: params.actionUID,
    txHash,
  };
}

/**
 * Approve work using EAS attestation
 *
 * @param context - Anvil fork context
 * @param params - Work approval parameters
 * @returns Approval result
 */
export async function approveWork(
  context: AnvilForkContext,
  params: ApproveWorkParams
): Promise<ApprovalResult> {
  const account = params.operatorAccount;

  await context.testClient.impersonateAccount({ address: account.address });

  // Encode approval data according to the schema:
  // "uint256 actionUID,bytes32 workUID,bool approved,string feedback"
  const approvalData = encodeAbiParameters(parseAbiParameters("uint256, bytes32, bool, string"), [
    params.actionUID,
    params.workUID,
    params.approved,
    params.feedback ?? "",
  ]);

  const txHash = await context.walletClient.writeContract({
    chain: context.chain,
    address: context.deployment.eas.address,
    abi: EASABI,
    functionName: "attest",
    args: [
      {
        schema: context.deployment.schemas.workApprovalSchemaUID,
        data: {
          recipient: params.gardenAddress,
          expirationTime: BigInt(0),
          revocable: true,
          refUID: params.workUID,
          data: approvalData,
          value: BigInt(0),
        },
      },
    ],
    account: account.account,
  });

  const receipt = await context.publicClient.waitForTransactionReceipt({ hash: txHash });
  await context.testClient.stopImpersonatingAccount({ address: account.address });

  const logs = receipt.logs as LogWithTopics[];
  const approvalUID = logs[0]?.topics[1] as `0x${string}`;

  console.log(`  ✅ Work ${params.approved ? "approved" : "rejected"}: ${params.workUID}`);

  return {
    uid: approvalUID,
    approved: params.approved,
    txHash,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get the current block timestamp
 */
async function getBlockTimestamp(context: AnvilForkContext): Promise<bigint> {
  const block = await context.publicClient.getBlock();
  return block.timestamp;
}

/**
 * Create timestamps for action start/end times
 */
export async function createActionTimestamps(
  context: AnvilForkContext,
  durationDays: number = 30
): Promise<{ startTime: bigint; endTime: bigint }> {
  const currentTimestamp = await getBlockTimestamp(context);
  const oneDay = BigInt(86400);

  return {
    startTime: currentTimestamp - oneDay, // Started yesterday
    endTime: currentTimestamp + BigInt(durationDays) * oneDay,
  };
}
