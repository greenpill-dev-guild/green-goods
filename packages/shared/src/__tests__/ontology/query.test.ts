import { describe, expect, it } from "vitest";

import {
  getOntologyManifestVersion,
  getOntologyMaturity,
  getOntologyRelationships,
  getOntologySafeClaims,
  getOntologyTerm,
  listOntologyTerms,
} from "../../ontology/query";

describe("ontology query seam", () => {
  it("resolves canonical ids, refs, display names, and aliases", () => {
    expect(getOntologyTerm("work")?.ref).toBe("entity:work");
    expect(getOntologyTerm("entity:work")?.canonical).toBe("Work");
    expect(getOntologyTerm("Impact Certificate")?.id).toBe("hypercert");
    expect(getOntologyTerm("not-a-term")).toBeUndefined();
  });

  it("keeps protocol deployment separate from product availability", () => {
    expect(getOntologyMaturity("Commitment")?.deployment).toBe("deployed");
    expect(getOntologyMaturity("Commitment")?.availability).toBe("deployed-not-available");
    expect(getOntologySafeClaims("Commitment")[0]?.safe_wording).toContain("not yet");
  });

  it("returns declared relationships and manifest metadata", () => {
    expect(getOntologyRelationships("Need")).toEqual(
      expect.arrayContaining([expect.objectContaining({ to: "garden", kind: "raised-in" })])
    );
    expect(listOntologyTerms().length).toBeGreaterThan(20);
    expect(getOntologyManifestVersion()).toEqual({ version: 1, verified_at: "2026-08-15" });
  });
});
