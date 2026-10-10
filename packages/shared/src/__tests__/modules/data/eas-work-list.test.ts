import { describe, expect, it, vi } from "vitest";
import { readWorkApprovalsForWorks } from "../../../modules/data/eas-work-list";
import type { GraphQLReader } from "../../../modules/data/graphql-client";

describe("readWorkApprovalsForWorks", () => {
  it("keeps successful batches and marks only a failed batch unknown", async () => {
    const workUIDs = Array.from(
      { length: 51 },
      (_, index) => `0x${index.toString(16).padStart(64, "0")}`
    );
    const query = vi
      .fn()
      .mockResolvedValueOnce({ data: { attestations: [] } })
      .mockResolvedValueOnce({ error: new Error("provider limit") });

    const result = await readWorkApprovalsForWorks(workUIDs, 42161, {
      query,
    } as unknown as GraphQLReader);

    expect(query).toHaveBeenCalledTimes(2);
    expect(result.approvals).toEqual([]);
    expect(result.failedWorkUIDs).toEqual([workUIDs[50]]);
  });
});
