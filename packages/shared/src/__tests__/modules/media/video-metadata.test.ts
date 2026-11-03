import { describe, expect, it } from "vitest";

import { withoutVideoMetadata } from "../../../modules/media/video-metadata";
import { bytesOf } from "../../test-utils/photo-fixtures";
import {
  aviVideo,
  chainedFragmentMp4,
  leakedRecorderDetails,
  legacySoundMp4,
  referencingMp4,
  shortRunMp4,
  sizedSegmentWebm,
  subtitledWebm,
  telemetryOnlyMp4,
  videoFile,
  videoVariants,
} from "../../test-utils/video-fixtures";

describe("withoutVideoMetadata", () => {
  it.each(
    videoVariants()
  )("strips $name to the bytes it may be published as, moving nothing", async ({
    recorded,
    published,
    type,
  }) => {
    expect(leakedRecorderDetails(recorded)).not.toEqual([]);

    const stripped = await withoutVideoMetadata(videoFile(recorded, "clip", type));

    const bytes = await bytesOf(stripped!);
    expect(bytes).toEqual(published);
    expect(leakedRecorderDetails(bytes)).toEqual([]);
    expect([stripped!.name, stripped!.type]).toEqual(["clip", type]);
  });

  it.each(videoVariants())("hands back $name, once stripped, as the same file", async ({
    published,
    type,
  }) => {
    const file = videoFile(published, "clip", type);

    await expect(withoutVideoMetadata(file)).resolves.toBe(file);
  });

  const recorded = videoVariants()[0].recorded;
  it.each([
    ["a file in another container", aviVideo()],
    ["an MP4 cut off inside a box", recorded.subarray(0, recorded.length - 5)],
    ["an MP4 whose picture is kept in another file", referencingMp4()],
    ["an MP4 with nothing to play but its telemetry", telemetryOnlyMp4()],
    ["a WebM with a subtitle track, which cannot be removed in place", subtitledWebm()],
    // Each of these would play differently, or not at all, once blanked.
    [
      "a fragmented MP4 whose picture starts where a telemetry fragment ended",
      chainedFragmentMp4(),
    ],
    ["a QuickTime movie whose sound gives each frame a size of 1, the old way", legacySoundMp4()],
    ["a WebM whose cluster runs on inside a segment that gives its size", sizedSegmentWebm()],
    ["an MP4 whose fragment run promises an offset it has no room for", shortRunMp4()],
  ])("refuses %s, since it cannot be checked in full", async (_, bytes) => {
    await expect(withoutVideoMetadata(videoFile(bytes, "clip", "video/mp4"))).resolves.toBeNull();
  });
});
