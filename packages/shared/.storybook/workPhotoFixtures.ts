/**
 * Work photos as files on the device, for stories that stage media before it
 * uploads. Three small drawings stand in for field photos, each padded to a
 * photo's size so a tile's size line reads as it would for a real upload.
 */
import FENCE_LEANING_SVG from "./fixture-art/fence-leaning.svg?raw";
import FENCE_UPRIGHT_SVG from "./fixture-art/fence-upright.svg?raw";
import SEEDLINGS_SVG from "./fixture-art/seedlings.svg?raw";
import { STORYBOOK_NOW_SECONDS } from "./fixtures";

const WORK_PHOTOS = [
  { name: "east-bed-before.jpg", art: FENCE_LEANING_SVG, bytes: 842_000 },
  { name: "east-bed-after.jpg", art: FENCE_UPRIGHT_SVG, bytes: 1_480_000 },
  { name: "seedling-tray.jpg", art: SEEDLINGS_SVG, bytes: 2_310_000 },
] as const;

const LAST_MODIFIED = STORYBOOK_NOW_SECONDS * 1000;
const COMMENT_MARKUP_LENGTH = "<!---->".length;

/** One drawing as a photo of the given size. A trailing XML comment pads it without changing what it draws. */
export function stagedWorkPhoto(
  name: string,
  bytes: number,
  art: string = FENCE_UPRIGHT_SVG
): File {
  const padding = `<!--${" ".repeat(Math.max(0, bytes - art.length - COMMENT_MARKUP_LENGTH))}-->`;
  return new File([art, padding], name, { type: "image/svg+xml", lastModified: LAST_MODIFIED });
}

/** The first `count` of the three field photos, in the order a steward would add them. */
export function stagedWorkPhotos(count: number): File[] {
  return WORK_PHOTOS.slice(0, count).map((photo) =>
    stagedWorkPhoto(photo.name, photo.bytes, photo.art)
  );
}

/** A short clip: the one kind of staged media the browser cannot draw as a still. */
export function stagedWorkVideo(name: string): File {
  return new File([new Uint8Array(4_200_000)], name, {
    type: "video/mp4",
    lastModified: LAST_MODIFIED,
  });
}
