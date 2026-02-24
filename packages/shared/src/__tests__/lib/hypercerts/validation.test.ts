import { describe, it, expect } from "vitest";
import {
  allowlistEntrySchema,
  allowlistSchema,
  greenGoodsExtensionSchema,
  hypercertMetadataSchema,
  outcomeMetricsSchema,
  propertyDefinitionSchema,
  scopeDefinitionSchema,
  timeframeDefinitionSchema,
  attestationRefSchema,
  validateMetadata,
} from "../../../lib/hypercerts/validation";
import { TOTAL_UNITS } from "../../../lib/hypercerts/constants";

// ============================================
// Helper Functions
// ============================================

function createValidScopeDefinition() {
  return {
    name: "Work scope",
    value: ["gardening", "planting"],
    display_value: "Gardening, Planting",
  };
}

function createValidTimeframeDefinition() {
  return {
    name: "Work timeframe",
    value: [1704067200, 1704153600] as [number, number],
    display_value: "Jan 1, 2024 - Jan 2, 2024",
  };
}

function createValidOutcomeMetrics() {
  return {
    predefined: {
      trees_planted: {
        value: 100,
        unit: "trees",
        aggregation: "sum",
        label: "Trees Planted",
      },
    },
    custom: {},
  };
}

function createValidGreenGoodsExtension() {
  return {
    gardenId: "garden-123",
    attestationRefs: [
      {
        uid: "0x0000000000000000000000000000000000000000000000000000000000000001",
        title: "Work Approval 1",
        domain: "agroforestry",
      },
    ],
    sdgs: [13, 15],
    capitals: ["living", "social"],
    outcomes: createValidOutcomeMetrics(),
    domain: "agroforestry",
    protocolVersion: "1.0.0",
  };
}

function createValidHypercertMetadata() {
  // Note: The zod schema expects contributors and rights as ScopeDefinition,
  // but the SDK expects them as string arrays. This function creates data
  // that passes the Zod schema.
  return {
    name: "Test Hypercert",
    description: "Description of the hypercert",
    image: "ipfs://QmTest123",
    external_url: "https://example.com",
    hypercert: {
      work_scope: createValidScopeDefinition(),
      impact_scope: { name: "Impact scope", value: ["all"] },
      work_timeframe: createValidTimeframeDefinition(),
      impact_timeframe: {
        name: "Impact timeframe",
        value: [1704067200, 0] as [number, number],
        display_value: "Jan 1, 2024 - Indefinite",
      },
      contributors: { name: "Contributors", value: ["0x1234..."] },
      rights: { name: "Rights", value: ["Public Display"] },
    },
    hidden_properties: createValidGreenGoodsExtension(),
  };
}

// SDK-compatible metadata (for validateMetadata tests)
// The SDK expects contributors and rights as scope definitions (objects), not arrays
function createSDKCompatibleMetadata() {
  return {
    name: "Test Hypercert",
    description: "Description of the hypercert",
    image: "ipfs://QmTest123",
    external_url: "https://example.com",
    hypercert: {
      work_scope: createValidScopeDefinition(),
      impact_scope: { name: "Impact scope", value: ["all"] },
      work_timeframe: createValidTimeframeDefinition(),
      impact_timeframe: {
        name: "Impact timeframe",
        value: [1704067200, 0] as [number, number],
        display_value: "Jan 1, 2024 - Indefinite",
      },
      contributors: { name: "Contributors", value: ["0x0000000000000000000000000000000000000001"] },
      rights: { name: "Rights", value: ["Public Display"] },
    },
  };
}

// ============================================
// allowlistEntrySchema Tests
// ============================================

