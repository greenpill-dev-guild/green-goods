import { describe, expect, it } from "vitest";
import { resolveCommand } from "../cli/operations.mjs";
import path from "node:path";
import { sourceUpgradeOutputPath, sourceUpgradeCreateArgs } from "./source-upgrade-operator";
import { CONTRACTS_ROOT } from "./paths";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import type { SourceUpgradeDeployment } from "./source-upgrade-release";
import type { SourceExecutionBoundary } from "./source-upgrade-execution-types";

const base = ["release", "source-upgrades"];
const files = [
  "--plan",
  ".generated/source-upgrades/p.plan.json",
  "--rehearsal",
  ".generated/source-upgrades/p.simulation.json",
];
const execution = [
  ...files,
  "--envelope",
  ".generated/source-upgrades/p.execution.json",
  "--step",
  "1",
  "--expected-nonce",
  "1039",
];
describe("source upgrade operator command boundaries", () => {
  it("binds the unlocked sender and zero native value before Cast submits", () => {
    const from = "0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6";
    const deployment: SourceUpgradeDeployment = {
      key: "src/X.sol:X",
      kind: "library",
      address: "0x1111111111111111111111111111111111111111",
      from,
      nonce: 1039,
      to: null,
      value: "0",
      data: "0x6000",
      runtimeTemplate: "0x6000",
      immutableReferences: {},
    };
    const boundary: SourceExecutionBoundary = {
      step: 1,
      kind: "create",
      from,
      nonce: 1039,
      gasLimit: "100000",
      maxFeeWei: "50000000",
      priorityFeeWei: "0",
    };
    expect(sourceUpgradeCreateArgs(deployment, boundary, "https://public-rpc.invalid")).toEqual([
      "send",
      "--rpc-url",
      "https://public-rpc.invalid",
      "--json",
      "--from",
      from,
      "--value",
      "0",
      "--chain",
      "42161",
      "--nonce",
      "1039",
      "--account",
      "green-goods-deployer",
      "--gas-limit",
      "100000",
      "--gas-price",
      "50000000",
      "--priority-gas-price",
      "0",
      "--create",
      "0x6000",
    ]);
    expect(() =>
      sourceUpgradeCreateArgs(
        { ...deployment, from: "0x2222222222222222222222222222222222222222" },
        boundary,
        "https://public-rpc.invalid",
      ),
    ).toThrow("approved deployer");
  });
  it("preserves active execution inputs when preparation is rerun", () => {
    const root = mkdtempSync("/private/tmp/source-operator-output-");
    try {
      writeFileSync(path.join(root, "42161-source-upgrade-execution.json"), "{}");
      for (const mode of ["plan", "simulate", "prepare-execution"])
        expect(() =>
          sourceUpgradeOutputPath(root, { mode, output: path.join(root, "replacement.json") }, "unused.json"),
        ).toThrow("shared journal");
      expect(
        sourceUpgradeOutputPath(
          root,
          { mode: "export-safe", output: path.join(root, "safe-recipe.json") },
          "unused.json",
        ),
      ).toBe(path.join(root, "safe-recipe.json"));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
  it("cannot overwrite the shared spend ledger, lock, or reviewed input through an output option", () => {
    const root = path.join(CONTRACTS_ROOT, ".generated/source-upgrades");
    for (const file of [
      "42161-source-upgrade-execution.json",
      "42161-source-upgrade-execution.lock.json",
      "42161-source-upgrade-execution.recovery.lock.json",
      "42161-SOURCE-UPGRADE-EXECUTION.JSON",
    ])
      expect(() =>
        sourceUpgradeOutputPath(root, { output: `.generated/source-upgrades/${file}` }, "unused.json"),
      ).toThrow();
    for (const input of ["plan", "envelope", "rehearsal"])
      expect(() =>
        sourceUpgradeOutputPath(
          root,
          { [input]: ".generated/source-upgrades/reviewed.json", output: ".generated/source-upgrades/reviewed.json" },
          "unused.json",
        ),
      ).toThrow();
    expect(() =>
      sourceUpgradeOutputPath(
        root,
        { plan: ".generated/source-upgrades/reviewed.json", output: ".generated/source-upgrades/REVIEWED.json" },
        "unused.json",
      ),
    ).toThrow();
    expect(() =>
      sourceUpgradeOutputPath(root, { output: "config/source-upgrade-release.json" }, "unused.json"),
    ).toThrow();
  });
  it("requires complete reviewed preparation inputs before execution", () => {
    expect(() => resolveCommand([...base, "--mode", "prepare-execution", ...files])).toThrow();
    const command = resolveCommand([
      ...base,
      "--mode",
      "prepare-execution",
      ...files,
      "--safe-pins",
      "config/source-safe-pins.json",
      "--other-reserved-wei",
      "2500000000000000",
    ]);
    expect("args" in command && command.args).toContain("--prepare-execution");
  });
  it("uses only the normal fixed operator keystore for a concrete boundary", () => {
    const command = resolveCommand([...base, "--mode", "broadcast", ...execution]);
    expect("env" in command && command.env.FOUNDRY_KEYSTORE_ACCOUNT).toBe("green-goods-deployer");
    for (const flag of ["sender", "account", "private-key", "password", "rpc-url", "gas-limit"])
      expect(() => resolveCommand([...base, "--mode", "broadcast", ...execution, `--${flag}`, "override"])).toThrow();
  });
  it("supports one-password CREATE sessions without arbitrary signer or boundary overrides", () => {
    const session = [
      ...base,
      "--mode",
      "broadcast-creates",
      ...files,
      "--envelope",
      ".generated/source-upgrades/p.execution.json",
      "--resume-plan",
    ];
    const command = resolveCommand(session);
    expect("args" in command && command.args).toContain("--broadcast-creates");
    expect("env" in command && command.env.FOUNDRY_KEYSTORE_ACCOUNT).toBe("green-goods-deployer");
    for (const flag of ["step", "expected-nonce", "account", "password", "private-key", "rpc-url"])
      expect(() => resolveCommand([...session, `--${flag}`, "override"])).toThrow();
    expect(() => resolveCommand([...base, "--mode", "broadcast-creates", ...files])).toThrow("envelope");
  });
  it("separates read-only Safe export, receipt adoption, and explicit dead-lock recovery", () => {
    for (const mode of ["export-safe", "adopt"])
      expect(() =>
        resolveCommand([
          ...base,
          "--mode",
          mode,
          ...execution,
          ...(mode === "adopt" ? ["--receipt", `0x${"a".repeat(64)}`] : []),
        ]),
      ).not.toThrow();
    expect(() => resolveCommand([...base, "--mode", "broadcast", ...execution, "--recover-lock"])).toThrow();
    expect(() => resolveCommand([...base, "--mode", "adopt", ...execution, "--recover-lock"])).toThrow();
    expect(() =>
      resolveCommand([...base, "--mode", "adopt", ...execution, "--receipt", `0x${"a".repeat(64)}`, "--recover-lock"]),
    ).not.toThrow();
  });
  it("rejects execution inputs in planning modes and missing boundary fields", () => {
    expect(() => resolveCommand([...base, "--mode", "preflight", "--envelope", "x.json"])).toThrow();
    expect(() => resolveCommand([...base, "--mode", "plan", "--step", "1"])).toThrow();
    expect(() => resolveCommand([...base, "--mode", "simulate", ...files])).toThrow();
    expect(() => resolveCommand([...base, "--mode", "broadcast", ...files])).toThrow();
    expect(() =>
      resolveCommand([...base, "--mode", "broadcast", ...execution, "--receipt", `0x${"a".repeat(64)}`]),
    ).toThrow();
    expect(() =>
      resolveCommand([...base, "--mode", "export-safe", ...execution, "--expected-nonce", "1040"]),
    ).toThrow();
  });
});
