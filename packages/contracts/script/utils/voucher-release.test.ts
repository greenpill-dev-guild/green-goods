import { getAddress, getCreateAddress, Interface, keccak256 } from "ethers";
import { describe, expect, it } from "vitest";
import { buildVoucherPlan, inspectVoucherManifest, validateVoucherPlan, VOUCHER_CONTRACTS } from "./voucher-release";

import { fixtureManifest } from "./voucher-release.fixtures";
const address = (n: number) => getAddress(`0x${n.toString(16).padStart(40, "0")}`);

function fixtureArtifacts() {
  return Object.fromEntries(
    VOUCHER_CONTRACTS.map(({ name, source }) => {
      const inputs =
        name === "VoucherEntitlementModule"
          ? "address,address,uint64,uint256,address,address,address"
          : name === "VoucherRedemptionModule"
            ? "address,address,uint64,uint256,address,address"
            : "address,address,uint64,uint256,address";
      const abi =
        name === "ERC1967Proxy"
          ? ["constructor(address,bytes)"]
          : name.endsWith("Lib") || name === "VoucherRedemptionTransfers"
            ? []
            : ["constructor(address)", `function initialize(${inputs})`];
      return [
        name,
        {
          abi,
          bytecode: { object: "0x60006000f3" },
          deployedBytecode: { object: "0x6000" },
          metadata: {
            compiler: { version: "0.8.28+commit.test" },
            settings: {
              optimizer: { enabled: true, runs: 1 },
              viaIR: true,
              evmVersion: "cancun",
              libraries: {},
              compilationTarget: { [source]: name },
            },
          },
        },
      ];
    }),
  );
}
const commit = "a".repeat(40);

describe("paused cross-chain voucher deployment planning", () => {
  it("keeps missing signer/control inputs explicit while preserving accepted governance", () => {
    const draft = fixtureManifest();
    const input = { ...draft, networks: { ...draft.networks, gnosis: { ...draft.networks.gnosis, owner: null } } };
    const report = inspectVoucherManifest(input);
    expect(report.missing).toContain("networks.gnosis.owner");
    expect(() => buildVoucherPlan(input, fixtureArtifacts(), commit)).toThrow("networks.gnosis.owner");
    expect(report.activationMissing).toContain("governance.techAndSun.address");
  });
  it.each([
    [
      "wrong chain",
      (m: ReturnType<typeof fixtureManifest>) => {
        m.networks.gnosis.chainId = 1;
      },
    ],
    [
      "bad selector",
      (m: ReturnType<typeof fixtureManifest>) => {
        m.networks.gnosis.selector = "0";
      },
    ],
    [
      "same selector",
      (m: ReturnType<typeof fixtureManifest>) => {
        m.networks.gnosis.selector = m.networks.arbitrum.selector;
      },
    ],
    [
      "same guardian",
      (m: ReturnType<typeof fixtureManifest>) => {
        m.networks.gnosis.guardian = m.networks.gnosis.owner;
      },
    ],
    [
      "negative nonce",
      (m: ReturnType<typeof fixtureManifest>) => {
        m.networks.gnosis.nonce = -1;
      },
    ],
    [
      "unsafe threshold",
      (m: ReturnType<typeof fixtureManifest>) => {
        m.governance.sharedPool.threshold = 1;
      },
    ],
  ])("rejects %s before producing transactions", (_, change) => {
    const m = fixtureManifest();
    change(m);
    expect(() => inspectVoucherManifest(m)).toThrow();
  });
  it("derives eleven exact nonce-bound CREATEs and resolves peers without circular CREATE2 initialization", () => {
    const m = fixtureManifest();
    const plan = buildVoucherPlan(m, fixtureArtifacts(), commit);
    expect(plan.transactions).toHaveLength(11);
    expect(plan.activationIncluded).toBe(false);
    expect(plan.sourceCommit).toBe(commit);
    const arb = plan.transactions.filter((t) => t.network === "arbitrum");
    const gnosis = plan.transactions.filter((t) => t.network === "gnosis");
    expect(arb.map((t) => t.nonce)).toEqual([7, 8, 9, 10, 11, 12]);
    expect(gnosis.map((t) => t.nonce)).toEqual([17, 18, 19, 20, 21]);
    for (const tx of plan.transactions) {
      expect(tx.address).toBe(getCreateAddress({ from: tx.from, nonce: tx.nonce }));
      expect(tx.to).toBeNull();
      expect(tx.value).toBe("0");
      expect(tx.creationCodeHash).toBe(keccak256(tx.data));
    }
    const entitlement = arb.find((t) => t.contract === "VoucherEntitlementModule" && t.kind === "proxy")!;
    const adapter = gnosis.find((t) => t.contract === "GnosisVoucherAdapter" && t.kind === "proxy")!;
    const initializer = new Interface(fixtureArtifacts().VoucherEntitlementModule.abi);
    const args = initializer.decodeFunctionData("initialize", entitlement.initializer!);
    expect(args[4]).toBe(adapter.address);
    expect(args[3]).toBe(100n);
  });
  it("links only reviewed library addresses and rejects foreign or unresolved links", () => {
    const a = fixtureArtifacts();
    a.VoucherRedemptionModule.bytecode = {
      object: `0x${"00".repeat(20)}6000`,
      linkReferences: {
        "src/lib/VoucherService/VoucherServiceConsentLib.sol": { VoucherServiceConsentLib: [{ start: 0, length: 20 }] },
      },
    } as typeof a.VoucherRedemptionModule.bytecode;
    const plan = buildVoucherPlan(fixtureManifest(), a, commit);
    const library = plan.transactions.find((t) => t.contract === "VoucherServiceConsentLib")!;
    const implementation = plan.transactions.find(
      (t) => t.contract === "VoucherRedemptionModule" && t.kind === "implementation",
    )!;
    expect(implementation.data.slice(0, 42).toLowerCase()).toBe(library.address.toLowerCase());
    a.VoucherRedemptionModule.bytecode = { object: "0x__$unresolved$__" };
    expect(() => buildVoucherPlan(fixtureManifest(), a, commit)).toThrow();
  });
  it("rejects artifacts from a non-production optimizer/profile or an already-linked build", () => {
    const a = fixtureArtifacts();
    a.GnosisVoucherAdapter.metadata.settings.optimizer.runs = 200;
    expect(() => buildVoucherPlan(fixtureManifest(), a, commit)).toThrow("production");
    a.GnosisVoucherAdapter.metadata.settings.optimizer.runs = 1;
    a.GnosisVoucherAdapter.metadata.settings.libraries = { foreign: { lib: address(20) } };
    expect(() => buildVoucherPlan(fixtureManifest(), a, commit)).toThrow("linked");
  });
  it("rejects reviewed-plan substitution of commit, calldata, peers, nonce or activation", () => {
    const m = fixtureManifest(),
      a = fixtureArtifacts(),
      plan = buildVoucherPlan(m, a, commit);
    expect(() => validateVoucherPlan(plan, m, a, commit)).not.toThrow();
    for (const mutate of [
      (p: typeof plan) => {
        p.sourceCommit = "b".repeat(40);
      },
      (p: typeof plan) => {
        p.transactions[0].data = "0x6001";
      },
      (p: typeof plan) => {
        p.transactions[0].nonce++;
      },
      (p: typeof plan) => {
        p.activationIncluded = true as false;
      },
    ]) {
      const altered = structuredClone(plan);
      mutate(altered);
      expect(() => validateVoucherPlan(altered, m, a, commit)).toThrow("reviewed");
    }
  });
});
