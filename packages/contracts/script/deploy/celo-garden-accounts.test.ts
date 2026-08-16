import { describe, expect, it } from "vitest";

import initializationEvidence from "../../../../.plans/active/celo-garden-account-safe-ownership/evidence/garden-account-initializers-42161-494723355.json";
import dependencyEvidence from "../../../../.plans/active/celo-garden-account-safe-ownership/evidence/deterministic-deployments-42161-2026-02-19.json";
import rawDependencyEvidence from "../../../../.plans/active/celo-garden-account-safe-ownership/evidence/celo-dependency-init-code-2026-08-15.json";
import {
  buildAccountInitializations,
  validateRawDependencies,
  type GardenInitializationEntry,
} from "./celo-garden-accounts";

describe("Celo GardenAccount deployment planning", () => {
  it("rebuilds all 18 exact initializer hashes and lengths", () => {
    const accounts = buildAccountInitializations(
      initializationEvidence as {
        implementation: string;
        registry: string;
        salt: string;
        gardenToken: string;
        entries: GardenInitializationEntry[];
      },
    );

    expect(accounts).toHaveLength(18);
    expect(accounts.map((entry) => entry.tokenId)).toEqual([...Array(18).keys()]);
    expect(accounts[0].initializerHash).toBe("0xe6f82e595108509c769b3d069259400aa54afdab380ceee308f2c24a8e2f4269");
    expect(accounts[17].initializerHash).toBe("0xdd63b149db5130d61f196c6e6130128053bf0569afc0d70117a4c742d0cd71e2");
  });

  it("rejects a raw dependency bundle whose entry count is not five", () => {
    expect(() =>
      validateRawDependencies(
        dependencyEvidence as never,
        {
          schemaVersion: 1,
          repositoryCommit: "175469f2fc699712a9fa8016d6aa25390282989d",
          dependencies: [],
        } as never,
      ),
    ).toThrow("five reviewed CREATE2 inputs");
  });

  it("rejects raw init code that does not reproduce the recovered transaction", () => {
    const dependencies = rawDependencyEvidence.dependencies.map((dependency) => ({ ...dependency }));
    const original = dependencies[0].initCode;
    dependencies[0].initCode = `0x${original.slice(2, 4) === "00" ? "01" : "00"}${original.slice(4)}`;

    expect(() =>
      validateRawDependencies(dependencyEvidence as never, { ...rawDependencyEvidence, dependencies } as never),
    ).toThrow("Raw CREATE2 input for resolverStub does not match the recovered Arbitrum transaction");
  });

  it("rejects any change to the frozen foreign token tuple", () => {
    expect(() =>
      buildAccountInitializations({
        ...(initializationEvidence as {
          implementation: string;
          registry: string;
          salt: string;
          gardenToken: string;
          entries: GardenInitializationEntry[];
        }),
        gardenToken: "0x0000000000000000000000000000000000000001",
      }),
    ).toThrow("frozen identity tuple");
  });
});
