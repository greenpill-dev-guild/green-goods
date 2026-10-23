import { AbiCoder, getAddress, getCreate2Address, getCreateAddress, Interface, MaxUint256 } from "ethers";
import { describe, expect, it } from "vitest";
import draft from "../../config/clc-pilot-release.json";
import {
  buildCLCPilotPlan,
  CLC_DEPENDENCIES,
  CLC_FACTORY_ABI,
  CLC_FACTORY_INIT_CODE_HASH,
  CLC_POOL_ABI,
  CLC_TIMELOCK_ABI,
  CLC_TIMELOCK_SOURCE,
  CLC_TOKEN_ABI,
  type CLCPilotManifest,
  inspectCLCPilotManifest,
  validateCLCPilotPlan,
} from "./clc-release";
import type { VoucherArtifact } from "./voucher-release";

const address = (n: number) => getAddress(`0x${n.toString(16).padStart(40, "0")}`);
const commit = "a".repeat(40);
function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error("Missing expected plan field");
  return value;
}
function fixture(): CLCPilotManifest & { deployer: string; nonce: number; techAndSunSafe: string } {
  return {
    ...structuredClone(draft),
    deployer: address(42),
    nonce: 7,
    techAndSunSafe: address(43),
  } as CLCPilotManifest & { deployer: string; nonce: number; techAndSunSafe: string };
}
function artifact(): VoucherArtifact {
  return {
    abi: ["constructor(uint256 minDelay,address[] proposers,address[] executors,address admin)"],
    bytecode: { object: "0x60006000f3" },
    deployedBytecode: { object: "0x6000" },
    metadata: {
      compiler: { version: "0.8.28+commit.fixture" },
      settings: {
        optimizer: { enabled: true, runs: 1 },
        viaIR: true,
        evmVersion: "cancun",
        compilationTarget: { [CLC_TIMELOCK_SOURCE]: "TimelockController" },
      },
    },
  };
}
describe("CLC Gnosis pilot preparation", () => {
  it("reads the pinned OpenZeppelin timelock admin role interface", () => {
    const timelock = new Interface(CLC_TIMELOCK_ABI);
    expect(timelock.getFunction("TIMELOCK_ADMIN_ROLE")).not.toBeNull();
    expect(timelock.getFunction("DEFAULT_ADMIN_ROLE")).toBeNull();
  });
  it("separates deployment prerequisites from issuer acceptance and deferred signer identities", () => {
    const report = inspectCLCPilotManifest(draft);
    expect(report.deploymentMissing).toEqual(["deployer", "nonce", "techAndSunSafe"]);
    expect(report.activationMissing).toContain("issuers.greenGoods.capacityConfirmed");
    expect(report.activationMissing).not.toContain("issuers.greenGoods.poolHeadroom");
    expect(() => buildCLCPilotPlan(draft, artifact(), commit)).toThrow("deployment inputs");
    expect(buildCLCPilotPlan(fixture(), artifact(), commit).transactions).toHaveLength(10);
  });
  it("keeps ten initial units within the approved twenty-unit holding cap and rejects no-headroom activation", () => {
    for (const issuer of Object.values(draft.issuers)) {
      expect(issuer.initialSupply).toBe("20000000");
      expect(issuer.poolInventory).toBe("10000000");
      expect(issuer.poolHoldingCap).toBe("20000000");
    }
    const m = fixture();
    for (const issuer of Object.values(m.issuers)) issuer.poolHoldingCap = issuer.poolInventory;
    const { activationMissing } = inspectCLCPilotManifest(m);
    expect(activationMissing).toContain("issuers.greenGoods.poolHeadroom");
    expect(activationMissing).toContain("issuers.techAndSun.poolHeadroom");
  });
  it("creates issuer Safe controlled timelocks followed by atomic initialized deterministic proxies", () => {
    const m = fixture();
    const a = artifact();
    const plan = buildCLCPilotPlan(m, a, commit);
    expect(plan.transactions.map((tx) => tx.nonce)).toEqual([7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    expect(plan.addresses.greenGoodsTimelock).toBe(getCreateAddress({ from: m.deployer, nonce: 7 }));
    expect(plan.addresses.techAndSunTimelock).toBe(getCreateAddress({ from: m.deployer, nonce: 8 }));
    const timelockInterface = new Interface(a.abi);
    const timelockArgs = AbiCoder.defaultAbiCoder().decode(
      ["uint256", "address[]", "address[]", "address"],
      `0x${plan.transactions[0].data.slice(a.bytecode.object.length)}`,
    );
    expect(timelockInterface.deploy.inputs).toHaveLength(4);
    expect(timelockArgs[0]).toBe(172800n);
    expect(timelockArgs[1][0]).toBe(m.greenGoodsSafe);
    expect(timelockArgs[2][0]).toBe(m.greenGoodsSafe);
    expect(BigInt(timelockArgs[3])).toBe(0n);
    for (const tx of plan.transactions.slice(2)) {
      expect(tx.to).toBe(CLC_DEPENDENCIES.factory.address);
      expect(required(tx.salt).slice(2, 42)).toBe(m.deployer.slice(2).toLowerCase());
      expect(tx.address).toBe(getCreate2Address(required(tx.to), required(tx.salt), CLC_FACTORY_INIT_CODE_HASH));
      const args = new Interface(CLC_FACTORY_ABI).decodeFunctionData("deployDeterministicAndCall", tx.data);
      expect(args[2]).toBe(tx.salt);
      expect(args[3]).toBe(tx.initializer);
      expect(args[1]).toBe(
        tx.component === "techAndSunToken" ? plan.addresses.techAndSunTimelock : plan.addresses.greenGoodsTimelock,
      );
    }
    const token = required(plan.transactions.find((tx) => tx.component === "greenGoodsToken"));
    expect(new Interface(CLC_TOKEN_ABI).decodeFunctionData("initialize", required(token.initializer))[3]).toBe(
      m.greenGoodsSafe,
    );
    const pool = required(plan.transactions.at(-1));
    expect(new Interface(CLC_POOL_ABI).decodeFunctionData("initialize", required(pool.initializer))[3]).toBe(
      m.greenGoodsSafe,
    );
    expect(plan.activationIncluded).toBe(false);
    expect(plan.liveBroadcast).toBe(false);
  });
  it("keeps issuance, pool registration and adapter authorization outside deployment", () => {
    const m = fixture();
    const plan = buildCLCPilotPlan(m, artifact(), commit);
    expect(plan.initialState).toEqual({
      tokenSupply: "0",
      poolInventory: "0",
      registeredTokens: [],
      defaultHoldingLimit: "0",
    });
    expect(plan.configurationTransactions).toHaveLength(7);
    expect(plan.configurationTransactions.every((tx) => tx.from === m.greenGoodsSafe)).toBe(true);
    expect(plan.issuanceTransactions.filter((tx) => tx.operation === "mintTo")).toHaveLength(2);
    const authorizations = plan.issuanceTransactions.filter((tx) =>
      ["configureAsset", "approveAdapter"].includes(tx.operation),
    );
    expect(authorizations).toHaveLength(4);
    expect(authorizations.every((tx) => tx.data === null && !tx.executable && tx.missing.length > 0)).toBe(true);
    const mint = required(plan.issuanceTransactions.find((tx) => tx.operation === "mintTo"));
    expect(mint.executable).toBe(false);
    expect(new Interface(CLC_TOKEN_ABI).decodeFunctionData("mintTo", required(mint.data))[1]).toBe(20_000_000n);
  });
  it("encodes finite issuer-authorized drafts only when real authority inputs are present", () => {
    const m = fixture();
    m.earnedAdapter = address(44);
    for (const issuer of Object.values(m.issuers)) {
      issuer.sourceIssuerAuthority = address(45);
      issuer.terms.reference = "https://example.org/approved-terms";
      issuer.terms.digest = `0x${"c".repeat(64)}`;
      issuer.capacityConfirmed = true;
      issuer.poolHoldingCap = "20000000";
    }
    const plan = buildCLCPilotPlan(m, artifact(), commit);
    expect(plan.activationMissing).toEqual([]);
    expect(plan.issuanceTransactions.every((tx) => tx.executable && tx.missing.length === 0)).toBe(true);
    const allowance = required(plan.issuanceTransactions.find((tx) => tx.operation === "approveAdapter"));
    const args = new Interface(CLC_TOKEN_ABI).decodeFunctionData("approve", required(allowance.data));
    expect(args[0]).toBe(m.earnedAdapter);
    expect(args[1]).toBe(10_000_000n);
    expect(args[1]).not.toBe(MaxUint256);
    expect(plan.transactions).toHaveLength(10);
  });
  it.each([
    [
      "unknown field",
      (m: ReturnType<typeof fixture>) => {
        Reflect.set(m, "threshold", 3);
      },
    ],
    [
      "missing field",
      (m: ReturnType<typeof fixture>) => {
        Reflect.deleteProperty(m.issuers.greenGoods.terms, "digest");
      },
    ],
    [
      "wrong chain",
      (m: ReturnType<typeof fixture>) => {
        Reflect.set(m, "chainId", 42161);
      },
    ],
    [
      "duplicate Safe",
      (m: ReturnType<typeof fixture>) => {
        m.techAndSunSafe = m.greenGoodsSafe;
      },
    ],
    [
      "duplicate token symbol",
      (m: ReturnType<typeof fixture>) => {
        m.issuers.techAndSun.symbol = m.issuers.greenGoods.symbol;
      },
    ],
    [
      "GG Safe as native deployer",
      (m: ReturnType<typeof fixture>) => {
        m.deployer = m.greenGoodsSafe;
      },
    ],
    [
      "Tech and Sun Safe as native deployer",
      (m: ReturnType<typeof fixture>) => {
        m.deployer = m.techAndSunSafe;
      },
    ],
    [
      "wrong GG Safe",
      (m: ReturnType<typeof fixture>) => {
        m.greenGoodsSafe = address(99);
      },
    ],
    [
      "malformed Safe",
      (m: ReturnType<typeof fixture>) => {
        m.techAndSunSafe = "steward";
      },
    ],
    [
      "short delay",
      (m: ReturnType<typeof fixture>) => {
        Reflect.set(m, "minimumUpgradeDelay", 0);
      },
    ],
    [
      "unsupported decimal",
      (m: ReturnType<typeof fixture>) => {
        Reflect.set(m, "decimals", 18);
      },
    ],
    [
      "nonzero fee",
      (m: ReturnType<typeof fixture>) => {
        m.pool.poolFee = "1";
      },
    ],
    [
      "unlimited allowance",
      (m: ReturnType<typeof fixture>) => {
        m.issuers.greenGoods.adapterAllowance = MaxUint256.toString();
      },
    ],
    [
      "excess inventory",
      (m: ReturnType<typeof fixture>) => {
        m.issuers.greenGoods.poolInventory = "20000001";
      },
    ],
    [
      "excess reserve promises",
      (m: ReturnType<typeof fixture>) => {
        m.issuers.greenGoods.adapterAllowance = "10000001";
      },
    ],
    [
      "bad terms digest",
      (m: ReturnType<typeof fixture>) => {
        m.issuers.greenGoods.terms.digest = "approved";
      },
    ],
    [
      "unsafe nonce",
      (m: ReturnType<typeof fixture>) => {
        m.nonce = Number.MAX_SAFE_INTEGER;
      },
    ],
  ])("rejects %s", (_, mutate) => {
    const m = fixture();
    mutate(m);
    expect(() => inspectCLCPilotManifest(m)).toThrow();
  });
  it("binds complete manifest identity, source revision, artifact and exact transaction payloads", () => {
    const m = fixture();
    const a = artifact();
    const plan = buildCLCPilotPlan(m, a, commit);
    validateCLCPilotPlan(plan, m, a, commit);
    for (const mutate of [
      (p: typeof plan) => {
        p.transactions[0].nonce++;
      },
      (p: typeof plan) => {
        p.transactions[2].salt = `0x${"1".repeat(64)}`;
      },
      (p: typeof plan) => {
        p.transactions[2].data += "00";
      },
      (p: typeof plan) => {
        p.issuanceTransactions[0].data += "00";
      },
    ]) {
      const changed = structuredClone(plan);
      mutate(changed);
      expect(() => validateCLCPilotPlan(changed, m, a, commit)).toThrow("mismatch");
    }
    expect(() => validateCLCPilotPlan(plan, m, a, "b".repeat(40))).toThrow("mismatch");
    const changed = structuredClone(m);
    changed.issuers.greenGoods.name += " changed";
    expect(buildCLCPilotPlan(changed, a, commit).addresses.greenGoodsToken).not.toBe(plan.addresses.greenGoodsToken);
    expect(() => validateCLCPilotPlan(plan, changed, a, commit)).toThrow("mismatch");
    a.deployedBytecode.object += "00";
    expect(() => validateCLCPilotPlan(plan, m, a, commit)).toThrow("mismatch");
    expect(() => buildCLCPilotPlan(m, a, "uncommitted")).toThrow("revision");
  });
  it("rejects nonproduction or linked timelock artifacts before creating a release plan", () => {
    for (const mutate of [
      (a: VoucherArtifact) => {
        a.metadata.settings.optimizer.runs = 200;
      },
      (a: VoucherArtifact) => {
        a.metadata.settings.viaIR = false;
      },
      (a: VoucherArtifact) => {
        a.metadata.settings.compilationTarget = { "wrong.sol": "TimelockController" };
      },
      (a: VoucherArtifact) => {
        a.bytecode.object = "0x__unresolved__";
      },
    ]) {
      const a = artifact();
      mutate(a);
      expect(() => buildCLCPilotPlan(fixture(), a, commit)).toThrow();
    }
  });
});
