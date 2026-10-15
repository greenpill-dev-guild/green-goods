import { describe, expect, expectTypeOf, it } from "vitest";
import { Domain, type WorkMetadataV1 } from "../../../types/domain";
import { buildWorkMetadataPayload } from "../../../utils/eas/work-metadata";

const base = {
  title: "Planting",
  feedback: "Planted along the fence",
  actionUID: 7,
  timeSpentMinutes: 90,
  details: { seedlings: 12, _location: "private" },
  audioNoteCids: [],
  submittedAt: "2026-09-27T00:00:00.000Z",
  attachments: [{ cid: "bafkreiphoto", type: "image/jpeg" }],
  clientWorkId: "cw-1",
};

// Legacy attestations may omit timing and identity while retaining the old planting fields.
describe("buildWorkMetadataPayload", () => {
  it("retains the compile-time contract for legacy work metadata", () => {
    expectTypeOf<{
      plantCount: number;
      plantSelection: string[];
    }>().toExtend<WorkMetadataV1>();
    expectTypeOf<WorkMetadataV1["plantCount"]>().toEqualTypeOf<number>();
    expectTypeOf<WorkMetadataV1["plantSelection"]>().toEqualTypeOf<string[]>();
    expectTypeOf<WorkMetadataV1["timeSpentMinutes"]>().toEqualTypeOf<number | undefined>();
  });

  it("writes the legacy shape with identity, in the key order uploaders hash", () => {
    const { payload, version } = buildWorkMetadataPayload(base);
    expect(version).toBe("work_metadata");
    expect(JSON.stringify(payload)).toBe(
      JSON.stringify({
        details: { seedlings: 12 },
        timeSpentMinutes: 90,
        clientWorkId: "cw-1",
        title: "Planting",
        feedback: "Planted along the fence",
        actionUID: 7,
        submittedAt: "2026-09-27T00:00:00.000Z",
        attachments: [{ cid: "bafkreiphoto", type: "image/jpeg" }],
      })
    );
  });

  it.each([
    {
      label: "known domain and slug",
      domain: Domain.AGRO,
      actionSlug: "planting",
      version: "work_metadata_v2",
    },
    { label: "null domain", domain: null, actionSlug: "planting", version: "work_metadata" },
    {
      label: "missing domain",
      domain: undefined,
      actionSlug: "planting",
      version: "work_metadata",
    },
    { label: "missing slug", domain: Domain.AGRO, actionSlug: undefined, version: "work_metadata" },
  ])("selects the schema for $label", ({ domain, actionSlug, version }) => {
    expect(buildWorkMetadataPayload({ ...base, domain, actionSlug }).version).toBe(version);
  });
});
