import { describe, it, expect } from "vitest";
import {
  domainToActionDomain,
  filterAttestationsByAssessment,
  prefillMetadataFromAssessment,
} from "../../modules/data/hypercerts";
import { getSDGLabel } from "../../config/sdg";
import { Domain, CynefinPhase } from "../../types/domain";
import type { GardenAssessment } from "../../types/domain";
import type { HypercertAttestation } from "../../types/hypercerts";

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
    workScope: ["gardening"],
    gardenerAddress: "0x0000000000000000000000000000000000000001",
    mediaUrls: [],
    createdAt: 1704067200, // 2024-01-01
    approvedAt: 1704153600, // 2024-01-02
    ...overrides,
  };
}

function createMockAssessment(overrides: Partial<GardenAssessment> = {}): GardenAssessment {
  return {
    id: "assessment-1",
    schemaVersion: "assessment_v2",
    authorAddress: "0x0000000000000000000000000000000000000099",
    gardenAddress: "0x0000000000000000000000000000000000000001",
    title: "Q1 Solar Assessment",
    description: "Assessment for Q1 solar activities",
    diagnosis: "Test diagnosis",
    smartOutcomes: [],
    cynefinPhase: CynefinPhase.CLEAR,
    domain: Domain.SOLAR,
    selectedActionUIDs: [],
    reportingPeriod: { start: 1704067200, end: 1711929600 }, // 2024-01-01 to 2024-04-01
    sdgTargets: [],
    attachments: [],
    location: "",
    createdAt: 1704067200,
    ...overrides,
  };
}

// ============================================
// domainToActionDomain Tests
// ============================================

describe("domainToActionDomain", () => {
  it("maps Domain.SOLAR to 'solar'", () => {
    expect(domainToActionDomain(Domain.SOLAR)).toBe("solar");
  });

  it("maps Domain.AGRO to 'agroforestry'", () => {
    expect(domainToActionDomain(Domain.AGRO)).toBe("agroforestry");
  });

  it("maps Domain.EDU to 'education'", () => {
    expect(domainToActionDomain(Domain.EDU)).toBe("education");
  });

  it("maps Domain.WASTE to 'waste'", () => {
    expect(domainToActionDomain(Domain.WASTE)).toBe("waste");
  });

  it("returns undefined for unknown domain values", () => {
    expect(domainToActionDomain(99 as Domain)).toBeUndefined();
  });
});

// ============================================
// filterAttestationsByAssessment Tests
// ============================================

