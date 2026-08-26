/**
 * @vitest-environment jsdom
 */

import { describe, expect, it } from "vitest";

import {
  deriveKarmaIntegrationAuthorization,
  deriveKarmaIntegrationStatus,
  KARMA_SYNC_VERSION,
  type KarmaIntegrationDerivationInput,
} from "../../../hooks/garden/useKarmaIntegration";
import { KARMA_ACCOUNT_READ_ABI } from "../../../hooks/garden/karmaIntegration";
import type { Address } from "../../../types/domain";

const GARDEN = "0x1111111111111111111111111111111111111111" as Address;
const PROJECT_UID = `0x${"22".repeat(32)}` as const;

function input(
  overrides: Partial<KarmaIntegrationDerivationInput> = {}
): KarmaIntegrationDerivationInput {
  return {
    chainId: 42161,
    gardenAddress: GARDEN,
    supported: true,
    syncVersion: KARMA_SYNC_VERSION,
    isRetrying: false,
    projection: {
      projectUID: PROJECT_UID,
      projectState: "synced",
      projectReason: null,
      detailsState: "synced",
      detailsReason: null,
      membershipState: "synced",
      membershipReason: null,
      accessState: "synced",
      accessReason: null,
      projectUpdateState: "synced",
      projectUpdateReason: null,
      membershipPendingAccounts: [],
      membershipFailedAccounts: [],
      accessPendingAccounts: [],
      accessFailedAccounts: [],
      lastFailureReason: null,
      lastSyncAt: 1_000,
    },
    ...overrides,
  };
}

describe("deriveKarmaIntegrationStatus", () => {
  it("derives every operational state with deterministic priority", () => {
    expect(deriveKarmaIntegrationStatus(input({ supported: false })).status).toBe("unsupported");
    expect(deriveKarmaIntegrationStatus(input({ syncVersion: null })).status).toBe(
      "upgrade-needed"
    );
    expect(
      deriveKarmaIntegrationStatus(
        input({ projection: { ...input().projection, projectUID: null } })
      ).status
    ).toBe("no-project");
    expect(
      deriveKarmaIntegrationStatus(
        input({
          projection: {
            ...input().projection,
            detailsState: "pending",
            detailsReason: "Garden metadata changed",
          },
        })
      ).status
    ).toBe("stale-details");
    expect(
      deriveKarmaIntegrationStatus(
        input({
          projection: {
            ...input().projection,
            accessState: "pending",
            accessPendingAccounts: [GARDEN],
          },
        })
      ).status
    ).toBe("access-pending");
    expect(
      deriveKarmaIntegrationStatus(
        input({
          projection: {
            ...input().projection,
            accessState: "failed",
            accessReason: "ProjectResolver rejected access",
          },
        })
      ).status
    ).toBe("failed");
    expect(deriveKarmaIntegrationStatus(input({ isRetrying: true })).status).toBe("retrying");
    expect(deriveKarmaIntegrationStatus(input()).status).toBe("synced");
  });

  it("keeps version readiness ahead of projected failures", () => {
    const result = deriveKarmaIntegrationStatus(
      input({
        syncVersion: null,
        projection: {
          ...input().projection,
          accessState: "failed",
          accessReason: "Legacy failure",
        },
      })
    );

    expect(result.status).toBe("upgrade-needed");
    expect(result.syncVersion).toBeNull();
    expect(result.requiredSyncVersion).toBe(1);
  });

  it("builds the Karma profile URL from the canonical GardenAccount slug", () => {
    const result = deriveKarmaIntegrationStatus(input({ gardenSlug: "aiyeloja-family-garden" }));

    expect(result.profileUrl).toBe("https://www.karmahq.org/project/aiyeloja-family-garden");
  });

  it("treats unknown details and access projections as recovery work", () => {
    expect(
      deriveKarmaIntegrationStatus(
        input({ projection: { ...input().projection, detailsState: "unknown" } })
      ).status
    ).toBe("stale-details");
    expect(
      deriveKarmaIntegrationStatus(
        input({ projection: { ...input().projection, membershipState: "unknown" } })
      ).status
    ).toBe("access-pending");
    expect(
      deriveKarmaIntegrationStatus(
        input({ projection: { ...input().projection, accessState: "unknown" } })
      ).status
    ).toBe("access-pending");
  });

  it("surfaces status read errors before upgrade or project absence", () => {
    expect(
      deriveKarmaIntegrationStatus(
        input({
          syncVersion: null,
          readErrorReason: "karma_status_read_unavailable",
          projection: { ...input().projection, projectUID: null },
        })
      )
    ).toMatchObject({ status: "failed", reason: "karma_status_read_unavailable" });
  });

  it("uses the deployed uint32 karmaSyncVersion ABI", () => {
    const version = KARMA_ACCOUNT_READ_ABI.find((item) => item.name === "karmaSyncVersion");
    expect(version?.outputs[0]?.type).toBe("uint32");
  });

  it("surfaces the aspect-specific failure reason", () => {
    const result = deriveKarmaIntegrationStatus(
      input({
        projection: {
          ...input().projection,
          membershipState: "failed",
          membershipReason: "MemberOf attestation failed",
        },
      })
    );

    expect(result).toMatchObject({
      status: "failed",
      reason: "MemberOf attestation failed",
    });
  });
});

describe("deriveKarmaIntegrationAuthorization", () => {
  const OWNER = "0x3333333333333333333333333333333333333333" as Address;
  const STEWARD = "0x4444444444444444444444444444444444444444" as Address;

  it("allows owners and stewards to reconcile", () => {
    expect(
      deriveKarmaIntegrationAuthorization({
        primaryAddress: STEWARD,
        owners: [OWNER],
        stewards: [STEWARD],
      })
    ).toEqual({ canReconcile: true });
  });

  it("keeps read-only users from starting reconciliation", () => {
    expect(
      deriveKarmaIntegrationAuthorization({
        primaryAddress: OWNER,
        owners: [],
        stewards: [],
      })
    ).toEqual({ canReconcile: false });
    expect(
      deriveKarmaIntegrationAuthorization({
        primaryAddress: null,
        owners: [OWNER],
        stewards: [STEWARD],
      })
    ).toEqual({ canReconcile: false });
  });
});
