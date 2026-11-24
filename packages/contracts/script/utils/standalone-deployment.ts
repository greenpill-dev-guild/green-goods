import { getAddress, getCreateAddress, keccak256, type Provider } from "ethers";
import { CHAIN_ID_MAP } from "./network";

/**
 * A contract deployed on its own by a plain CREATE: no constructor arguments, no linked libraries,
 * no immutables and no authority to hand over. Everything that differs between such contracts is
 * named here; the plan, simulation, journal and verification machinery is shared.
 */
export interface StandaloneContract {
  /** Lowercase noun the operator reads in messages, e.g. "policy". */
  noun: string;
  /** Forge target, `<source path>:<contract name>`. */
  target: string;
  /** Deploy script contract, at `script/<script>.s.sol`. */
  script: string;
  /** Prefix of the deploy script's env pins and of the plan, deployment and broadcast kinds. */
  id: string;
  /** File stem of the plan, journal and `deployments/<chainId>-<slug>.json`. */
  slug: string;
  /** Contract-specific files a broadcast requires committed, besides the shared machinery. */
  sources: readonly string[];
  /** How a localhost broadcast signs: the deployer keystore, or the local node's unlocked account. */
  localhostSigner: "keystore" | "unlocked";
  /**
   * Top-level keys a verified deployment is promoted to in `deployments/<chainId>-latest.json`:
   * its address, and the block its CREATE was mined in, where readers start scanning its logs.
   */
  latest?: { address: string; deployBlock: string };
  /** Throws unless the live code answers this contract's ABI; `call` reads the deployed address. */
  assertAbi(call: (data: string) => Promise<string>): Promise<void>;
}

export const STANDALONE_NETWORKS = ["arbitrum", "sepolia", "localhost"];
const HEX = /^0x(?:[0-9a-fA-F]{2})+$/u;
const HASH = /^0x[0-9a-fA-F]{64}$/u;

export function capitalized(noun: string): string {
  return `${noun.charAt(0).toUpperCase()}${noun.slice(1)}`;
}

/** The contract name Forge records, the part of the target after the colon. */
export function contractName(contract: Pick<StandaloneContract, "target">): string {
  return contract.target.slice(contract.target.indexOf(":") + 1);
}

export interface StandaloneBytecode {
  creationCode: string;
  runtimeCode: string;
}
export interface StandaloneDeploymentPlan {
  schemaVersion: 1;
  kind: string;
  network: string;
  chainId: number;
  commit: string;
  deployer: string;
  nonce: number;
  address: string;
  target: string;
  creationCode: string;
  creationCodeHash: string;
  runtimeCodeHash: string;
  generatedAt: string;
  authorityEnabled: false;
}
export interface StandaloneDeploymentArtifact {
  schemaVersion: 1;
  kind: string;
  network: string;
  chainId: number;
  address: string;
  runtimeCodeHash: string;
  creationCodeHash: string;
  transactionHash: string;
  blockNumber: number;
  blockHash: string;
  deployer: string;
  nonce: number;
  commit: string;
  verifiedAt: string;
}

/** Linked, immutable-free production bytecode only; arbitrary constructor input is unsupported. */
export function standaloneBytecode(contract: StandaloneContract, artifact: unknown): StandaloneBytecode {
  const a = artifact as {
    bytecode?: { object?: string; linkReferences?: object };
    deployedBytecode?: { object?: string; immutableReferences?: object };
  } | null;
  const creationCode = a?.bytecode?.object;
  const runtimeCode = a?.deployedBytecode?.object;
  if (
    !creationCode ||
    !runtimeCode ||
    !HEX.test(creationCode) ||
    !HEX.test(runtimeCode) ||
    Object.keys(a?.bytecode?.linkReferences ?? {}).length ||
    Object.keys(a?.deployedBytecode?.immutableReferences ?? {}).length
  ) {
    throw new Error(`${capitalized(contract.noun)} requires nonempty linked bytecode without immutable substitutions`);
  }
  return { creationCode, runtimeCode };
}

export function standaloneDeploymentPlan(
  contract: StandaloneContract,
  input: StandaloneBytecode & { network: string; chainId: number; sender: string; nonce: number; commit: string },
): StandaloneDeploymentPlan {
  const Noun = capitalized(contract.noun);
  if (!STANDALONE_NETWORKS.includes(input.network) || Number(CHAIN_ID_MAP[input.network]) !== input.chainId)
    throw new Error(`${Noun} deployment network/chain mismatch`);
  if (
    !Number.isSafeInteger(input.nonce) ||
    input.nonce < 0 ||
    !/^[0-9a-f]{40}$/iu.test(input.commit) ||
    !HEX.test(input.creationCode) ||
    !HEX.test(input.runtimeCode)
  )
    throw new Error(`Invalid ${contract.noun} deployment inputs`);
  const deployer = getAddress(input.sender);
  if (/^0x0{40}$/iu.test(deployer)) throw new Error(`${Noun} deployment sender is zero`);
  return {
    schemaVersion: 1,
    kind: `${contract.id}_PLAN`,
    network: input.network,
    chainId: input.chainId,
    commit: input.commit,
    deployer,
    nonce: input.nonce,
    address: getCreateAddress({ from: deployer, nonce: input.nonce }),
    target: contract.target,
    creationCode: input.creationCode,
    creationCodeHash: keccak256(input.creationCode),
    runtimeCodeHash: keccak256(input.runtimeCode),
    generatedAt: new Date().toISOString(),
    authorityEnabled: false,
  };
}