describe("filterAttestationsByAssessment", () => {
  it("returns all attestations when they fall within the reporting period", () => {
    const attestations = [
      createMockAttestation({ createdAt: 1704100000, domain: "solar" }),
      createMockAttestation({ createdAt: 1706000000, domain: "solar" }),
    ];
    const assessment = createMockAssessment();

    const result = filterAttestationsByAssessment(attestations, assessment);
    expect(result).toHaveLength(2);
  });

  it("filters out attestations before the reporting period start", () => {
    const attestations = [
      createMockAttestation({ createdAt: 1700000000, domain: "solar" }), // before start
      createMockAttestation({ createdAt: 1706000000, domain: "solar" }), // within
    ];
    const assessment = createMockAssessment();

    const result = filterAttestationsByAssessment(attestations, assessment);
    expect(result).toHaveLength(1);
    expect(result[0].createdAt).toBe(1706000000);
  });

  it("filters out attestations after the reporting period end", () => {
    const attestations = [
      createMockAttestation({ createdAt: 1706000000, domain: "solar" }), // within
      createMockAttestation({ createdAt: 1720000000, domain: "solar" }), // after end
    ];
    const assessment = createMockAssessment();

    const result = filterAttestationsByAssessment(attestations, assessment);
    expect(result).toHaveLength(1);
    expect(result[0].createdAt).toBe(1706000000);
  });

  it("filters out attestations with non-matching domain", () => {
    const attestations = [
      createMockAttestation({ createdAt: 1706000000, domain: "solar" }),
      createMockAttestation({ createdAt: 1706000000, domain: "waste" }),
      createMockAttestation({ createdAt: 1706000000, domain: "education" }),
    ];
    const assessment = createMockAssessment({ domain: Domain.SOLAR });

    const result = filterAttestationsByAssessment(attestations, assessment);
    expect(result).toHaveLength(1);
    expect(result[0].domain).toBe("solar");
  });

  it("includes attestations with no domain when assessment has a domain", () => {
    const attestations = [
      createMockAttestation({ createdAt: 1706000000, domain: "solar" }),
      createMockAttestation({ createdAt: 1706000000, domain: undefined }),
    ];
    const assessment = createMockAssessment({ domain: Domain.SOLAR });

    const result = filterAttestationsByAssessment(attestations, assessment);
    // Attestations without a domain are not filtered out (domain && check)
    expect(result).toHaveLength(2);
  });

  it("applies both period and domain filters together", () => {
    const attestations = [
      createMockAttestation({ createdAt: 1706000000, domain: "solar" }), // match both
      createMockAttestation({ createdAt: 1706000000, domain: "waste" }), // wrong domain
      createMockAttestation({ createdAt: 1700000000, domain: "solar" }), // before period
      createMockAttestation({ createdAt: 1720000000, domain: "solar" }), // after period
    ];
    const assessment = createMockAssessment({ domain: Domain.SOLAR });

    const result = filterAttestationsByAssessment(attestations, assessment);
    expect(result).toHaveLength(1);
    expect(result[0].createdAt).toBe(1706000000);
    expect(result[0].domain).toBe("solar");
  });

  it("returns empty array when no attestations match", () => {
    const attestations = [createMockAttestation({ createdAt: 1700000000, domain: "waste" })];
    const assessment = createMockAssessment({ domain: Domain.SOLAR });

    const result = filterAttestationsByAssessment(attestations, assessment);
    expect(result).toHaveLength(0);
  });

  it("returns empty array for empty attestations input", () => {
    const assessment = createMockAssessment();

    const result = filterAttestationsByAssessment([], assessment);
    expect(result).toHaveLength(0);
  });

  it("does not filter by period when start is 0 (falsy)", () => {
    const attestations = [createMockAttestation({ createdAt: 1000, domain: "solar" })];
    const assessment = createMockAssessment({
      reportingPeriod: { start: 0, end: 1711929600 },
    });

    const result = filterAttestationsByAssessment(attestations, assessment);
    expect(result).toHaveLength(1);
  });

  it("does not filter by period when end is 0 (falsy)", () => {
    const attestations = [createMockAttestation({ createdAt: 1706000000, domain: "solar" })];
    const assessment = createMockAssessment({
      reportingPeriod: { start: 1704067200, end: 0 },
    });

    const result = filterAttestationsByAssessment(attestations, assessment);
    expect(result).toHaveLength(1);
  });
});

// ============================================
// prefillMetadataFromAssessment Tests
// ============================================

