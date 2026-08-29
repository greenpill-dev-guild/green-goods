import { describe, expect, it } from "vitest";
import {
  PUBLIC_GARDEN_IMPACT_DOMAINS,
  type PublicGardenImpactResponseV1,
} from "../public-contracts/garden-impact";
import {
  PublicGardenImpactNotFoundError,
  PublicGardenImpactProviderError,
  type PublicGardenImpactReaders,
  loadPublicGardenImpactSnapshot,
} from "../modules/data/public-garden-impact";

const gardenAddress = "0x1111111111111111111111111111111111111111";
const otherAddress = "0x2222222222222222222222222222222222222222";
const now = Date.UTC(2026, 7, 28, 12);

function readers(overrides: Partial<PublicGardenImpactReaders> = {}): PublicGardenImpactReaders {
  return {
    readGarden: async () => ({
      id: gardenAddress,
      name: "Sun Garden",
      location: "Lisbon",
    }),
    readWorks: async () => [
      {
        id: "0xwork-b",
        actionUID: 2,
        title: "Installed panels",
        feedback: "Six panels are producing power.",
        media: ["ipfs://panel"],
        createdAt: 300,
      },
      {
        id: "0xwork-a",
        actionUID: 1,
        title: "Planted trees",
        feedback: "",
        media: [],
        createdAt: 200,
      },
    ],
    readApprovals: async () => [
      { id: "0xapproval-1", workUID: "0xwork-b", approved: true, createdAt: 320 },
      { id: "0xapproval-2", workUID: "0xwork-b", approved: false, createdAt: 340 },
      { id: "0xapproval-3", workUID: "0xwork-b", approved: true, createdAt: 330 },
      { id: "0xapproval-4", workUID: "0xwork-a", approved: false, createdAt: 210 },
    ],
    readActions: async () => [
      { id: "11155111-1", title: "Tree planting", domain: "agroforestry" },
      { id: "11155111-2", title: "Solar installation", domain: "solar" },
    ],
    readAssessments: async () => [
      { id: "0xassessment", createdAt: 250 },
      { id: "0xASSESSMENT", createdAt: 250 },
    ],
    readCertificates: async () => [
      { id: "11155111-1", status: "active", mintedAt: 400, updatedAt: 400 },
      { id: "11155111-1", status: "claimed", mintedAt: 400, updatedAt: 450 },
      { id: "11155111-2", status: "unknown", mintedAt: 500, updatedAt: 500 },
    ],
    ...overrides,
  };
}

async function load(overrides: Partial<PublicGardenImpactReaders> = {}) {
  return loadPublicGardenImpactSnapshot(
    { chainId: 11155111, gardenAddress, recentLimit: 12 },
    { readers: readers(overrides), now: () => now }
  );
}

