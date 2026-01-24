/**
 * Type-safe Contract Interaction Helpers
 *
 * Provides typed wrappers around Green Goods smart contract interactions
 * for use in integration tests with Anvil fork.
 *
 * Note: These helpers are designed for integration testing with Anvil.
 * Some type assertions are used to work around strict viem typing.
 */

import {
  type PublicClient,
  type WalletClient,
  getContract,
  encodeAbiParameters,
  parseAbiParameters,
  type Log,
} from "viem";
import type { AnvilForkContext, DeploymentArtifact, TestAccountWithSigner } from "./anvil-fork";

// Type helper for log with topics
type LogWithTopics = Log & { topics: readonly `0x${string}`[] };

// ============================================================================
// ABI DEFINITIONS (Minimal ABIs for testing)
// ============================================================================

/**
 * Minimal GardenToken ABI for minting gardens
 */
const GardenTokenABI = [
  {
    name: "mintGarden",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "config",
        type: "tuple",
        components: [
          { name: "communityToken", type: "address" },
          { name: "name", type: "string" },
          { name: "description", type: "string" },
          { name: "location", type: "string" },
          { name: "bannerImage", type: "string" },
          { name: "metadata", type: "string" },
          { name: "openJoining", type: "bool" },
          { name: "gardeners", type: "address[]" },
          { name: "gardenOperators", type: "address[]" },
        ],
      },
    ],
    outputs: [{ type: "address" }],
  },
  {
    name: "ownerOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

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
 * Minimal GardenAccount ABI for garden operations
 */
const GardenAccountABI = [
  {
    name: "addGardener",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "gardener", type: "address" }],
    outputs: [],
  },
  {
    name: "removeGardener",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "gardener", type: "address" }],
    outputs: [],
  },
  {
    name: "isGardener",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    name: "isOperator",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    name: "getGardeners",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address[]" }],
  },
  {
    name: "getOperators",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address[]" }],
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
  communityToken: `0x${string}`;
  name: string;
  description: string;
  location: string;
  bannerImage: string;
  metadata?: string;
  openJoining?: boolean;
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

/**
 * Get the GardenToken contract instance
 */
export function getGardenTokenContract(
  deployment: DeploymentArtifact,
  publicClient: PublicClient,
  walletClient?: WalletClient
) {
  return getContract({
    address: deployment.gardenToken,
    abi: GardenTokenABI,
    client: walletClient ?? publicClient,
  });
}

/**
 * Get the ActionRegistry contract instance
 */
export function getActionRegistryContract(
  deployment: DeploymentArtifact,
  publicClient: PublicClient,
  walletClient?: WalletClient
) {
  return getContract({
    address: deployment.actionRegistry,
    abi: ActionRegistryABI,
    client: walletClient ?? publicClient,
  });
}

/**
 * Get a GardenAccount contract instance
 */
export function getGardenAccountContract(
  gardenAddress: `0x${string}`,
  publicClient: PublicClient,
  walletClient?: WalletClient
) {
  return getContract({
    address: gardenAddress,
    abi: GardenAccountABI,
    client: walletClient ?? publicClient,
  });
}

/**
 * Get the EAS contract instance
 */
export function getEASContract(
  deployment: DeploymentArtifact,
  publicClient: PublicClient,
  walletClient?: WalletClient
) {
  return getContract({
    address: deployment.eas.address,
    abi: EASABI,
    client: walletClient ?? publicClient,
  });
}

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

  const config = {
    communityToken: params.communityToken,
    name: params.name,
    description: params.description,
    location: params.location,
    bannerImage: params.bannerImage,
    metadata: params.metadata ?? "",
    openJoining: params.openJoining ?? true,
    gardeners: params.gardeners ?? [],
    gardenOperators: params.operators ?? [account.address],
  };

  const txHash = await context.walletClient.writeContract({
    chain: context.chain,
    address: context.deployment.gardenToken,
    abi: GardenTokenABI,
    functionName: "mintGarden",
    args: [config],
    account: account.account,
  });

  // Wait for transaction
  const receipt = await context.publicClient.waitForTransactionReceipt({ hash: txHash });

  // Get the garden address from the first log (the GardenMinted event)
  // In a real implementation, you'd parse the event logs properly
  const logs = receipt.logs as LogWithTopics[];
  const gardenAddress = logs[0]?.address as `0x${string}`;

  await context.testClient.stopImpersonatingAccount({ address: account.address });

  console.log(`  🌱 Garden created: ${params.name} at ${gardenAddress}`);

  return {
    address: gardenAddress,
    tokenId: BigInt(0), // Would be parsed from event
    name: params.name,
    txHash,
  };
}

/**
 * Add a gardener to a garden
 *
 * @param context - Anvil fork context
 * @param gardenAddress - Garden account address
 * @param gardenerAddress - Address to add as gardener
 * @param operatorAccount - Operator account to sign transaction
 */
export async function addGardener(
  context: AnvilForkContext,
  gardenAddress: `0x${string}`,
  gardenerAddress: `0x${string}`,
  operatorAccount?: TestAccountWithSigner
): Promise<`0x${string}`> {
  const account = operatorAccount ?? context.accounts.operator;

  await context.testClient.impersonateAccount({ address: account.address });

  const txHash = await context.walletClient.writeContract({
    chain: context.chain,
    address: gardenAddress,
    abi: GardenAccountABI,
    functionName: "addGardener",
    args: [gardenerAddress],
    account: account.account,
  });

  await context.publicClient.waitForTransactionReceipt({ hash: txHash });
  await context.testClient.stopImpersonatingAccount({ address: account.address });

  console.log(`  👤 Added gardener ${gardenerAddress} to garden ${gardenAddress}`);

  return txHash;
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
 * Deploy a mock ERC20 token for testing
 * (Used as communityToken when creating gardens)
 */
export async function deployMockERC20(
  context: AnvilForkContext,
  _name: string = "Test Token",
  _symbol: string = "TEST"
): Promise<`0x${string}`> {
  // In a forked environment, we can use an existing ERC20 or deploy a mock
  // For simplicity, we'll use USDC on Base Sepolia if available
  // Or you could deploy a mock contract here

  // Base Sepolia USDC address (if it exists)
  const MOCK_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as `0x${string}`;

  // Verify it's a contract
  const code = await context.publicClient.getCode({ address: MOCK_USDC });
  if (code && code !== "0x") {
    console.log(`  💰 Using existing token at ${MOCK_USDC}`);
    return MOCK_USDC;
  }

  // If no USDC, we'd need to deploy a mock
  throw new Error("Mock ERC20 deployment not implemented - use an existing token on the fork");
}

/**
 * Get the current block timestamp
 */
export async function getBlockTimestamp(context: AnvilForkContext): Promise<bigint> {
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
