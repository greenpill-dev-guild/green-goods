import { describe, expect, it } from "vitest";
import { targetBuildArguments } from "./build-target";

describe("Foundry target build boundary", () => {
  it("terminates variadic skip filters before source positions", () => {
    expect(targetBuildArguments(["src/modules/SingleAttestationPolicy.sol"])).toEqual([
      "forge",
      "build",
      "-q",
      "--skip",
      "test",
      "--skip",
      "script",
      "--",
      "src/modules/SingleAttestationPolicy.sol",
    ]);
  });
  it("includes requested scripts and excludes unrelated tests", () => {
    const args = targetBuildArguments([
      "script/ReportingKernelFixtures.s.sol",
      "src/modules/SingleAttestationPolicy.sol",
    ]);
    expect(args.slice(0, args.indexOf("--"))).toEqual(["forge", "build", "-q", "--skip", "test"]);
    expect(args.slice(args.indexOf("--") + 1)).toEqual([
      "script/ReportingKernelFixtures.s.sol",
      "src/modules/SingleAttestationPolicy.sol",
    ]);
  });
  it("includes requested tests without skipping their source bucket", () => {
    expect(targetBuildArguments(["test/unit/SingleAttestationPolicy.t.sol"], false)).toEqual([
      "forge",
      "build",
      "--skip",
      "script",
      "--",
      "test/unit/SingleAttestationPolicy.t.sol",
    ]);
    expect(
      targetBuildArguments(["test/X.t.sol", "script/Y.s.sol"], false).filter((arg) => arg === "--skip"),
    ).toHaveLength(0);
  });
  it("refuses missing source paths or injected tool options", () => {
    expect(() => targetBuildArguments([])).toThrow("Solidity paths");
    expect(() => targetBuildArguments(["--force.sol"])).toThrow("Solidity paths");
    expect(() => targetBuildArguments(["src/X.sol", "--private-key"])).toThrow("Solidity paths");
  });
});