/** No signer is touched until the exact reviewed bytecode, commit, chain, nonce and address match. */
export function assertStandalonePlan(
  contract: StandaloneContract,
  plan: StandaloneDeploymentPlan,
  expected: { network: string; chainId: number; commit: string; bytecode: StandaloneBytecode; nonce?: number },
): void {
  const rebuilt = standaloneDeploymentPlan(contract, {
    ...expected.bytecode,
    network: expected.network,
    chainId: expected.chainId,
    sender: plan.deployer,
    nonce: plan.nonce,
    commit: expected.commit,
  });
  if (
    plan.schemaVersion !== 1 ||
    plan.kind !== rebuilt.kind ||
    plan.target !== contract.target ||
    plan.authorityEnabled !== false ||
    plan.network !== rebuilt.network ||
    plan.chainId !== rebuilt.chainId ||
    plan.commit !== rebuilt.commit ||
    plan.address !== rebuilt.address ||
    plan.creationCode !== rebuilt.creationCode ||
    plan.creationCodeHash !== rebuilt.creationCodeHash ||
    plan.runtimeCodeHash !== rebuilt.runtimeCodeHash ||
    (expected.nonce !== undefined && plan.nonce !== expected.nonce)
  )
    throw new Error(`${capitalized(contract.noun)} plan differs from reviewed deployment inputs`);
}

export async function assertStandaloneChain(
  contract: StandaloneContract,
  provider: Pick<
    Provider,
    "getNetwork" | "getTransactionCount" | "getCode" | "estimateGas" | "getFeeData" | "getBalance"
  >,
  plan: StandaloneDeploymentPlan,
): Promise<{ gasEstimate: string; maxCostWei: string }> {
  const Noun = capitalized(contract.noun);
  if (Number((await provider.getNetwork()).chainId) !== plan.chainId)
    throw new Error(`RPC chain does not match the ${contract.noun} plan`);
  const [latest, pending, code] = await Promise.all([
    provider.getTransactionCount(plan.deployer, "latest"),
    provider.getTransactionCount(plan.deployer, "pending"),
    provider.getCode(plan.address),
  ]);
  if (latest !== plan.nonce || pending !== plan.nonce)
    throw new Error(`${Noun} deployer nonce changed or has pending transactions`);
  if (code !== "0x") throw new Error(`${Noun} deployment address already has code`);
  const [gas, fees, balance] = await Promise.all([
    provider.estimateGas({ from: plan.deployer, data: plan.creationCode, value: 0n }),
    provider.getFeeData(),
    provider.getBalance(plan.deployer),
  ]);
  const fee = fees.maxFeePerGas ?? fees.gasPrice;
  const gasLimit = (gas * 130n + 99n) / 100n;
  if (gas <= 0n || fee === null || fee <= 0n || balance < gasLimit * fee)
    throw new Error(`${Noun} deployer is unfunded for the estimated deployment cost`);
  return { gasEstimate: gasLimit.toString(), maxCostWei: (gasLimit * fee).toString() };
}

/** Confirm CREATE provenance and exact live bytes before publishing any deployment pin. */
export async function verifyStandaloneDeployment(
  contract: StandaloneContract,
  provider: Pick<Provider, "getNetwork" | "getTransaction" | "getTransactionReceipt" | "getCode" | "call">,
  plan: StandaloneDeploymentPlan,
  transactionHash: string,
): Promise<StandaloneDeploymentArtifact> {
  if (!HASH.test(transactionHash) || Number((await provider.getNetwork()).chainId) !== plan.chainId)
    throw new Error(`Invalid ${contract.noun} verification chain or receipt hash`);
  const [tx, receipt] = await Promise.all([
    provider.getTransaction(transactionHash),
    provider.getTransactionReceipt(transactionHash),
  ]);
  if (
    !tx ||
    !receipt ||
    tx.hash.toLowerCase() !== transactionHash.toLowerCase() ||
    receipt.hash.toLowerCase() !== transactionHash.toLowerCase() ||
    receipt.status !== 1 ||
    tx.to !== null ||
    tx.value !== 0n ||
    getAddress(tx.from) !== plan.deployer ||
    tx.nonce !== plan.nonce ||
    tx.data.toLowerCase() !== plan.creationCode.toLowerCase() ||
    !receipt.contractAddress ||
    getAddress(receipt.contractAddress) !== plan.address
  )
    throw new Error(`${capitalized(contract.noun)} receipt does not prove the reviewed CREATE transaction`);
  const code = await provider.getCode(plan.address);
  if (!HEX.test(code) || keccak256(code) !== plan.runtimeCodeHash)
    throw new Error(`Deployed ${contract.noun} runtime does not match the production artifact`);
  await contract.assertAbi((data) => provider.call({ to: plan.address, data }));
  return {
    schemaVersion: 1,
    kind: `${contract.id}_DEPLOYMENT`,
    network: plan.network,
    chainId: plan.chainId,
    address: plan.address,
    runtimeCodeHash: plan.runtimeCodeHash,
    creationCodeHash: plan.creationCodeHash,
    transactionHash,
    blockNumber: receipt.blockNumber,
    blockHash: receipt.blockHash,
    deployer: plan.deployer,
    nonce: plan.nonce,
    commit: plan.commit,
    verifiedAt: new Date().toISOString(),
  };
}