describe("prefillMetadataFromAssessment", () => {
  it("maps assessment title to prefill title", () => {
    const assessment = createMockAssessment({ title: "Q1 Harvest" });
    const prefill = prefillMetadataFromAssessment(assessment);
    expect(prefill.title).toBe("Q1 Harvest");
  });

  it("maps assessment diagnosis to prefill description", () => {
    const assessment = createMockAssessment({
      diagnosis: "Community lacks solar infrastructure",
    });
    const prefill = prefillMetadataFromAssessment(assessment);
    expect(prefill.description).toBe("Community lacks solar infrastructure");
  });

  it("includes domain in workScopes", () => {
    const assessment = createMockAssessment({ domain: Domain.AGRO });
    const prefill = prefillMetadataFromAssessment(assessment);
    expect(prefill.workScopes).toContain("agroforestry");
  });

  it("includes SDG labels in workScopes when getSDGLabel is provided", () => {
    const assessment = createMockAssessment({ sdgTargets: [7, 13] });
    const prefill = prefillMetadataFromAssessment(assessment, getSDGLabel);
    expect(prefill.workScopes).toContain("Affordable and Clean Energy");
    expect(prefill.workScopes).toContain("Climate Action");
  });

  it("does not include SDG labels when getSDGLabel is not provided", () => {
    const assessment = createMockAssessment({ sdgTargets: [7, 13] });
    const prefill = prefillMetadataFromAssessment(assessment);
    // Only domain should be in workScopes
    expect(prefill.workScopes).toEqual(["solar"]);
  });

  it("maps SMART outcome descriptions to impactScopes", () => {
    const assessment = createMockAssessment({
      smartOutcomes: [
        { description: "Reduce emissions by 50%", metric: "CO2 reduction", target: 50 },
        { description: "Plant 1000 trees", metric: "Trees planted", target: 1000 },
      ],
    });
    const prefill = prefillMetadataFromAssessment(assessment);
    expect(prefill.impactScopes).toEqual(["Reduce emissions by 50%", "Plant 1000 trees"]);
  });

  it("filters out empty SMART outcome descriptions from impactScopes", () => {
    const assessment = createMockAssessment({
      smartOutcomes: [
        { description: "", metric: "CO2", target: 50 },
        { description: "Plant trees", metric: "Trees", target: 100 },
      ],
    });
    const prefill = prefillMetadataFromAssessment(assessment);
    expect(prefill.impactScopes).toEqual(["Plant trees"]);
  });

  it("maps SMART outcomes to predefined outcome metrics", () => {
    const assessment = createMockAssessment({
      smartOutcomes: [{ description: "Reduce CO2", metric: "CO2 reduction", target: 50 }],
    });
    const prefill = prefillMetadataFromAssessment(assessment);
    expect(prefill.outcomes.predefined).toHaveProperty("CO2 reduction");
    expect(prefill.outcomes.predefined["CO2 reduction"]).toEqual({
      value: 50,
      unit: "CO2 reduction",
      aggregation: "sum",
      label: "Reduce CO2",
    });
    expect(prefill.outcomes.custom).toEqual({});
  });

  it("uses metric as label when description is empty", () => {
    const assessment = createMockAssessment({
      smartOutcomes: [{ description: "", metric: "kWh", target: 500 }],
    });
    const prefill = prefillMetadataFromAssessment(assessment);
    expect(prefill.outcomes.predefined.kWh.label).toBe("kWh");
  });

  it("maps reporting period to work timeframe", () => {
    const assessment = createMockAssessment({
      reportingPeriod: { start: 1704067200, end: 1711929600 },
    });
    const prefill = prefillMetadataFromAssessment(assessment);
    expect(prefill.workTimeframeStart).toBe(1704067200);
    expect(prefill.workTimeframeEnd).toBe(1711929600);
  });

  it("passes through sdgTargets to sdgs", () => {
    const assessment = createMockAssessment({ sdgTargets: [1, 4, 15] });
    const prefill = prefillMetadataFromAssessment(assessment);
    expect(prefill.sdgs).toEqual([1, 4, 15]);
  });

  it("returns a copy of sdgTargets (not same reference)", () => {
    const targets = [1, 4, 15];
    const assessment = createMockAssessment({ sdgTargets: targets });
    const prefill = prefillMetadataFromAssessment(assessment);
    expect(prefill.sdgs).not.toBe(targets);
    expect(prefill.sdgs).toEqual(targets);
  });

  it("handles assessment with no SMART outcomes", () => {
    const assessment = createMockAssessment({ smartOutcomes: [] });
    const prefill = prefillMetadataFromAssessment(assessment);
    expect(prefill.impactScopes).toEqual([]);
    expect(prefill.outcomes.predefined).toEqual({});
  });

  it("handles assessment with no SDG targets", () => {
    const assessment = createMockAssessment({ sdgTargets: [] });
    const prefill = prefillMetadataFromAssessment(assessment, getSDGLabel);
    expect(prefill.sdgs).toEqual([]);
    // workScopes should only have domain
    expect(prefill.workScopes).toEqual(["solar"]);
  });
});
