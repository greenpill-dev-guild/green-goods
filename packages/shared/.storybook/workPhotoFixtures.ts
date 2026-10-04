/**
 * Work media as files on the device, for stories that stage it before it
 * uploads. Three small drawings stand in for field photos: real JPEGs, since a
 * flow counts and previews only real photo types, each padded to a photo's
 * size so a tile's size line reads as it would for a real upload.
 */
import FENCE_LEANING_JPEG from "./fixture-art/fence-leaning.jpg?inline";
import FENCE_UPRIGHT_JPEG from "./fixture-art/fence-upright.jpg?inline";
import SEEDLINGS_JPEG from "./fixture-art/seedlings.jpg?inline";
import { STORYBOOK_NOW_SECONDS } from "./fixtures";

const WORK_PHOTOS = [
  { name: "east-bed-before.jpg", art: FENCE_LEANING_JPEG, bytes: 842_000 },
  { name: "east-bed-after.jpg", art: FENCE_UPRIGHT_JPEG, bytes: 1_480_000 },
  { name: "seedling-tray.jpg", art: SEEDLINGS_JPEG, bytes: 2_310_000 },
] as const;

const LAST_MODIFIED = STORYBOOK_NOW_SECONDS * 1000;

function bytesOf(dataUrl: string) {
  return Uint8Array.from(atob(dataUrl.split(",")[1] ?? ""), (char) => char.charCodeAt(0));
}

/**
 * One drawing as a JPEG photo of the given size. The padding follows the
 * picture's end marker, where a decoder stops reading, so it draws the same.
 */
export function stagedWorkPhoto(
  name: string,
  bytes: number,
  art: string = FENCE_UPRIGHT_JPEG
): File {
  const picture = bytesOf(art);
  const padding = new Uint8Array(Math.max(0, bytes - picture.length));
  return new File([picture, padding], name, { type: "image/jpeg", lastModified: LAST_MODIFIED });
}

/** The first `count` of the three field photos, in the order a steward would add them. */
export function stagedWorkPhotos(count: number): File[] {
  return WORK_PHOTOS.slice(0, count).map((photo) =>
    stagedWorkPhoto(photo.name, photo.bytes, photo.art)
  );
}

/** A short clip, which has no still to draw. */
export function stagedWorkVideo(name: string): File {
  return new File([new Uint8Array(4_200_000)], name, {
    type: "video/mp4",
    lastModified: LAST_MODIFIED,
  });
}

/** A HEIC photo as the flow stages it while the decoder cannot load: its original bytes. */
export function stagedUnconvertedHeic(name: string): File {
  return new File([new Uint8Array(2_650_000)], name, {
    type: "image/heic",
    lastModified: LAST_MODIFIED,
  });
}
