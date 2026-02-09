import { describe, it, expect } from "vitest";
import {
  formatHypercertMetadata,
  buildContributorWeights,
} from "../../../lib/hypercerts/metadata";
import type {
  AllowlistEntry,
  HypercertAttestation,
  HypercertDraft,
} from "../../../types/hypercerts";
import { DEFAULT_PROTOCOL_VERSION } from "../../../lib/hypercerts/constants";

// ============================================
// Test Helpers
// ============================================

function createMockAttestation(
  overrides: Partial<HypercertAttestation> = {}
): HypercertAttestation {
  return {
    id: `attestation-${Math.random().toString(36).slice(2)}`,
    workUid: `work-${Math.random().toString(36).slice(2)}`,
    gardenId: "garden-1",
    title: "Test Work",
    workScope: ["gardening", "planting"],
    gardenerAddress: "0x0000000000000000000000000000000000000001",
    mediaUrls: [],
    createdAt: 1704067200, // 2024-01-01
    approvedAt: 1704153600, // 2024-01-02
    domain: "agroforestry",
    ...overrides,
  };
}

function createMockDraft(overrides: Partial<HypercertDraft> = {}): HypercertDraft {
  return {
    id: "draft-123",
    gardenId: "garden-1",
    operatorAddress: "0x0000000000000000000000000000000000000001",
    stepNumber: 1,
    attestationIds: ["attestation-1"],
    title: "Test Hypercert",
    description: "A test hypercert description",
    workScopes: [],
    impactScopes: [],
    workTimeframeStart: 0,
    workTimeframeEnd: 0,
    impactTimeframeStart: 0,
    impactTimeframeEnd: null,
    sdgs: [13, 15],
    capitals: ["living", "social"],
    outcomes: { predefined: {}, custom: {} },
    allowlist: [],
    externalUrl: "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

function createAllowlistEntry(
  address: string,
  units: bigint,
  label?: string
): AllowlistEntry {
  return { address: address as `0x${string}`, units, label };
}

// ============================================
// formatHypercertMetadata Tests
// ============================================

describe("formatHypercertMetadata", () => {
  describe("basic metadata formatting", () => {
    it("uses draft title and description", () => {
      const draft = createMockDraft({
        title: "My Hypercert Title",
        description: "My detailed description",
      });
      const attestations = [createMockAttestation()];

      const result = formatHypercertMetadata({ draft, attestations });

      expect(result.name).toBe("My Hypercert Title");
      expect(result.description).toBe("My detailed description");
    });

    it("generates fallback image when imageUri not provided", () => {
      const draft = createMockDraft({ title: "Test Hypercert" });
      const attestations = [createMockAttestation()];

      const result = formatHypercertMetadata({ draft, attestations });

      expect(result.image).toContain("data:image/svg+xml");
      // URL-encoded SVG should contain the title when decoded
      const decodedSvg = decodeURIComponent(result.image);
      expect(decodedSvg).toContain("Test Hypercert");
    });

    it("uses provided imageUri", () => {
      const draft = createMockDraft();
      const attestations = [createMockAttestation()];
      const imageUri = "ipfs://QmTest123";

      const result = formatHypercertMetadata({ draft, attestations, imageUri });

      expect(result.image).toBe(imageUri);
    });

    it("includes garden name in fallback image", () => {
      const draft = createMockDraft({ title: "Test" });
      const attestations = [createMockAttestation()];
      const gardenName = "My Beautiful Garden";

      const result = formatHypercertMetadata({
        draft,
        attestations,
        gardenName,
      });

      // URL-encoded SVG should contain the garden name when decoded
      const decodedSvg = decodeURIComponent(result.image);
      expect(decodedSvg).toContain(gardenName);
    });

    it("includes external_url when provided", () => {
      const draft = createMockDraft({ externalUrl: "https://example.com" });
      const attestations = [createMockAttestation()];

      const result = formatHypercertMetadata({ draft, attestations });

      expect(result.external_url).toBe("https://example.com");
    });

    it("trims external_url whitespace", () => {
      const draft = createMockDraft({ externalUrl: "  https://example.com  " });
      const attestations = [createMockAttestation()];

      const result = formatHypercertMetadata({ draft, attestations });

      expect(result.external_url).toBe("https://example.com");
    });

    it("omits external_url when empty", () => {
      const draft = createMockDraft({ externalUrl: "   " });
      const attestations = [createMockAttestation()];

      const result = formatHypercertMetadata({ draft, attestations });

      expect(result.external_url).toBeUndefined();
    });
  });

  describe("work scope handling", () => {
    it("uses draft workScopes when provided", () => {
      const draft = createMockDraft({ workScopes: ["custom-scope", "another"] });
      const attestations = [createMockAttestation({ workScope: ["from-attestation"] })];

      const result = formatHypercertMetadata({ draft, attestations });

      expect(result.hypercert.work_scope.value).toContain("custom-scope");
      expect(result.hypercert.work_scope.value).toContain("another");
    });

    it("derives workScopes from attestations when draft is empty", () => {
      const draft = createMockDraft({ workScopes: [] });
      const attestations = [
        createMockAttestation({ workScope: ["gardening"] }),
        createMockAttestation({ workScope: ["planting", "gardening"] }),
      ];

      const result = formatHypercertMetadata({ draft, attestations });

      // Should include unique scopes from attestations
      expect(result.hypercert.work_scope.value).toContain("gardening");
      expect(result.hypercert.work_scope.value).toContain("planting");
    });
  });

  describe("impact scope handling", () => {
    it("uses draft impactScopes when provided", () => {
      const draft = createMockDraft({ impactScopes: ["environment", "community"] });
      const attestations = [createMockAttestation()];

      const result = formatHypercertMetadata({ draft, attestations });

      expect(result.hypercert.impact_scope.value).toContain("environment");
      expect(result.hypercert.impact_scope.value).toContain("community");
    });

    it("defaults to 'all' when impactScopes empty", () => {
      const draft = createMockDraft({ impactScopes: [] });
      const attestations = [createMockAttestation()];

      const result = formatHypercertMetadata({ draft, attestations });

      expect(result.hypercert.impact_scope.value).toContain("all");
    });
  });

  describe("timeframe handling", () => {
    it("uses draft timeframes when provided", () => {
      const draft = createMockDraft({
        workTimeframeStart: 1700000000,
        workTimeframeEnd: 1704067200,
        impactTimeframeStart: 1700000000,
        impactTimeframeEnd: 1710000000,
      });
      const attestations = [createMockAttestation()];

      const result = formatHypercertMetadata({ draft, attestations });

      expect(result.hypercert.work_timeframe.value[0]).toBe(1700000000);
      expect(result.hypercert.work_timeframe.value[1]).toBe(1704067200);
      expect(result.hypercert.impact_timeframe.value[0]).toBe(1700000000);
      expect(result.hypercert.impact_timeframe.value[1]).toBe(1710000000);
    });

    it("derives timeframes from attestations when draft is 0", () => {
      const draft = createMockDraft({
        workTimeframeStart: 0,
        workTimeframeEnd: 0,
      });
      const attestations = [
        createMockAttestation({ createdAt: 1704067200, approvedAt: 1704153600 }),
        createMockAttestation({ createdAt: 1703980800, approvedAt: 1704240000 }),
      ];

      const result = formatHypercertMetadata({ draft, attestations });

      // Should use earliest createdAt and latest approvedAt
      expect(result.hypercert.work_timeframe.value[0]).toBe(1703980800);
      expect(result.hypercert.work_timeframe.value[1]).toBe(1704240000);
    });

    it("handles indefinite impact timeframe (end = 0)", () => {
      const draft = createMockDraft({
        impactTimeframeEnd: null,
      });
      const attestations = [createMockAttestation()];

      const result = formatHypercertMetadata({ draft, attestations });

      // Indefinite end should be 0
      expect(result.hypercert.impact_timeframe.value[1]).toBe(0);
    });
  });

  describe("contributors handling", () => {
    it("uses allowlist addresses when provided", () => {
      const draft = createMockDraft();
      const attestations = [createMockAttestation()];
      const allowlist = [
        createAllowlistEntry("0x1111111111111111111111111111111111111111", 50_000_000n),
        createAllowlistEntry("0x2222222222222222222222222222222222222222", 50_000_000n),
      ];

      const result = formatHypercertMetadata({ draft, attestations, allowlist });

      expect(result.hypercert.contributors.value).toContain(
        "0x1111111111111111111111111111111111111111"
      );
      expect(result.hypercert.contributors.value).toContain(
        "0x2222222222222222222222222222222222222222"
      );
    });

    it("uses attestation gardener addresses when no allowlist", () => {
      const draft = createMockDraft();
      const attestations = [
        createMockAttestation({ gardenerAddress: "0x1111111111111111111111111111111111111111" }),
        createMockAttestation({ gardenerAddress: "0x2222222222222222222222222222222222222222" }),
      ];

      const result = formatHypercertMetadata({ draft, attestations });

      expect(result.hypercert.contributors.value).toContain(
        "0x1111111111111111111111111111111111111111"
      );
      expect(result.hypercert.contributors.value).toContain(
        "0x2222222222222222222222222222222222222222"
      );
    });

    it("deduplicates contributor addresses", () => {
      const draft = createMockDraft();
      const attestations = [
        createMockAttestation({ gardenerAddress: "0x1111111111111111111111111111111111111111" }),
        createMockAttestation({ gardenerAddress: "0x1111111111111111111111111111111111111111" }),
        createMockAttestation({ gardenerAddress: "0x2222222222222222222222222222222222222222" }),
      ];

      const result = formatHypercertMetadata({ draft, attestations });

      // Should only have 2 unique contributors
      expect(result.hypercert.contributors.value).toHaveLength(2);
    });
  });

  describe("rights handling", () => {
    it("defaults to Public Display", () => {
      const draft = createMockDraft();
      const attestations = [createMockAttestation()];

      const result = formatHypercertMetadata({ draft, attestations });

      expect(result.hypercert.rights.value).toContain("Public Display");
    });
  });

  describe("hidden_properties (Green Goods extension)", () => {
    it("includes gardenId from draft", () => {
      const draft = createMockDraft({ gardenId: "my-garden-id" });
      const attestations = [createMockAttestation()];

      const result = formatHypercertMetadata({ draft, attestations });

      expect(result.hidden_properties?.gardenId).toBe("my-garden-id");
    });

    it("includes attestation refs", () => {
      const draft = createMockDraft();
      const attestations = [
        createMockAttestation({ id: "0x1234", title: "Work 1", domain: "agroforestry" }),
        createMockAttestation({ id: "0x5678", title: "Work 2", domain: "education" }),
      ];

      const result = formatHypercertMetadata({ draft, attestations });

      expect(result.hidden_properties?.attestationRefs).toHaveLength(2);
      expect(result.hidden_properties?.attestationRefs[0].uid).toBe("0x1234");
      expect(result.hidden_properties?.attestationRefs[0].title).toBe("Work 1");
      expect(result.hidden_properties?.attestationRefs[0].domain).toBe("agroforestry");
    });

    it("includes SDGs from draft", () => {
      const draft = createMockDraft({ sdgs: [1, 13, 15] });
      const attestations = [createMockAttestation()];

      const result = formatHypercertMetadata({ draft, attestations });

      expect(result.hidden_properties?.sdgs).toEqual([1, 13, 15]);
    });

    it("includes capitals from draft", () => {
      const draft = createMockDraft({ capitals: ["living", "social", "financial"] });
      const attestations = [createMockAttestation()];

      const result = formatHypercertMetadata({ draft, attestations });

      expect(result.hidden_properties?.capitals).toEqual(["living", "social", "financial"]);
    });

    it("uses draft outcomes when predefined metrics exist", () => {
      const draft = createMockDraft({
        outcomes: {
          predefined: {
            trees_planted: {
              value: 100,
              unit: "trees",
              aggregation: "sum",
              label: "Trees Planted",
            },
          },
          custom: {},
        },
      });
      const attestations = [createMockAttestation()];

      const result = formatHypercertMetadata({ draft, attestations });

      expect(result.hidden_properties?.outcomes.predefined.trees_planted).toBeDefined();
      expect(result.hidden_properties?.outcomes.predefined.trees_planted.value).toBe(100);
    });

    it("aggregates outcomes from attestations when draft is empty", () => {
      const draft = createMockDraft({
        outcomes: { predefined: {}, custom: {} },
      });
      const attestations = [
        createMockAttestation({
          metrics: { trees: { value: 10, unit: "count" } },
        }),
        createMockAttestation({
          metrics: { trees: { value: 20, unit: "count" } },
        }),
      ];

      const result = formatHypercertMetadata({ draft, attestations });

      // Should aggregate metrics from attestations
      expect(result.hidden_properties?.outcomes.predefined.trees).toBeDefined();
      expect(result.hidden_properties?.outcomes.predefined.trees.value).toBe(30);
    });

    it("derives domain from first attestation", () => {
      const draft = createMockDraft();
      const attestations = [
        createMockAttestation({ domain: "education" }),
        createMockAttestation({ domain: "agroforestry" }),
      ];

      const result = formatHypercertMetadata({ draft, attestations });

      expect(result.hidden_properties?.domain).toBe("education");
    });

    it("defaults domain to mutual_credit when not found", () => {
      const draft = createMockDraft();
      const attestations = [
        createMockAttestation({ domain: undefined }),
      ];

      const result = formatHypercertMetadata({ draft, attestations });

      expect(result.hidden_properties?.domain).toBe("mutual_credit");
    });

    it("includes protocol version", () => {
      const draft = createMockDraft();
      const attestations = [createMockAttestation()];

      const result = formatHypercertMetadata({ draft, attestations });

      expect(result.hidden_properties?.protocolVersion).toBe(DEFAULT_PROTOCOL_VERSION);
    });
  });
});

// ============================================
// buildContributorWeights Tests
// ============================================

describe("buildContributorWeights", () => {
  it("returns empty array for no attestations", () => {
    const result = buildContributorWeights([]);
    expect(result).toEqual([]);
  });

  it("builds weights for single contributor", () => {
    const attestations = [
      createMockAttestation({
        gardenerAddress: "0x0000000000000000000000000000000000000001",
        gardenerName: "Alice",
        metrics: { value: { value: 100, unit: "units" } },
      }),
    ];

    const result = buildContributorWeights(attestations);

    expect(result).toHaveLength(1);
    expect(result[0].address).toBe("0x0000000000000000000000000000000000000001");
    expect(result[0].label).toBe("Alice");
    expect(result[0].actionCount).toBe(1);
    expect(result[0].actionValue).toBe(100);
  });

  it("aggregates stats for same contributor", () => {
    const attestations = [
      createMockAttestation({
        gardenerAddress: "0x0000000000000000000000000000000000000001",
        metrics: { value: { value: 50, unit: "units" } },
      }),
      createMockAttestation({
        gardenerAddress: "0x0000000000000000000000000000000000000001",
        metrics: { value: { value: 30, unit: "units" } },
      }),
    ];

    const result = buildContributorWeights(attestations);

    expect(result).toHaveLength(1);
    expect(result[0].actionCount).toBe(2);
    expect(result[0].actionValue).toBe(80);
  });

  it("separates different contributors", () => {
    const attestations = [
      createMockAttestation({
        gardenerAddress: "0x0000000000000000000000000000000000000001",
        gardenerName: "Alice",
        metrics: { value: { value: 100, unit: "units" } },
      }),
      createMockAttestation({
        gardenerAddress: "0x0000000000000000000000000000000000000002",
        gardenerName: "Bob",
        metrics: { value: { value: 200, unit: "units" } },
      }),
    ];

    const result = buildContributorWeights(attestations);

    expect(result).toHaveLength(2);
    const alice = result.find((c) => c.label === "Alice");
    const bob = result.find((c) => c.label === "Bob");
    expect(alice?.actionValue).toBe(100);
    expect(bob?.actionValue).toBe(200);
  });

  it("handles attestations without metrics", () => {
    const attestations = [
      createMockAttestation({
        gardenerAddress: "0x0000000000000000000000000000000000000001",
        metrics: null,
      }),
    ];

    const result = buildContributorWeights(attestations);

    expect(result[0].actionCount).toBe(1);
    expect(result[0].actionValue).toBe(0);
  });
});
