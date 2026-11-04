/**
 * Where an MP4 or QuickTime movie's samples lie
 *
 * A movie's picture and sound are samples in its media data. A plain movie
 * lists them in each track's sample table; a fragmented one in the runs of
 * each fragment. A video keeps exactly those bytes, so they are read here in
 * full, or not at all.
 *
 * @module modules/media/mp4-samples
 */

import { type Bytes, type Range, text, viewOf } from "./video-bytes";

/** Data a track's encryption keeps beside its samples. */
export const ENCRYPTION_DATA = new Set(["saio", "saiz", "senc"]);

export interface Box {
  type: string;
  start: number;
  /** The end of the size fields, where a blanked box's zeros begin. */
  sized: number;
  /** Where the content starts, after a `uuid` box's extended type. */
  body: number;
  end: number;
}

/**
 * Where a track's samples lie, from its sample table: the chunks' offsets, how
 * many samples each chunk holds, and each sample's size. A chunk's samples sit
 * end to end, so each chunk is one range. Null when the tables are missing or
 * disagree.
 */
export function sampleRanges(bytes: Bytes, table: Box[]): Range[] | null {
  const view = viewOf(bytes);
  const find = (type: string) => table.find((box) => box.type === type);
  const toChunk = find("stsc");
  const chunks = find("stco") ?? find("co64");
  const sizes = find("stsz") ?? find("stz2");
  if (!toChunk || !chunks || !sizes) return null;

  const runs = countedEntries(toChunk, 12);
  const chunkCount = countedEntries(chunks, chunks.type === "co64" ? 8 : 4);
  if (runs === null || chunkCount === null) return null;
  const offsets = Array.from({ length: chunkCount }, (_, index) =>
    chunks.type === "co64"
      ? Number(view.getBigUint64(chunks.body + 8 + 8 * index))
      : view.getUint32(chunks.body + 8 + 4 * index)
  );
  const sampleSize = sampleSizes(bytes, sizes);
  if (!sampleSize) return null;

  const ranges: Range[] = [];
  let run = 0;
  let sample = 0;
  for (let chunk = 1; chunk <= chunkCount && sample < sampleSize.count; chunk += 1) {
    while (run + 1 < runs && view.getUint32(toChunk.body + 8 + 12 * (run + 1)) <= chunk) run += 1;
    if (!runs || view.getUint32(toChunk.body + 8 + 12 * run) > chunk) return null;
    const start = offsets[chunk - 1];
    let position = start;
    const perChunk = view.getUint32(toChunk.body + 12 + 12 * run);
    for (let index = 0; index < perChunk && sample < sampleSize.count; index += 1, sample += 1)
      position += sampleSize.of(sample);
    ranges.push([start, position]);
  }
  return sample === sampleSize.count ? ranges : null;

  /** How many fixed-size entries follow a full box's count, or null when they overrun it. */
  function countedEntries(box: Box, entrySize: number): number | null {
    if (box.body + 8 > box.end) return null;
    const count = view.getUint32(box.body + 4);
    return box.body + 8 + count * entrySize <= box.end ? count : null;
  }
}

/** The size every sample of a track shares, from its `stsz` box; 0 when each has its own. */
export function fixedSampleSize(bytes: Bytes, table: Box[]): number {
  const sizes = table.find(({ type }) => type === "stsz");
  return sizes && sizes.body + 8 <= sizes.end ? viewOf(bytes).getUint32(sizes.body + 4) : 0;
}

function sampleSizes(
  bytes: Bytes,
  box: Box
): { count: number; of: (index: number) => number } | null {
  const view = viewOf(bytes);
  if (box.body + 12 > box.end) return null;
  const count = view.getUint32(box.body + 8);
  if (box.type === "stsz") {
    const fixed = view.getUint32(box.body + 4);
    // Samples that could not fit in the file are refused before any is counted.
    if (fixed) return fixed * count <= bytes.length ? { count, of: () => fixed } : null;
    if (box.body + 12 + 4 * count > box.end) return null;
    return { count, of: (index) => view.getUint32(box.body + 12 + 4 * index) };
  }
  // stz2 packs each size into 4, 8 or 16 bits.
  const bits = bytes[box.body + 7];
  if (![4, 8, 16].includes(bits) || box.body + 12 + Math.ceil((count * bits) / 8) > box.end)
    return null;
  const at = box.body + 12;
  return {
    count,
    of: (index) =>
      bits === 16
        ? view.getUint16(at + 2 * index)
        : bits === 8
          ? bytes[at + index]
          : (bytes[at + (index >> 1)] >> (index % 2 ? 0 : 4)) & 0x0f,
  };
}

/** Each track's default sample size for its fragments, from the movie's `trex` boxes. */
export function defaultSampleSizes(bytes: Bytes, movie: Box[]): Map<number, number> {
  const view = viewOf(bytes);
  const sizes = new Map<number, number>();
  const mvex = movie.find(({ type }) => type === "mvex");
  for (const box of (mvex && boxesIn(bytes, mvex.body, mvex.end)) ?? []) {
    if (box.type === "trex" && box.body + 24 <= box.end)
      sizes.set(view.getUint32(box.body + 4), view.getUint32(box.body + 16));
  }
  return sizes;
}