describe("allowlistEntrySchema", () => {
  it("validates correct entry", () => {
    const entry = {
      address: "0x0000000000000000000000000000000000000001",
      units: 1000n,
    };
    const result = allowlistEntrySchema.safeParse(entry);
    expect(result.success).toBe(true);
  });

  it("validates entry with optional label", () => {
    const entry = {
      address: "0x0000000000000000000000000000000000000001",
      units: 1000n,
      label: "Alice",
    };
    const result = allowlistEntrySchema.safeParse(entry);
    expect(result.success).toBe(true);
  });

  it("rejects invalid address format", () => {
    const entry = {
      address: "invalid-address",
      units: 1000n,
    };
    const result = allowlistEntrySchema.safeParse(entry);
    expect(result.success).toBe(false);
  });

  it("rejects address without 0x prefix", () => {
    const entry = {
      address: "0000000000000000000000000000000000000001",
      units: 1000n,
    };
    const result = allowlistEntrySchema.safeParse(entry);
    expect(result.success).toBe(false);
  });

  it("rejects address with wrong length", () => {
    const entry = {
      address: "0x001", // Too short
      units: 1000n,
    };
    const result = allowlistEntrySchema.safeParse(entry);
    expect(result.success).toBe(false);
  });

  it("rejects non-positive units", () => {
    const entry = {
      address: "0x0000000000000000000000000000000000000001",
      units: 0n,
    };
    const result = allowlistEntrySchema.safeParse(entry);
    expect(result.success).toBe(false);
  });

  it("rejects negative units", () => {
    const entry = {
      address: "0x0000000000000000000000000000000000000001",
      units: -100n,
    };
    const result = allowlistEntrySchema.safeParse(entry);
    expect(result.success).toBe(false);
  });
});

// ============================================
// allowlistSchema Tests
// ============================================

describe("allowlistSchema", () => {
  it("validates correct allowlist with TOTAL_UNITS", () => {
    const allowlist = [
      {
        address: "0x0000000000000000000000000000000000000001",
        units: TOTAL_UNITS / 2n,
      },
      {
        address: "0x0000000000000000000000000000000000000002",
        units: TOTAL_UNITS / 2n,
      },
    ];
    const result = allowlistSchema.safeParse(allowlist);
    expect(result.success).toBe(true);
  });

  it("rejects empty allowlist", () => {
    const result = allowlistSchema.safeParse([]);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("at least one entry");
    }
  });

  it("rejects allowlist not totaling TOTAL_UNITS", () => {
    const allowlist = [
      {
        address: "0x0000000000000000000000000000000000000001",
        units: 1000n,
      },
    ];
    const result = allowlistSchema.safeParse(allowlist);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("Total units must equal");
    }
  });

  it("validates single entry with all units", () => {
    const allowlist = [
      {
        address: "0x0000000000000000000000000000000000000001",
        units: TOTAL_UNITS,
      },
    ];
    const result = allowlistSchema.safeParse(allowlist);
    expect(result.success).toBe(true);
  });
});

// ============================================
// scopeDefinitionSchema Tests
// ============================================

describe("scopeDefinitionSchema", () => {
  it("validates correct scope definition", () => {
    const result = scopeDefinitionSchema.safeParse(createValidScopeDefinition());
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const scope = { ...createValidScopeDefinition(), name: "" };
    const result = scopeDefinitionSchema.safeParse(scope);
    expect(result.success).toBe(false);
  });

  it("rejects empty value array", () => {
    const scope = { ...createValidScopeDefinition(), value: [] };
    const result = scopeDefinitionSchema.safeParse(scope);
    expect(result.success).toBe(false);
  });

  it("rejects value array with empty string", () => {
    const scope = { ...createValidScopeDefinition(), value: ["gardening", ""] };
    const result = scopeDefinitionSchema.safeParse(scope);
    expect(result.success).toBe(false);
  });

  it("allows optional excludes", () => {
    const scope = {
      ...createValidScopeDefinition(),
      excludes: ["excluded-scope"],
    };
    const result = scopeDefinitionSchema.safeParse(scope);
    expect(result.success).toBe(true);
  });

  it("allows optional display_value", () => {
    const scope = { ...createValidScopeDefinition() };
    delete scope.display_value;
    const result = scopeDefinitionSchema.safeParse(scope);
    expect(result.success).toBe(true);
  });
});

