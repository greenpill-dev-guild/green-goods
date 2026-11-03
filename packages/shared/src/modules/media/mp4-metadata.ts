/**
 * MP4 and QuickTime movies without their metadata
 *
 * What a movie has to have written over it to keep only what its picture and
 * sound play from (`video-metadata.ts` says what goes and why).
 *
 * @module modules/media/mp4-metadata
 */

import {
  type Box,
  ENCRYPTION_DATA,
  boxesIn,
  defaultSampleSizes,
  fixedSampleSize,
  fragmentSamples,
  fragmentTrackId,
  merged,
  sampleRanges,
} from "./mp4-samples";
import { type Bytes, type Patch, type Range, ascii, text, viewOf } from "./video-bytes";

/** Boxes a movie file can start with; a QuickTime movie may have no `ftyp`. */
const ISO_FIRST_BOXES = new Set(["ftyp", "moov", "mdat", "wide", "free", "skip", "pnot"]);

/** Top-level boxes that index, frame or hold the movie. Every other one is blanked. */
const ISO_STRUCTURE = new Set([
  "ftyp",
  "styp",
  "moov",
  "moof",
  "mdat",
  "mfra",
  "sidx",
  "ssix",
  "wide",
]);

/** Movie boxes that describe how it plays. Every other one is blanked. */
const MOVIE_STRUCTURE = new Set(["mvhd", "trak", "mvex", "iods", "clip", "ctab"]);

/** Boxes that carry nothing but metadata, wherever they sit in a track or fragment. */
const METADATA_BOXES = new Set(["udta", "meta", "uuid"]);

/** A compressed movie, one that plays from other files, or an encrypted one. */
const UNREADABLE_MOVIE = new Set(["cmov", "rmra", "pssh"]);

/** Sample descriptions of encrypted picture or sound. */
const ENCRYPTED_ENTRIES = new Set(["encv", "enca", "encs", "enct"]);

const PICTURE_OR_SOUND = new Set(["vide", "soun"]);

interface Track {
  id: number;
  box: Box;
  plays: boolean;
  children: Box[];
  /** Where the samples the track's own tables list lie. */
  samples: Range[];
}

/** Whether the bytes start like an MP4 or QuickTime movie. */
export function startsLikeMovie(bytes: Bytes): boolean {
  return ISO_FIRST_BOXES.has(text(bytes, 4, 4));
}

/**
 * What has to be written for an MP4 or QuickTime movie to keep only what its
 * picture and sound play from, or null when its structure cannot be read in
 * full: boxes that do not fit, a compressed, referenced or encrypted movie,
 * samples outside the file, or a box to blank that a sample lies in.
 */
export function moviePatches(bytes: Bytes): Patch[] | null {
  const top = boxesIn(bytes, 0, bytes.length, true);
  const movies = top?.filter((box) => box.type === "moov") ?? [];
  if (!top || movies.length !== 1) return null;
  const movie = boxesIn(bytes, movies[0].body, movies[0].end);
  if (!movie || movie.some((box) => UNREADABLE_MOVIE.has(box.type))) return null;
  const tracks: Track[] = [];
  for (const box of movie.filter(({ type }) => type === "trak")) {
    const track = readTrack(bytes, box);
    if (!track) return null;
    tracks.push(track);
  }
  const playing = new Set(tracks.filter((track) => track.plays).map((track) => track.id));
  // A movie with no picture or sound would publish as nothing but zeros.
  if (!playing.size) return null;
  const kept: Range[] = tracks.flatMap((track) => (track.plays ? track.samples : []));
  const sizes = defaultSampleSizes(bytes, movie);
  for (const fragment of top.filter(({ type }) => type === "moof")) {
    const samples = fragmentSamples(bytes, fragment, sizes, playing);
    if (!samples) return null;
    kept.push(...samples);
  }
  if (kept.some(([start, end]) => start < 0 || end > bytes.length || end < start)) return null;
  const keep = merged(kept);

  const patches: Patch[] = [];
  const blank = (box: Box) =>
    patches.push(
      { start: box.start + 4, end: box.start + 8, bytes: ascii("free") },
      {
        start: box.sized,
        end: box.end,
      }
    );
  const zeroBody = (box: Box) => patches.push({ start: box.body, end: box.end });
  const clearTimes = (box: Box | undefined) => {
    // Version 1 headers hold 64-bit times; version 0, 32-bit ones. Both come first.
    const end = box && box.body + (bytes[box.body] === 1 ? 20 : 12);
    if (box && end && end <= box.end) patches.push({ start: box.body + 4, end });
  };

  for (const box of top) {
    if (box.type === "mdat") {
      // Media bytes that no picture or sound track reads go, whatever wrote them.
      let position = box.body;
      for (const [start, end] of keep) {
        if (end <= position || start >= box.end) continue;
        if (start > position) patches.push({ start: position, end: start });
        position = Math.max(position, end);
      }
      if (position < box.end) patches.push({ start: position, end: box.end });
    } else if (box.type === "free" || box.type === "skip") zeroBody(box);
    else if (!ISO_STRUCTURE.has(box.type)) blank(box);
  }
  clearTimes(movie.find(({ type }) => type === "mvhd"));
  for (const box of movie) {
    if (box.type === "free" || box.type === "skip") zeroBody(box);
    else if (!MOVIE_STRUCTURE.has(box.type)) blank(box);
  }
  for (const track of tracks) {
    if (!track.plays) {
      blank(track.box);
      continue;
    }
    clearTimes(track.children.find(({ type }) => type === "tkhd"));
    const media = track.children.find(({ type }) => type === "mdia")!;
    const mediaChildren = boxesIn(bytes, media.body, media.end)!;
    clearTimes(mediaChildren.find(({ type }) => type === "mdhd"));
    for (const box of [...track.children, ...mediaChildren]) {
      if (METADATA_BOXES.has(box.type)) blank(box);
      else if (box.type === "free" || box.type === "skip") zeroBody(box);
    }
  }
  for (const fragment of top.filter(({ type }) => type === "moof")) {
    const children = boxesIn(bytes, fragment.body, fragment.end)!;
    for (const box of children) {
      if (box.type === "traf") {
        const parts = boxesIn(bytes, box.body, box.end)!;
        if (!playing.has(fragmentTrackId(bytes, parts))) blank(box);
        else for (const part of parts) if (METADATA_BOXES.has(part.type)) blank(part);
      } else if (METADATA_BOXES.has(box.type)) blank(box);
      else if (box.type === "free" || box.type === "skip") zeroBody(box);
    }
  }
  // A sample that lies in a box to blank would be lost with it; such a movie is refused.
  const touchesSamples = patches.some((patch) =>
    keep.some(([start, end]) => start < patch.end && patch.start < end)
  );
  return touchesSamples ? null : patches;
}