export function fragmentTrackId(bytes: Bytes, parts: Box[]): number {
  const header = parts.find(({ type }) => type === "tfhd");
  return header && header.body + 8 <= header.end ? viewOf(bytes).getUint32(header.body + 4) : -1;
}

/**
 * Where the picture and sound samples of one movie fragment lie, from its
 * track fragments' runs, or null when they cannot be read. Every run is
 * walked, since a track fragment with no offset of its own starts where the
 * one before it ended.
 */
export function fragmentSamples(
  bytes: Bytes,
  fragment: Box,
  defaultSizes: Map<number, number>,
  playing: Set<number>
): Range[] | null {
  const view = viewOf(bytes);
  const children = boxesIn(bytes, fragment.body, fragment.end);
  if (!children || children.some(({ type }) => type === "pssh")) return null;
  const ranges: Range[] = [];
  let previousEnd = fragment.start;
  let blankedBefore = false;
  for (const box of children.filter(({ type }) => type === "traf")) {
    const parts = boxesIn(bytes, box.body, box.end);
    const header = parts?.find(({ type }) => type === "tfhd");
    if (!parts || !header || header.body + 8 > header.end) return null;
    const id = view.getUint32(header.body + 4);
    if (playing.has(id) && parts.some(({ type }) => ENCRYPTION_DATA.has(type))) return null;
    const flags = view.getUint32(header.body) & 0xffffff;
    // A track fragment that names no base starts where the one before it ended. Once that one is
    // blanked, a player would count from somewhere else, so such a fragment is refused.
    if (!(flags & 0x1) && !(flags & 0x20000) && blankedBefore) return null;
    if (!playing.has(id)) blankedBefore = true;
    let field = header.body + 8;
    const take = (length: number) => {
      field += length;
      return field <= header.end;
    };
    let base = previousEnd;
    if (flags & 0x1) {
      if (!take(8)) return null;
      base = Number(view.getBigUint64(field - 8));
    } else if (flags & 0x20000) base = fragment.start;
    if (flags & 0x2 && !take(4)) return null;
    if (flags & 0x8 && !take(4)) return null;
    let defaultSize = defaultSizes.get(id);
    if (flags & 0x10) {
      if (!take(4)) return null;
      defaultSize = view.getUint32(field - 4);
    }
    let dataEnd = base;
    for (const run of parts.filter(({ type }) => type === "trun")) {
      if (run.body + 8 > run.end) return null;
      const runFlags = view.getUint32(run.body) & 0xffffff;
      const count = view.getUint32(run.body + 4);
      let at = run.body + 8;
      const perSample = 4 * [0x100, 0x200, 0x400, 0x800].filter((bit) => runFlags & bit).length;
      const fields = (runFlags & 0x1 ? 4 : 0) + (runFlags & 0x4 ? 4 : 0);
      if (at + fields + perSample * count > run.end) return null;
      let position = dataEnd;
      if (runFlags & 0x1) {
        position = base + view.getInt32(at);
        at += 4;
      }
      if (runFlags & 0x4) at += 4;
      const runStart = position;
      if (!perSample) {
        // With nothing given for each sample, the run's bytes do not bound its count, and every
        // sample takes the default size. So its extent is counted rather than walked.
        if (count > 0 && defaultSize === undefined) return null;
        position += (defaultSize ?? 0) * count;
      } else {
        for (let sample = 0; sample < count; sample += 1) {
          if (runFlags & 0x100) at += 4;
          let size = defaultSize;
          if (runFlags & 0x200) {
            size = view.getUint32(at);
            at += 4;
          }
          if (runFlags & 0x400) at += 4;
          if (runFlags & 0x800) at += 4;
          if (size === undefined) return null;
          position += size;
        }
      }
      // A run's samples sit end to end, so each run is one range.
      if (playing.has(id)) ranges.push([runStart, position]);
      dataEnd = position;
    }
    previousEnd = dataEnd;
  }
  return ranges;
}

/**
 * The boxes laid end to end from `start` to `end`, or null when they do not
 * fit it exactly. Only the last box of a file may give its size as zero and run
 * to the end.
 */
export function boxesIn(bytes: Bytes, start: number, end: number, file = false): Box[] | null {
  const view = viewOf(bytes);
  const boxes: Box[] = [];
  let position = start;
  while (position < end) {
    if (position + 8 > end) return null;
    let size = view.getUint32(position);
    let sized = position + 8;
    if (size === 1) {
      if (position + 16 > end) return null;
      size = Number(view.getBigUint64(position + 8));
      sized = position + 16;
    } else if (size === 0) {
      if (!file) return null;
      size = end - position;
    }
    const type = text(bytes, position + 4, 4);
    const body = type === "uuid" ? sized + 16 : sized;
    if (position + size > end || body > position + size) return null;
    boxes.push({ type, start: position, sized, body, end: position + size });
    position += size;
  }
  return boxes;
}

/** Ranges sorted and joined where they touch or overlap. */
export function merged(ranges: Range[]): Range[] {
  const sorted = ranges
    .filter(([start, end]) => end > start)
    .sort(([left], [right]) => left - right);
  const joined: Range[] = [];
  for (const [start, end] of sorted) {
    const last = joined.at(-1);
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else joined.push([start, end]);
  }
  return joined;
}
