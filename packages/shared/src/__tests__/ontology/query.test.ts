import { describe, expect, it } from "vitest";

import {
  getOntologyManifestVersion,
  getOntologyMaturity,
  getOntologyRelationships,
  getOntologySafeClaims,
  getOntologySurfaces,
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

  it("tells an agent which surfaces a term belongs on", () => {
    expect(getOntologySurfaces("Work")).toContain("agent");
    expect(getOntologySurfaces("Commitment Payout Plan")).not.toContain("agent");
    expect(getOntologySurfaces("Work Approval")).toEqual(["admin", "client", "public", "docs"]);
    expect(getOntologySurfaces("not-a-term")).toEqual([]);
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
    // The exact date is owned by the sidecar and locked byte-for-byte by
    // `bun run check:ontology`; pinning the literal here only churns the test.
    expect(getOntologyManifestVersion()).toEqual({
      version: 1,
      verified_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
  });
});