// ============================================
// timeframeDefinitionSchema Tests
// ============================================

describe("timeframeDefinitionSchema", () => {
  it("validates correct timeframe definition", () => {
    const result = timeframeDefinitionSchema.safeParse(
      createValidTimeframeDefinition()
    );
    expect(result.success).toBe(true);
  });

  it("rejects negative timestamps", () => {
    const timeframe = {
      name: "Work timeframe",
      value: [-1, 1704153600] as [number, number],
      display_value: "Invalid",
    };
    const result = timeframeDefinitionSchema.safeParse(timeframe);
    expect(result.success).toBe(false);
  });

  it("allows zero as valid timestamp (indefinite)", () => {
    const timeframe = {
      name: "Impact timeframe",
      value: [1704067200, 0] as [number, number],
      display_value: "Indefinite",
    };
    const result = timeframeDefinitionSchema.safeParse(timeframe);
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const timeframe = { ...createValidTimeframeDefinition(), name: "" };
    const result = timeframeDefinitionSchema.safeParse(timeframe);
    expect(result.success).toBe(false);
  });

  it("rejects empty display_value", () => {
    const timeframe = { ...createValidTimeframeDefinition(), display_value: "" };
    const result = timeframeDefinitionSchema.safeParse(timeframe);
    expect(result.success).toBe(false);
  });
});

// ============================================
// propertyDefinitionSchema Tests
// ============================================

describe("propertyDefinitionSchema", () => {
  it("validates string value", () => {
    const prop = { trait_type: "Color", value: "green" };
    const result = propertyDefinitionSchema.safeParse(prop);
    expect(result.success).toBe(true);
  });

  it("validates number value", () => {
    const prop = { trait_type: "Count", value: 42 };
    const result = propertyDefinitionSchema.safeParse(prop);
    expect(result.success).toBe(true);
  });

  it("rejects empty trait_type", () => {
    const prop = { trait_type: "", value: "test" };
    const result = propertyDefinitionSchema.safeParse(prop);
    expect(result.success).toBe(false);
  });

  it("rejects non-string/number value", () => {
    const prop = { trait_type: "Invalid", value: { nested: true } };
    const result = propertyDefinitionSchema.safeParse(prop);
    expect(result.success).toBe(false);
  });
});

// ============================================
// attestationRefSchema Tests
// ============================================

describe("attestationRefSchema", () => {
  it("validates correct attestation ref", () => {
    const ref = {
      uid: "0x0000000000000000000000000000000000000000000000000000000000000001",
      title: "Work Approval",
    };
    const result = attestationRefSchema.safeParse(ref);
    expect(result.success).toBe(true);
  });

  it("validates with optional domain", () => {
    const ref = {
      uid: "0x0000000000000000000000000000000000000000000000000000000000000001",
      title: "Work Approval",
      domain: "agroforestry",
    };
    const result = attestationRefSchema.safeParse(ref);
    expect(result.success).toBe(true);
  });

  it("rejects invalid UID format (wrong length)", () => {
    const ref = {
      uid: "0x001",
      title: "Work Approval",
    };
    const result = attestationRefSchema.safeParse(ref);
    expect(result.success).toBe(false);
  });

  it("rejects invalid UID format (no 0x prefix)", () => {
    const ref = {
      uid: "0000000000000000000000000000000000000000000000000000000000000001",
      title: "Work Approval",
    };
    const result = attestationRefSchema.safeParse(ref);
    expect(result.success).toBe(false);
  });

  it("rejects empty title", () => {
    const ref = {
      uid: "0x0000000000000000000000000000000000000000000000000000000000000001",
      title: "",
    };
    const result = attestationRefSchema.safeParse(ref);
    expect(result.success).toBe(false);
  });
});

// ============================================
// outcomeMetricsSchema Tests
// ============================================

