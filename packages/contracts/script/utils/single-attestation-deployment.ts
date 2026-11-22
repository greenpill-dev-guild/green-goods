import { Interface, type Provider } from "ethers";
import {
  assertStandaloneChain,
  assertStandalonePlan,
  standaloneBytecode,
  standaloneDeploymentPlan,
  verifyStandaloneDeployment,
  type StandaloneBytecode,
  type StandaloneContract,
} from "./standalone-deployment";

export const POLICY_TARGET = "src/modules/SingleAttestationPolicy.sol:SingleAttestationPolicy";
const MODULE = new Interface(["function isModuleType(uint256) view returns (bool)"]);

/** The reporting guard: an ERC-7579 policy (module type 5) with no constructor and no authority. */
export const POLICY: StandaloneContract = {
  noun: "policy",
  target: POLICY_TARGET,
  script: "DeploySingleAttestationPolicy",
  id: "SINGLE_ATTESTATION_POLICY",
  slug: "single-attestation-policy",
  sources: [
    "script/deploy/single-attestation-policy.ts",
    "script/utils/single-attestation-deployment.ts",
    "script/utils/single-attestation-operation.ts",
  ],
  localhostSigner: "keystore",
  async assertAbi(call) {
    const isModuleType = async (type: number) =>
      MODULE.decodeFunctionResult("isModuleType", await call(MODULE.encodeFunctionData("isModuleType", [type])))[0] ===
      true;
    if (!(await isModuleType(5)) || (await isModuleType(1)))
      throw new Error("Deployed policy module ABI is incompatible");
  },
};

export type PolicyBytecode = StandaloneBytecode;
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
  return standaloneBytecode(POLICY, artifact);
}

export function policyDeploymentPlan(
  input: PolicyBytecode & { network: string; chainId: number; sender: string; nonce: number; commit: string },
): PolicyDeploymentPlan {
  return standaloneDeploymentPlan(POLICY, input) as PolicyDeploymentPlan;
}

/** No signer is touched until the exact reviewed bytecode, commit, chain, nonce and address match. */
export function assertPolicyPlan(
  plan: PolicyDeploymentPlan,
  expected: { network: string; chainId: number; commit: string; bytecode: PolicyBytecode; nonce?: number },
): void {
  assertStandalonePlan(POLICY, plan, expected);
}

export async function assertPolicyChain(
  provider: Pick<
    Provider,
    "getNetwork" | "getTransactionCount" | "getCode" | "estimateGas" | "getFeeData" | "getBalance"
  >,
  plan: PolicyDeploymentPlan,
): Promise<{ gasEstimate: string; maxCostWei: string }> {
  return assertStandaloneChain(POLICY, provider, plan);
}

/** Confirm CREATE provenance and exact live bytes before publishing any deployment pin. */
export async function verifyPolicyDeployment(
  provider: Pick<Provider, "getNetwork" | "getTransaction" | "getTransactionReceipt" | "getCode" | "call">,
  plan: PolicyDeploymentPlan,
  transactionHash: string,
): Promise<PolicyDeploymentArtifact> {
  return (await verifyStandaloneDeployment(POLICY, provider, plan, transactionHash)) as PolicyDeploymentArtifact;
}