describe("public garden impact aggregation", () => {
  it("publishes a fixed domain contract", () => {
    expect(PUBLIC_GARDEN_IMPACT_DOMAINS).toEqual(["solar", "agroforestry", "education", "waste"]);
  });

  it("aggregates protocol approvals without treating a later rejection as erasure", async () => {
    const snapshot = await load();

    expect(snapshot).toMatchObject<Partial<PublicGardenImpactResponseV1>>({
      version: 1,
      ok: true,
      garden: {
        chainId: 11155111,
        address: gardenAddress,
        name: "Sun Garden",
        location: "Lisbon",
        url: `https://agent.greengoods.app/public/gardens/11155111/${gardenAddress}/impact`,
      },
      summary: {
        submittedWorkCount: 2,
        approvedWorkCount: 1,
        assessmentCount: 1,
        impactCertificateCount: 1,
        latestKnownActivityAt: new Date(500_000).toISOString(),
      },
      provenance: {
        status: "ready",
        partialData: false,
        unavailableSources: [],
        fetchedAt: new Date(now).toISOString(),
      },
    });
    expect(snapshot.recentWork).toEqual([
      {
        id: "0xwork-b",
        title: "Installed panels",
        description: "Six panels are producing power.",
        media: ["ipfs://panel"],
        actionUid: 2,
        action: {
          id: "11155111-2",
          title: "Solar installation",
          domain: "solar",
        },
        createdAt: new Date(300_000).toISOString(),
        approvedAt: new Date(330_000).toISOString(),
      },
    ]);
  });

  it("keeps same-address public resource URLs distinct across chains", async () => {
    const arbitrum = await loadPublicGardenImpactSnapshot(
      { chainId: 42161, gardenAddress, recentLimit: 3 },
      { readers: readers(), now: () => now }
    );
    const celo = await loadPublicGardenImpactSnapshot(
      { chainId: 42220, gardenAddress, recentLimit: 3 },
      { readers: readers(), now: () => now }
    );

    expect(arbitrum.garden.url).toBe(
      `https://agent.greengoods.app/public/gardens/42161/${gardenAddress}/impact`
    );
    expect(celo.garden.url).toBe(
      `https://agent.greengoods.app/public/gardens/42220/${gardenAddress}/impact`
    );
    expect(arbitrum.garden.url).not.toBe(celo.garden.url);
  });

  it("keeps known-domain and action breakdowns deterministic", async () => {
    const snapshot = await load();

    expect(snapshot.breakdown.byDomain).toEqual([
      { domain: "solar", submittedWorkCount: 1, approvedWorkCount: 1 },
      { domain: "agroforestry", submittedWorkCount: 1, approvedWorkCount: 0 },
      { domain: "education", submittedWorkCount: 0, approvedWorkCount: 0 },
      { domain: "waste", submittedWorkCount: 0, approvedWorkCount: 0 },
    ]);
    expect(snapshot.breakdown.byAction?.map((item) => item.actionUid)).toEqual([1, 2]);
  });

  it("returns nullable dependent fields and partial provenance for unavailable sources", async () => {
    const snapshot = await load({
      readApprovals: async () => {
        throw new Error("missing schema");
      },
      readActions: async () => {
        throw new Error("indexer unavailable");
      },
    });

    expect(snapshot.summary.approvedWorkCount).toBeNull();
    expect(snapshot.recentWork).toBeNull();
    expect(snapshot.breakdown).toEqual({
      byDomain: null,
      byAction: [
        {
          actionUid: 1,
          actionId: "11155111-1",
          title: null,
          domain: null,
          submittedWorkCount: 1,
          approvedWorkCount: null,
        },
        {
          actionUid: 2,
          actionId: "11155111-2",
          title: null,
          domain: null,
          submittedWorkCount: 1,
          approvedWorkCount: null,
        },
      ],
    });
    expect(snapshot.provenance).toMatchObject({
      status: "partial",
      partialData: true,
      unavailableSources: ["approvals", "actions"],
    });
  });

  it("marks a missing Assessment schema as partial without hiding other counts", async () => {
    const snapshot = await load({
      readAssessments: async () => {
        throw new Error("missing schema");
      },
    });

    expect(snapshot.summary).toMatchObject({
      submittedWorkCount: 2,
      approvedWorkCount: 1,
      assessmentCount: null,
      impactCertificateCount: 1,
    });
    expect(snapshot.provenance).toMatchObject({
      status: "partial",
      partialData: true,
      unavailableSources: ["assessments"],
    });
  });

  it("preserves by-action counts when only Action metadata is unavailable", async () => {
    const snapshot = await load({
      readActions: async () => {
        throw new Error("indexer unavailable");
      },
    });

    expect(snapshot.breakdown.byDomain).toBeNull();
    expect(snapshot.breakdown.byAction).toEqual([
      {
        actionUid: 1,
        actionId: "11155111-1",
        title: null,
        domain: null,
        submittedWorkCount: 1,
        approvedWorkCount: 0,
      },
      {
        actionUid: 2,
        actionId: "11155111-2",
        title: null,
        domain: null,
        submittedWorkCount: 1,
        approvedWorkCount: 1,
      },
    ]);
  });

  it("retains unresolved work in totals and by-action while excluding it from domains", async () => {
    const snapshot = await load({
      readWorks: async () => [
        {
          id: "0xwork-unresolved",
          actionUID: 99,
          title: "Other work",
          feedback: "",
          media: [],
          createdAt: 600,
        },
      ],
      readApprovals: async () => [
        {
          id: "0xapproval-unresolved",
          workUID: "0xwork-unresolved",
          approved: true,
          createdAt: 610,
        },
      ],
    });

    expect(snapshot.summary.submittedWorkCount).toBe(1);
    expect(snapshot.breakdown.byDomain?.every((item) => item.submittedWorkCount === 0)).toBe(true);
    expect(snapshot.breakdown.byAction).toEqual([
      {
        actionUid: 99,
        actionId: "11155111-99",
        title: null,
        domain: null,
        submittedWorkCount: 1,
        approvedWorkCount: 1,
      },
    ]);
  });

  it("returns empty only when every source is available and empty", async () => {
    const snapshot = await load({
      readWorks: async () => [],
      readApprovals: async () => [],
      readActions: async () => [],
      readAssessments: async () => [],
      readCertificates: async () => [],
    });

    expect(snapshot.provenance.status).toBe("empty");
    expect(snapshot.summary.latestKnownActivityAt).toBeNull();
  });

  it("orders equal-time recent Work by UID ascending", async () => {
    const snapshot = await load({
      readWorks: async () => [
        {
          id: "0xwork-b",
          actionUID: 2,
          title: "Second UID",
          feedback: "",
          media: [],
          createdAt: 600,
        },
        {
          id: "0xwork-a",
          actionUID: 1,
          title: "First UID",
          feedback: "",
          media: [],
          createdAt: 600,
        },
      ],
      readApprovals: async () => [
        { id: "0xapproval-b", workUID: "0xwork-b", approved: true, createdAt: 610 },
        { id: "0xapproval-a", workUID: "0xwork-a", approved: true, createdAt: 610 },
      ],
    });

    expect(snapshot.recentWork?.map((work) => work.id)).toEqual(["0xwork-a", "0xwork-b"]);
  });

  it("uses the latest certificate lifecycle update for status and activity", async () => {
    const snapshot = await load({
      readWorks: async () => [],
      readApprovals: async () => [],
      readActions: async () => [],
      readAssessments: async () => [],
      readCertificates: async () => [
        { id: "11155111-7", status: "active", mintedAt: 400, updatedAt: 400 },
        { id: "11155111-7", status: "claimed", mintedAt: 400, updatedAt: 650 },
      ],
    });

    expect(snapshot.summary.impactCertificateCount).toBe(1);
    expect(snapshot.summary.latestKnownActivityAt).toBe(new Date(650_000).toISOString());
  });

  it("fails when every primary impact source is unavailable", async () => {
    const unavailable = async () => Promise.reject(new Error("offline"));
    await expect(
      load({
        readWorks: unavailable,
        readAssessments: unavailable,
        readCertificates: unavailable,
      })
    ).rejects.toBeInstanceOf(PublicGardenImpactProviderError);
  });

  it("uses the same not-found error for missing and non-public gardens", async () => {
    await expect(load({ readGarden: async () => null })).rejects.toBeInstanceOf(
      PublicGardenImpactNotFoundError
    );
    await expect(
      load({
        readGarden: async () => ({ id: otherAddress, name: "", location: "" }),
      })
    ).rejects.toBeInstanceOf(PublicGardenImpactNotFoundError);
  });

  it("hides curated gardens and fails closed when Garden resolution throws", async () => {
    const hiddenAddress = "0xf401f34378384713222d1d21f63359cc4E8a858a";
    await expect(
      loadPublicGardenImpactSnapshot(
        { chainId: 11155111, gardenAddress: hiddenAddress, recentLimit: 3 },
        {
          readers: readers({
            readGarden: async () => ({
              id: hiddenAddress,
              name: "Green Goods Community Garden",
              location: "Online",
            }),
          }),
          now: () => now,
        }
      )
    ).rejects.toBeInstanceOf(PublicGardenImpactNotFoundError);

    await expect(
      load({
        readGarden: async () => {
          throw new Error("indexer unavailable");
        },
      })
    ).rejects.toBeInstanceOf(PublicGardenImpactProviderError);
  });

  it("does not expose actor identities from source records", async () => {
    const serialized = JSON.stringify(await load());
    expect(serialized).not.toContain("gardenerAddress");
    expect(serialized).not.toContain("stewardAddress");
    expect(serialized).not.toContain("authorAddress");
  });
});