describe("outcomeMetricsSchema", () => {
  it("validates correct outcome metrics", () => {
    const result = outcomeMetricsSchema.safeParse(createValidOutcomeMetrics());
    expect(result.success).toBe(true);
  });

  it("validates empty predefined and custom", () => {
    const metrics = { predefined: {}, custom: {} };
    const result = outcomeMetricsSchema.safeParse(metrics);
    expect(result.success).toBe(true);
  });

  it("validates all aggregation types", () => {
    const metrics = {
      predefined: {
        sum_metric: { value: 100, unit: "units", aggregation: "sum", label: "Sum" },
        count_metric: { value: 10, unit: "count", aggregation: "count", label: "Count" },
        avg_metric: { value: 50, unit: "units", aggregation: "average", label: "Average" },
        max_metric: { value: 99, unit: "units", aggregation: "max", label: "Max" },
      },
      custom: {},
    };
    const result = outcomeMetricsSchema.safeParse(metrics);
    expect(result.success).toBe(true);
  });

  it("rejects invalid aggregation type", () => {
    const metrics = {
      predefined: {
        bad_metric: { value: 100, unit: "units", aggregation: "invalid", label: "Bad" },
      },
      custom: {},
    };
    const result = outcomeMetricsSchema.safeParse(metrics);
    expect(result.success).toBe(false);
  });

  it("validates custom metrics without aggregation", () => {
    const metrics = {
      predefined: {},
      custom: {
        my_metric: { value: 42, unit: "widgets", label: "My Metric" },
      },
    };
    const result = outcomeMetricsSchema.safeParse(metrics);
    expect(result.success).toBe(true);
  });
});

// ============================================
// greenGoodsExtensionSchema Tests
// ============================================

describe("greenGoodsExtensionSchema", () => {
  it("validates correct extension", () => {
    const result = greenGoodsExtensionSchema.safeParse(
      createValidGreenGoodsExtension()
    );
    expect(result.success).toBe(true);
  });

  it("rejects empty gardenId", () => {
    const ext = { ...createValidGreenGoodsExtension(), gardenId: "" };
    const result = greenGoodsExtensionSchema.safeParse(ext);
    expect(result.success).toBe(false);
  });

  it("rejects empty attestationRefs", () => {
    const ext = { ...createValidGreenGoodsExtension(), attestationRefs: [] };
    const result = greenGoodsExtensionSchema.safeParse(ext);
    expect(result.success).toBe(false);
  });

  it("validates SDG numbers 1-17", () => {
    const ext = { ...createValidGreenGoodsExtension(), sdgs: [1, 17] };
    const result = greenGoodsExtensionSchema.safeParse(ext);
    expect(result.success).toBe(true);
  });

  it("rejects SDG number 0", () => {
    const ext = { ...createValidGreenGoodsExtension(), sdgs: [0] };
    const result = greenGoodsExtensionSchema.safeParse(ext);
    expect(result.success).toBe(false);
  });

  it("rejects SDG number 18", () => {
    const ext = { ...createValidGreenGoodsExtension(), sdgs: [18] };
    const result = greenGoodsExtensionSchema.safeParse(ext);
    expect(result.success).toBe(false);
  });

  it("validates optional karmaGapProjectId", () => {
    const ext = {
      ...createValidGreenGoodsExtension(),
      karmaGapProjectId: "project-123",
    };
    const result = greenGoodsExtensionSchema.safeParse(ext);
    expect(result.success).toBe(true);
  });

  it("rejects empty protocolVersion", () => {
    const ext = { ...createValidGreenGoodsExtension(), protocolVersion: "" };
    const result = greenGoodsExtensionSchema.safeParse(ext);
    expect(result.success).toBe(false);
  });
});

// ============================================
// hypercertMetadataSchema Tests
// ============================================