/** A track, whether it plays as picture or sound, and where its listed samples lie. */
function readTrack(bytes: Bytes, box: Box): Track | null {
  const view = viewOf(bytes);
  const children = boxesIn(bytes, box.body, box.end);
  const header = children?.find(({ type }) => type === "tkhd");
  const media = children?.find(({ type }) => type === "mdia");
  if (!children || !header || !media || header.end - header.body < 24) return null;
  const id = view.getUint32(header.body + (bytes[header.body] === 1 ? 20 : 12));
  const mediaChildren = boxesIn(bytes, media.body, media.end);
  const handler = mediaChildren?.find(({ type }) => type === "hdlr");
  const info = mediaChildren?.find(({ type }) => type === "minf");
  if (!handler || !info || handler.end - handler.body < 12) return null;
  const kind = text(bytes, handler.body + 8, 4);
  const plays = PICTURE_OR_SOUND.has(kind);
  // A track that neither plays as picture nor sound is blanked whole, whatever its tables say.
  if (!plays) return { id, box, plays, children, samples: [] };
  const infoChildren = boxesIn(bytes, info.body, info.end);
  const table = infoChildren?.find(({ type }) => type === "stbl");
  const tableChildren = table && boxesIn(bytes, table.body, table.end);
  const references = infoChildren?.find(({ type }) => type === "dinf");
  if (!tableChildren || (references && !selfContained(bytes, references))) return null;
  if (tableChildren.some(({ type }) => ENCRYPTION_DATA.has(type))) return null;
  if (sampleEntryTypes(bytes, tableChildren).some((type) => ENCRYPTED_ENTRIES.has(type)))
    return null;
  // Old QuickTime sound gives every frame a size of 1 and sizes its chunks from the sample
  // description. Read as one byte a frame, most of its sound would be zeroed, so it is refused.
  if (kind === "soun" && fixedSampleSize(bytes, tableChildren) === 1) return null;
  const samples = sampleRanges(bytes, tableChildren);
  return samples ? { id, box, plays, children, samples } : null;
}

/** Whether every data reference of a track points into this file rather than another one. */
function selfContained(bytes: Bytes, references: Box): boolean {
  const children = boxesIn(bytes, references.body, references.end);
  const list = children?.find(({ type }) => type === "dref");
  if (!list) return true;
  const entries = list.body + 8 <= list.end ? boxesIn(bytes, list.body + 8, list.end) : null;
  // Flag 1 in an entry's version and flags means the data is in this same file.
  return !!entries && entries.every((entry) => (bytes[entry.body + 3] & 1) === 1);
}

function sampleEntryTypes(bytes: Bytes, table: Box[]): string[] {
  const descriptions = table.find(({ type }) => type === "stsd");
  if (!descriptions || descriptions.body + 8 > descriptions.end) return [];
  return (boxesIn(bytes, descriptions.body + 8, descriptions.end) ?? []).map(({ type }) => type);
}
