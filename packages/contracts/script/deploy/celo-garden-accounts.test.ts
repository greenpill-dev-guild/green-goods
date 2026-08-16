import { describe, expect, it } from "vitest";

import initializationEvidence from "../../../../.plans/active/celo-garden-account-safe-ownership/evidence/garden-account-initializers-42161-494723355.json";
import dependencyEvidence from "../../../../.plans/active/celo-garden-account-safe-ownership/evidence/deterministic-deployments-42161-2026-02-19.json";
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

  it("rejects raw init code that does not reproduce the recovered transaction", () => {
    expect(() =>
      validateRawDependencies(
        dependencyEvidence as never,
        {
          schemaVersion: 1,
          repositoryCommit: "175469f2fc699712a9fa8016d6aa25390282989d",
          dependencies: [
            {
              name: "resolverStub",
              sourceTransactionHash: dependencyEvidence.resolverStub.transactionHash,
              salt: dependencyEvidence.resolverStub.salt,
              initCode: "0x00",
            },
          ],
        } as never,
      ),
    ).toThrow("five reviewed CREATE2 inputs");
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
