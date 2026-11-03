/**
 * Videos without the metadata cameras write into them
 *
 * A work video is pinned to public IPFS and named on an attestation, like a
 * photo, and neither can be withdrawn. Phones write where a video was recorded
 * and the device that recorded it into the container: Android as a `©xyz` box
 * in the movie's user data, the iPhone as QuickTime metadata keys, editors as
 * XMP, and action cameras and drones as a track of their own that logs the
 * place as it moves.
 *
 * Nothing is re-encoded and no byte moves, so every offset the container
 * records and every frame of picture and sound stay exactly as they were. At
 * the top of a file and in its movie, a video keeps only the structures its
 * picture and sound play from; inside a picture or sound track, its user data,
 * metadata and XMP go. What goes is blanked where it lies: renamed as free
 * space, or a Void element, and filled with zeros. A track that is neither
 * picture nor sound goes whole, media bytes that no picture or sound track
 * reads are zeroed, and so are the capture times in the movie and track
 * headers. What a camera writes into the encoded picture itself, as some
 * drones do, is part of what plays and stays.
 *
 * @module modules/media/video-metadata
 */

import { moviePatches, startsLikeMovie } from "./mp4-metadata";
import { type Bytes, type Patch, alreadyWritten } from "./video-bytes";
import { matroskaPatches, startsLikeMatroska } from "./webm-metadata";

/**
 * Videos this already returned. A video is checked as it is picked and again
 * before it is pinned, and each check reads all of it; one it returned has
 * nothing left to remove.
 */
const published = new WeakSet<File>();

/**
 * The video as it may be published: an MP4, QuickTime or WebM video without
 * its location, device, capture time or other metadata, under the same name
 * and type. The same file comes back when there was nothing to remove. Null
 * when the bytes are not a container this can read in full, so the caller
 * refuses the video rather than publish what it could not check.
 */
export async function withoutVideoMetadata(file: File): Promise<File | null> {
  if (published.has(file)) return file;
  const result = await rewriteVideo(file);
  if (result) published.add(result);
  return result;
}

async function rewriteVideo(file: File): Promise<File | null> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const patches = patchesFor(bytes);
  if (!patches) return null;
  const changes = patches.filter((patch) => !alreadyWritten(bytes, patch));
  if (!changes.length) return file;
  // The untouched stretches are slices of the original, so the video is not copied in memory.
  changes.sort((left, right) => left.start - right.start);
  const parts: BlobPart[] = [];
  let position = 0;
  for (const { start, end, bytes: written } of changes) {
    parts.push(file.slice(position, start), written ?? new Uint8Array(end - start));
    position = end;
  }
  parts.push(file.slice(position));
  return new File(parts, file.name, { type: file.type, lastModified: file.lastModified });
}

/**
 * What has to be written over a video's bytes, or null when they are not a
 * container this can read in full. A file malformed enough to throw is one it
 * cannot read.
 */
function patchesFor(bytes: Bytes): Patch[] | null {
  try {
    if (startsLikeMatroska(bytes)) return matroskaPatches(bytes);
    return startsLikeMovie(bytes) ? moviePatches(bytes) : null;
  } catch {
    return null;
  }
}
