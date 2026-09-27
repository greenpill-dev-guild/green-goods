import { describe, expect, it } from "vitest";
import { Domain } from "../../../types/domain";
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

describe("buildWorkMetadataPayload", () => {
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

  it("writes v2 only when both a known domain and an Action slug are supplied", () => {
    expect(
      buildWorkMetadataPayload({ ...base, domain: Domain.AGRO, actionSlug: "planting" }).version
    ).toBe("work_metadata_v2");
    expect(
      buildWorkMetadataPayload({ ...base, domain: null, actionSlug: "planting" }).version
    ).toBe("work_metadata");
  });
});
