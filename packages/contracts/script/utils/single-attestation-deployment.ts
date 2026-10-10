import { Interface, getAddress, getCreateAddress, keccak256, type Provider } from "ethers";
import { CHAIN_ID_MAP } from "./network";

export const POLICY_TARGET = "src/modules/SingleAttestationPolicy.sol:SingleAttestationPolicy";
const HEX = /^0x(?:[0-9a-fA-F]{2})+$/u;
const HASH = /^0x[0-9a-fA-F]{64}$/u;
const MODULE = new Interface(["function isModuleType(uint256) view returns (bool)"]);
export interface PolicyBytecode {
  creationCode: string;
  runtimeCode: string;
}
export interface PolicyDeploymentPlan {
  schemaVersion: 1;
  kind: "SINGLE_ATTESTATION_POLICY_PLAN";
  network: string;
  chainId: number;
  commit: string;
  deployer: string;
  nonce: number;
  address: string;
  target: typeof POLICY_TARGET;
  creationCode: string;
  creationCodeHash: string;
  runtimeCodeHash: string;
  generatedAt: string;
  authorityEnabled: false;
}
export interface PolicyDeploymentArtifact {
  schemaVersion: 1;
  kind: "SINGLE_ATTESTATION_POLICY_DEPLOYMENT";
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
export function policyBytecode(artifact: unknown): PolicyBytecode {
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
    throw new Error("Policy requires nonempty linked bytecode without immutable substitutions");
  }
  return { creationCode, runtimeCode };
}

export function policyDeploymentPlan(
  input: PolicyBytecode & { network: string; chainId: number; sender: string; nonce: number; commit: string },
): PolicyDeploymentPlan {
  if (
    !["arbitrum", "sepolia", "localhost"].includes(input.network) ||
    Number(CHAIN_ID_MAP[input.network]) !== input.chainId
  )
    throw new Error("Policy deployment network/chain mismatch");
  if (
    !Number.isSafeInteger(input.nonce) ||
    input.nonce < 0 ||
    !/^[0-9a-f]{40}$/iu.test(input.commit) ||
    !HEX.test(input.creationCode) ||
    !HEX.test(input.runtimeCode)
  )
    throw new Error("Invalid policy deployment inputs");
  const deployer = getAddress(input.sender);
  if (/^0x0{40}$/iu.test(deployer)) throw new Error("Policy deployment sender is zero");
  return {
    schemaVersion: 1,
    kind: "SINGLE_ATTESTATION_POLICY_PLAN",
    network: input.network,
    chainId: input.chainId,
    commit: input.commit,
    deployer,
    nonce: input.nonce,
    address: getCreateAddress({ from: deployer, nonce: input.nonce }),
    target: POLICY_TARGET,
    creationCode: input.creationCode,
    creationCodeHash: keccak256(input.creationCode),
    runtimeCodeHash: keccak256(input.runtimeCode),
    generatedAt: new Date().toISOString(),
    authorityEnabled: false,
  };
}

/** No signer is touched until the exact reviewed bytecode, commit, chain, nonce and address match. */
export function assertPolicyPlan(
  plan: PolicyDeploymentPlan,
  expected: { network: string; chainId: number; commit: string; bytecode: PolicyBytecode; nonce?: number },
): void {
  const rebuilt = policyDeploymentPlan({
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
    plan.target !== POLICY_TARGET ||
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
    throw new Error("Policy plan differs from reviewed deployment inputs");
}

export async function assertPolicyChain(
  provider: Pick<
    Provider,
    "getNetwork" | "getTransactionCount" | "getCode" | "estimateGas" | "getFeeData" | "getBalance"
  >,
  plan: PolicyDeploymentPlan,
): Promise<{ gasEstimate: string; maxCostWei: string }> {
  if (Number((await provider.getNetwork()).chainId) !== plan.chainId)
    throw new Error("RPC chain does not match the policy plan");
  const [latest, pending, code] = await Promise.all([
    provider.getTransactionCount(plan.deployer, "latest"),
    provider.getTransactionCount(plan.deployer, "pending"),
    provider.getCode(plan.address),
  ]);
  if (latest !== plan.nonce || pending !== plan.nonce)
    throw new Error("Policy deployer nonce changed or has pending transactions");
  if (code !== "0x") throw new Error("Policy deployment address already has code");
  const [gas, fees, balance] = await Promise.all([
    provider.estimateGas({ from: plan.deployer, data: plan.creationCode, value: 0n }),
    provider.getFeeData(),
    provider.getBalance(plan.deployer),
  ]);
  const fee = fees.maxFeePerGas ?? fees.gasPrice;
  const gasLimit = (gas * 130n + 99n) / 100n;
  if (gas <= 0n || fee === null || fee <= 0n || balance < gasLimit * fee)
    throw new Error("Policy deployer is unfunded for the estimated deployment cost");
  return { gasEstimate: gasLimit.toString(), maxCostWei: (gasLimit * fee).toString() };
}

/** Confirm CREATE provenance and exact live bytes before publishing any deployment pin. */
export async function verifyPolicyDeployment(
  provider: Pick<Provider, "getNetwork" | "getTransaction" | "getTransactionReceipt" | "getCode" | "call">,
  plan: PolicyDeploymentPlan,
  transactionHash: string,
): Promise<PolicyDeploymentArtifact> {
  if (!HASH.test(transactionHash) || Number((await provider.getNetwork()).chainId) !== plan.chainId)
    throw new Error("Invalid policy verification chain or receipt hash");
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
    throw new Error("Policy receipt does not prove the reviewed CREATE transaction");
  const code = await provider.getCode(plan.address);
  if (!HEX.test(code) || keccak256(code) !== plan.runtimeCodeHash)
    throw new Error("Deployed policy runtime does not match the production artifact");
  const isModuleType = async (type: number) =>
    MODULE.decodeFunctionResult(
      "isModuleType",
      await provider.call({ to: plan.address, data: MODULE.encodeFunctionData("isModuleType", [type]) }),
    )[0] === true;
  if (!(await isModuleType(5)) || (await isModuleType(1)))
    throw new Error("Deployed policy module ABI is incompatible");
  return {
    schemaVersion: 1,
    kind: "SINGLE_ATTESTATION_POLICY_DEPLOYMENT",
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
