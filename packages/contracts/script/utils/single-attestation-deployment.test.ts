import { Interface, getCreateAddress, keccak256 } from "ethers";
import { describe, expect, it } from "vitest";
import {
  assertPolicyChain,
  assertPolicyPlan,
  policyBytecode,
  policyDeploymentPlan,
  verifyPolicyDeployment,
} from "./single-attestation-deployment";

const sender = "0x00000000000000000000000000000000000000A1";
const bytecode = { creationCode: "0x60006000", runtimeCode: "0x6000" };
const input = { ...bytecode, network: "arbitrum", chainId: 42161, sender, nonce: 7, commit: "a".repeat(40) };
const plan = () => policyDeploymentPlan(input);
const hash = `0x${"b".repeat(64)}`;
const module = new Interface(["function isModuleType(uint256) view returns (bool)"]);

function chain(overrides: Record<string, unknown> = {}) {
  return {
    getNetwork: async () => ({ chainId: 42161n }),
    getTransactionCount: async () => 7,
    getCode: async () => "0x",
    estimateGas: async () => 100n,
    getFeeData: async () => ({ maxFeePerGas: 10n }),
    getBalance: async () => 1300n,
    ...overrides,
  } as unknown as Parameters<typeof assertPolicyChain>[0];
}
function deployed(overrides: Record<string, unknown> = {}) {
  const p = plan();
  return {
    getNetwork: async () => ({ chainId: 42161n }),
    getTransaction: async () => ({
      hash,
      from: p.deployer,
      nonce: 7,
      to: null,
      value: 0n,
      data: bytecode.creationCode,
    }),
    getTransactionReceipt: async () => ({
      hash,
      status: 1,
      contractAddress: p.address,
      blockNumber: 1,
      blockHash: hash,
    }),
    getCode: async () => bytecode.runtimeCode,
    call: async ({ data }: { data: string }) =>
      module.encodeFunctionResult("isModuleType", [module.decodeFunctionData("isModuleType", data)[0] === 5n]),
    ...overrides,
  } as unknown as Parameters<typeof verifyPolicyDeployment>[0];
}

describe("standalone policy deployment provenance", () => {
  it("derives a zero-authority CREATE plan with exact production hashes", () => {
    const p = plan();
    expect(p.address).toBe(getCreateAddress({ from: sender, nonce: 7 }));
    expect(p.runtimeCodeHash).toBe(keccak256(bytecode.runtimeCode));
    expect(p.creationCodeHash).toBe(keccak256(bytecode.creationCode));
    expect(p.authorityEnabled).toBe(false);
    expect(() => policyDeploymentPlan({ ...input, chainId: 1 })).toThrow("network/chain");
    expect(() => policyDeploymentPlan({ ...input, nonce: -1 })).toThrow("inputs");
  });
  it("rejects empty/unlinked bytecode and unresolved immutable substitutions", () => {
    const artifact = {
      bytecode: { object: bytecode.creationCode },
      deployedBytecode: { object: bytecode.runtimeCode },
    };
    expect(policyBytecode(artifact)).toEqual(bytecode);
    expect(() => policyBytecode({ ...artifact, bytecode: { object: "0x" } })).toThrow();
    expect(() =>
      policyBytecode({ ...artifact, bytecode: { object: bytecode.creationCode, linkReferences: { lib: [] } } }),
    ).toThrow();
    expect(() =>
      policyBytecode({
        ...artifact,
        deployedBytecode: { object: bytecode.runtimeCode, immutableReferences: { id: [] } },
      }),
    ).toThrow();
    expect(() => policyBytecode({ ...artifact, bytecode: { object: "0x__$linked$__" } })).toThrow();
  });
  it("binds the reviewed commit, chain, nonce, address, bytes and authority flag", () => {
    const expected = { network: input.network, chainId: input.chainId, commit: input.commit, bytecode, nonce: 7 };
    expect(() => assertPolicyPlan(plan(), expected)).not.toThrow();
    for (const change of [
      { commit: "c".repeat(40) },
      { address: sender },
      { runtimeCodeHash: hash },
      { creationCode: "0x6001" },
      { chainId: 1 },
      { nonce: 8 },
      { authorityEnabled: true },
    ]) {
      expect(() => assertPolicyPlan({ ...plan(), ...change } as ReturnType<typeof plan>, expected)).toThrow("reviewed");
    }
  });
  it("rejects wrong RPC chain, used addresses and pending nonce races", async () => {
    await expect(assertPolicyChain(chain({ getNetwork: async () => ({ chainId: 1n }) }), plan())).rejects.toThrow(
      "chain",
    );
    await expect(assertPolicyChain(chain({ getCode: async () => "0x6000" }), plan())).rejects.toThrow(
      "already has code",
    );
    await expect(
      assertPolicyChain(
        chain({ getTransactionCount: async (_: string, tag: string) => (tag === "pending" ? 8 : 7) }),
        plan(),
      ),
    ).rejects.toThrow("pending");
  });
  it("requires the full 130-percent gas estimate and never accepts an unfunded sender", async () => {
    await expect(assertPolicyChain(chain(), plan())).resolves.toEqual({ gasEstimate: "130", maxCostWei: "1300" });
    await expect(assertPolicyChain(chain({ getBalance: async () => 1299n }), plan())).rejects.toThrow("unfunded");
    await expect(
      assertPolicyChain(chain({ getFeeData: async () => ({ maxFeePerGas: null, gasPrice: null }) }), plan()),
    ).rejects.toThrow("unfunded");
  });
  it("verifies the actual CREATE receipt/runtime and ERC-7579 policy ABI", async () => {
    const artifact = await verifyPolicyDeployment(deployed(), plan(), hash);
    expect(artifact.address).toBe(plan().address);
    expect(artifact.runtimeCodeHash).toBe(plan().runtimeCodeHash);
    expect(artifact.transactionHash).toBe(hash);
    expect(artifact.kind).toBe("SINGLE_ATTESTATION_POLICY_DEPLOYMENT");
    expect(artifact).not.toHaveProperty("authorityEnabled");
  });
  it("rejects failed receipts and transaction substitutions even at the predicted address", async () => {
    const original = await deployed().getTransaction(hash);
    for (const change of [
      { to: sender },
      { value: 1n },
      { nonce: 8 },
      { from: "0x00000000000000000000000000000000000000B2" },
      { data: "0x6001" },
    ]) {
      await expect(
        verifyPolicyDeployment(deployed({ getTransaction: async () => ({ ...original, ...change }) }), plan(), hash),
      ).rejects.toThrow("reviewed CREATE");
    }
    await expect(
      verifyPolicyDeployment(deployed({ getTransactionReceipt: async () => ({ hash, status: 0 }) }), plan(), hash),
    ).rejects.toThrow("CREATE");
  });
  it("rejects missing receipt, wrong runtime bytes and ABI impersonation", async () => {
    await expect(
      verifyPolicyDeployment(deployed({ getTransactionReceipt: async () => null }), plan(), hash),
    ).rejects.toThrow("CREATE");
    await expect(verifyPolicyDeployment(deployed({ getCode: async () => "0x6001" }), plan(), hash)).rejects.toThrow(
      "runtime",
    );
    await expect(
      verifyPolicyDeployment(
        deployed({ call: async () => module.encodeFunctionResult("isModuleType", [true]) }),
        plan(),
        hash,
      ),
    ).rejects.toThrow("ABI");
  });
});
