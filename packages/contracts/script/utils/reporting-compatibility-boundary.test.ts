import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertReportingFixtureRpc,
  reportingCompatibilityOptions,
  reportingFixtureArtifact,
} from "./reporting-compatibility-boundary";

describe("reporting fork proof isolation", () => {
  it("accepts only the Arbitrum simulation entry point", () => {
    expect(() => reportingCompatibilityOptions(["--network", "arbitrum", "--simulate"])).not.toThrow();
    for (const input of [
      ["--network", "arbitrum", "--broadcast"],
      ["--network", "sepolia", "--simulate"],
      ["--network", "arbitrum", "--simulate", "--private-key", "supplied"],
      [],
    ])
      expect(() => reportingCompatibilityOptions(input)).toThrow();
  });
  it("confines fixture signing to a credential-free literal loopback port", () => {
    expect(() => assertReportingFixtureRpc("http://127.0.0.1:18549")).not.toThrow();
    for (const rpc of [
      "https://arbitrum.io",
      "http://localhost:18549",
      "http://127.0.0.1",
      "http://127.0.0.1:18549?redirect=rpc",
      "http://user:password@127.0.0.1:18549",
      "http://127.0.0.1:18549/forward",
    ])
      expect(() => assertReportingFixtureRpc(rpc)).toThrow("isolated");
  });
  it("refuses malformed or missing compiled fixture bytecode", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "reporting-fixture-"));
    try {
      const directory = path.join(root, ".generated/foundry/out/production/ReportingKernelFixtures.s.sol");
      fs.mkdirSync(directory, { recursive: true });
      const file = path.join(directory, "ReportingFixtureEAS.json");
      fs.writeFileSync(file, JSON.stringify({ abi: [], bytecode: { object: "0x" } }));
      expect(() => reportingFixtureArtifact(root, "ReportingFixtureEAS")).toThrow("Invalid");
      expect(() => reportingFixtureArtifact(root, "ReportingFixturePaymaster")).toThrow();
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
  it("loads guard artifacts separately from test-only EAS and sponsorship fixtures", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "reporting-artifact-"));
    try {
      const directory = path.join(root, ".generated/foundry/out/production/SingleAttestationPolicy.sol");
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(
        path.join(directory, "SingleAttestationPolicy.json"),
        JSON.stringify({ abi: [], bytecode: { object: "0x6000" } }),
      );
      expect(reportingFixtureArtifact(root, "SingleAttestationPolicy").bytecode).toBe("0x6000");
      expect(() => reportingFixtureArtifact(root, "ReportingFixtureEAS")).toThrow();
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