describe("hypercertMetadataSchema", () => {
  it("validates correct metadata", () => {
    const result = hypercertMetadataSchema.safeParse(
      createValidHypercertMetadata()
    );
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const metadata = { ...createValidHypercertMetadata(), name: "" };
    const result = hypercertMetadataSchema.safeParse(metadata);
    expect(result.success).toBe(false);
  });

  it("rejects empty description", () => {
    const metadata = { ...createValidHypercertMetadata(), description: "" };
    const result = hypercertMetadataSchema.safeParse(metadata);
    expect(result.success).toBe(false);
  });

  it("rejects empty image", () => {
    const metadata = { ...createValidHypercertMetadata(), image: "" };
    const result = hypercertMetadataSchema.safeParse(metadata);
    expect(result.success).toBe(false);
  });

  it("allows optional external_url", () => {
    const metadata = createValidHypercertMetadata();
    delete metadata.external_url;
    const result = hypercertMetadataSchema.safeParse(metadata);
    expect(result.success).toBe(true);
  });

  it("allows optional properties", () => {
    const metadata = {
      ...createValidHypercertMetadata(),
      properties: [{ trait_type: "Color", value: "green" }],
    };
    const result = hypercertMetadataSchema.safeParse(metadata);
    expect(result.success).toBe(true);
  });

  it("allows optional hidden_properties", () => {
    const metadata = createValidHypercertMetadata();
    delete metadata.hidden_properties;
    const result = hypercertMetadataSchema.safeParse(metadata);
    expect(result.success).toBe(true);
  });
});

// ============================================
// validateMetadata Tests
// ============================================

describe("validateMetadata", () => {
  // Note: The SDK's validateMetaData has strict schema validation.
  // Our validateMetadata combines SDK validation with custom Zod validation
  // for the hidden_properties extension.

  it("returns valid for SDK-compatible metadata without hidden_properties", () => {
    const metadata = createSDKCompatibleMetadata();
    const result = validateMetadata(metadata as any);
    expect(result.valid).toBe(true);
    expect(Object.keys(result.errors)).toHaveLength(0);
  });

  it("validates hidden_properties.gardenId when empty", () => {
    const metadata = {
      ...createSDKCompatibleMetadata(),
      hidden_properties: { ...createValidGreenGoodsExtension(), gardenId: "" },
    };
    const result = validateMetadata(metadata as any);
    // SDK rejects unknown field hidden_properties, and our Zod validation fails gardenId
    expect(result.valid).toBe(false);
    const errorKeys = Object.keys(result.errors);
    expect(errorKeys.some(k => k.includes("hidden_properties.gardenId"))).toBe(true);
  });

  it("returns formatted error messages for invalid SDG values", () => {
    const metadata = {
      ...createSDKCompatibleMetadata(),
      hidden_properties: {
        ...createValidGreenGoodsExtension(),
        sdgs: [0, 18], // Invalid SDG values
      },
    };
    const result = validateMetadata(metadata as any);
    expect(result.valid).toBe(false);
    // Should have error about SDG values
    const errorKeys = Object.keys(result.errors);
    expect(
      errorKeys.some((k) => k.includes("hidden_properties.sdgs"))
    ).toBe(true);
  });

  it("aggregates multiple validation errors", () => {
    const metadata = {
      ...createSDKCompatibleMetadata(),
      hidden_properties: {
        gardenId: "", // Invalid
        attestationRefs: [], // Invalid
        sdgs: [],
        capitals: [],
        outcomes: { predefined: {}, custom: {} },
        domain: "",
        protocolVersion: "", // Invalid
      },
    };
    const result = validateMetadata(metadata as any);
    expect(result.valid).toBe(false);
    expect(Object.keys(result.errors).length).toBeGreaterThan(1);
  });

  it("returns error object structure when SDK validation fails", () => {
    // SDK validates required fields, not empty strings
    const metadata = { name: "Valid" }; // Missing description and image
    const result = validateMetadata(metadata as any);
    expect(result.valid).toBe(false);
    expect(typeof result.errors).toBe("object");
    expect(Object.keys(result.errors).length).toBeGreaterThan(0);
  });
});
