import { describe, it, expect, vi } from "vitest";

vi.mock("../../modules/data/pinata", () => ({
  getFileByHash: vi.fn(async () => ({ data: new Blob(["x"]) })),
}));

vi.mock("../../config", () => ({
  getEASConfig: () => ({
    WORK: { uid: "0xwork" },
    WORK_APPROVAL: { uid: "0xworkApproval" },
    GARDEN_ASSESSMENT: { uid: "0xassessment" },
  }),
}));

vi.mock("../../modules/urql", () => ({
  createEasClient: () => ({
    query: () => ({ toPromise: async () => ({ data: { attestations: [] }, error: null }) }),
  }),
}));

import { getGardenAssessments, getWorks, getWorkApprovals } from "../../modules/data/eas";

describe("modules/eas", () => {
  it("returns arrays for list functions", async () => {
    const a = await getGardenAssessments();
    const w = await getWorks();
    const wa = await getWorkApprovals();
    expect(Array.isArray(a)).toBe(true);
    expect(Array.isArray(w)).toBe(true);
    expect(Array.isArray(wa)).toBe(true);
  });
});
