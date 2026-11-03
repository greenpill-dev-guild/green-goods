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

type Bytes = Uint8Array<ArrayBuffer>;

/** Bytes to write over part of the file, zeros where none are given. */
interface Patch {
  start: number;
  end: number;
  bytes?: Bytes;
}

type Range = [start: number, end: number];

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
    if (hasBytes(bytes, 0, EBML_MAGIC)) return matroskaPatches(bytes);
    return ISO_FIRST_BOXES.has(text(bytes, 4, 4)) ? isoPatches(bytes) : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// MP4 and QuickTime
// ---------------------------------------------------------------------------

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

/** Data a track's encryption keeps beside its samples. */
const ENCRYPTION_DATA = new Set(["saio", "saiz", "senc"]);

const PICTURE_OR_SOUND = new Set(["vide", "soun"]);

interface Box {
  type: string;
  start: number;
  /** The end of the size fields, where a blanked box's zeros begin. */
  sized: number;
  /** Where the content starts, after a `uuid` box's extended type. */
  body: number;
  end: number;
}

interface Track {
  id: number;
  box: Box;
  plays: boolean;
  children: Box[];
  /** Where the samples the track's own tables list lie. */
  samples: Range[];
}

/**
 * What has to be written for an MP4 or QuickTime movie to keep only what its
 * picture and sound play from, or null when its structure cannot be read in
 * full: boxes that do not fit, a compressed, referenced or encrypted movie,
 * samples outside the file, or a box to blank that a sample lies in.
 */
function isoPatches(bytes: Bytes): Patch[] | null {
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

/**
 * Where a track's samples lie, from its sample table: the chunks' offsets, how
 * many samples each chunk holds, and each sample's size. A chunk's samples sit
 * end to end, so each chunk is one range. Null when the tables are missing or
 * disagree.
 */
function sampleRanges(bytes: Bytes, table: Box[]): Range[] | null {
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
function fixedSampleSize(bytes: Bytes, table: Box[]): number {
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
    if (fixed) return { count, of: () => fixed };
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
function defaultSampleSizes(bytes: Bytes, movie: Box[]): Map<number, number> {
  const view = viewOf(bytes);
  const sizes = new Map<number, number>();
  const mvex = movie.find(({ type }) => type === "mvex");
  for (const box of (mvex && boxesIn(bytes, mvex.body, mvex.end)) ?? []) {
    if (box.type === "trex" && box.body + 24 <= box.end)
      sizes.set(view.getUint32(box.body + 4), view.getUint32(box.body + 16));
  }
  return sizes;
}

function fragmentTrackId(bytes: Bytes, parts: Box[]): number {
  const header = parts.find(({ type }) => type === "tfhd");
  return header && header.body + 8 <= header.end ? viewOf(bytes).getUint32(header.body + 4) : -1;
}

/**
 * Where the picture and sound samples of one movie fragment lie, from its
 * track fragments' runs, or null when they cannot be read. Every run is
 * walked, since a track fragment with no offset of its own starts where the
 * one before it ended.
 */
function fragmentSamples(
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
        if (playing.has(id)) ranges.push([position, position + size]);
        position += size;
      }
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
function boxesIn(bytes: Bytes, start: number, end: number, file = false): Box[] | null {
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
function merged(ranges: Range[]): Range[] {
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

// ---------------------------------------------------------------------------
// WebM and Matroska
// ---------------------------------------------------------------------------

const EBML_MAGIC = [0x1a, 0x45, 0xdf, 0xa3];
const EBML = 0x1a45dfa3;
const SEGMENT = 0x18538067;
const DOC_TYPE = 0x4282;
const INFO = 0x1549a966;
const TRACKS = 0x1654ae6b;
const TRACK_ENTRY = 0xae;
const TRACK_TYPE = 0x83;
const CONTENT_ENCODINGS = 0x6d80;
const CLUSTER = 0x1f43b675;
const VOID = 0xec;
const CRC32 = 0xbf;

/** Level-one elements a WebM plays from; the rest (tags, attachments, chapters) are voided. */
const MATROSKA_STRUCTURE = new Set([0x114d9b74, INFO, TRACKS, CLUSTER, 0x1c53bb6b, CRC32]);

/**
 * Every level-one element Matroska defines. An element of unknown size, such
 * as a recording browser's cluster, ends only where one of these, a segment or
 * an EBML header begins (RFC 8794); anything else inside it is its own.
 */
const LEVEL_ONE = new Set([
  0x114d9b74,
  INFO,
  TRACKS,
  CLUSTER,
  0x1c53bb6b,
  0x1043a770,
  0x1254c367,
  0x1941a469,
]);

/** The segment's title, file names and recording date, and a track's name. */
const MATROSKA_METADATA = new Set([0x7ba9, 0x7384, 0x3c83ab, 0x3e83bb, 0x4461, 0x536e]);

const VIDEO_TRACK = 1;
const AUDIO_TRACK = 2;

interface Element {
  id: number;
  start: number;
  body: number;
  end: number;
  /** False for an element whose size field says it runs until something ends it. */
  sized: boolean;
}

/**
 * What has to be written for a WebM to keep only what its picture and sound
 * play from: its tags, attachments, chapters and unknown elements voided, and
 * its title, recording date and track names with them. Null when the file is
 * not a WebM or Matroska file this can read in full, or carries a track that is
 * neither picture nor sound, or an encrypted one.
 */
function matroskaPatches(bytes: Bytes): Patch[] | null {
  const header = elementAt(bytes, 0, bytes.length);
  if (!header) return null;
  const docType = childrenOf(bytes, header)?.find((child) => child.id === DOC_TYPE);
  if (!docType || docType.end - docType.body > 16) return null;
  // An EBML string may be padded with trailing zero bytes.
  const type = text(bytes, docType.body, docType.end - docType.body).split("\0")[0];
  if (type !== "webm" && type !== "matroska") return null;
  const segment = elementAt(bytes, header.end, bytes.length);
  // Anything after the segment would be published unread.
  if (!segment || segment.id !== SEGMENT || segment.end !== bytes.length) return null;

  const elements = childrenOf(bytes, segment);
  if (!elements) return null;
  // A cluster that runs until something ends it, inside a segment that gives its size, is
  // where players' seeking goes wrong once an element the seek head names is voided.
  if (segment.sized && elements.some(({ id, sized }) => id === CLUSTER && !sized)) return null;
  const patches: Patch[] = [];
  for (const element of elements) {
    // Every level-one ID is four bytes; only Void and CRC-32 may be shorter. Anything else
    // means the file was not read as its writer meant.
    if (element.id < 0x10000000 && element.id !== VOID && element.id !== CRC32) return null;
    if (element.id === VOID) patches.push({ start: element.body, end: element.end });
    else if (!MATROSKA_STRUCTURE.has(element.id)) patches.push(...voided(element));
    else if (element.id === INFO) {
      const cleared = clearedChildren(bytes, element);
      if (!cleared) return null;
      patches.push(...cleared);
    } else if (element.id === TRACKS) {
      const entries = childrenOf(bytes, element);
      if (!entries) return null;
      let named = false;
      for (const entry of entries.filter((child) => child.id === TRACK_ENTRY)) {
        const fields = childrenOf(bytes, entry);
        const kind = fields?.find((field) => field.id === TRACK_TYPE);
        const value = kind && unsigned(bytes, kind);
        if (value !== VIDEO_TRACK && value !== AUDIO_TRACK) return null;
        if (fields!.some((field) => field.id === CONTENT_ENCODINGS)) return null;
        const cleared = clearedChildren(bytes, entry);
        if (!cleared) return null;
        named ||= cleared.length > 0;
        patches.push(...cleared);
      }
      // A checksum over the entries would no longer match once a name is voided.
      if (named) patches.push(...entries.filter(({ id }) => id === CRC32).flatMap(voided));
    }
  }
  // Nor would a checksum over the whole segment, once anything in it changes.
  if (patches.some((patch) => !alreadyWritten(bytes, patch)))
    patches.push(...elements.filter(({ id }) => id === CRC32).flatMap(voided));
  return patches;
}

/** An element's children with its metadata voided, and its checksum when anything was. */
function clearedChildren(bytes: Bytes, parent: Element): Patch[] | null {
  const children = childrenOf(bytes, parent);
  if (!children) return null;
  const metadata = children.filter(({ id }) => MATROSKA_METADATA.has(id));
  if (!metadata.length) return [];
  return [...metadata, ...children.filter(({ id }) => id === CRC32)].flatMap(voided);
}

/**
 * The elements laid end to end inside `parent`, or null when they do not fit.
 * A segment or cluster of unknown size, as a recording browser writes them,
 * runs to the end of the file or to the next element that cannot be inside it.
 */
function childrenOf(bytes: Bytes, parent: Element): Element[] | null {
  const children: Element[] = [];
  let position = parent.body;
  while (position < parent.end) {
    const element = elementAt(bytes, position, parent.end);
    if (!element) return null;
    if (element.id === CLUSTER && element.end === -1) {
      element.end = clusterEnd(bytes, element, parent.end);
      if (element.end === -1) return null;
    }
    if (element.end === -1) return null;
    children.push(element);
    position = element.end;
  }
  return children;
}

function clusterEnd(bytes: Bytes, cluster: Element, limit: number): number {
  let position = cluster.body;
  while (position < limit) {
    const element = elementAt(bytes, position, limit);
    if (!element) return -1;
    if (LEVEL_ONE.has(element.id) || element.id === SEGMENT || element.id === EBML) return position;
    if (element.end === -1) return -1;
    position = element.end;
  }
  return position;
}

/**
 * The element at `position`: an ID of up to four bytes, then a size of up to
 * eight. An unknown size, all ones, gives an end of -1, except for a segment,
 * which then runs to `limit`.
 */
function elementAt(bytes: Bytes, position: number, limit: number): Element | null {
  const id = vint(bytes, position, 4);
  if (!id) return null;
  const size = vint(bytes, position + id.length, 8);
  if (!size) return null;
  const body = position + id.length + size.length;
  const unknown = size.value === 2 ** (7 * size.length) - 1;
  const idValue = id.raw;
  if (unknown)
    return {
      id: idValue,
      start: position,
      body,
      end: idValue === SEGMENT ? limit : -1,
      sized: false,
    };
  const end = body + size.value;
  return end <= limit ? { id: idValue, start: position, body, end, sized: true } : null;
}

/** A variable-length integer: its length from the leading zeros, its value without that marker. */
function vint(
  bytes: Bytes,
  position: number,
  maxLength: number
): { length: number; value: number; raw: number } | null {
  const first = bytes[position];
  if (first === undefined || first === 0) return null;
  const length = Math.clz32(first) - 23;
  if (length > maxLength || position + length > bytes.length) return null;
  let value = first & (0xff >> length);
  let raw = first;
  for (let index = 1; index < length; index += 1) {
    value = value * 256 + bytes[position + index];
    raw = raw * 256 + bytes[position + index];
  }
  return { length, value, raw };
}

function unsigned(bytes: Bytes, element: Element): number {
  let value = 0;
  for (let index = element.body; index < element.end; index += 1)
    value = value * 256 + bytes[index];
  return value;
}

/** An element replaced, at the same length, by a Void element holding zeros. */
function voided(element: Element): Patch[] {
  const length = element.end - element.start;
  for (let sizeLength = 1; sizeLength <= 8; sizeLength += 1) {
    const content = length - 1 - sizeLength;
    if (content < 0 || content > 2 ** (7 * sizeLength) - 2) continue;
    const header = new Uint8Array(1 + sizeLength);
    header[0] = VOID;
    let value = content + 2 ** (7 * sizeLength);
    for (let index = sizeLength; index >= 1; index -= 1) {
      header[index] = value % 256;
      value = Math.floor(value / 256);
    }
    return [
      { start: element.start, end: element.start + header.length, bytes: header },
      { start: element.start + header.length, end: element.end },
    ];
  }
  return [];
}

// ---------------------------------------------------------------------------
// Bytes
// ---------------------------------------------------------------------------

/** Whether the file already holds what a patch would write. */
function alreadyWritten(bytes: Bytes, { start, end, bytes: written }: Patch): boolean {
  for (let index = start; index < end; index += 1)
    if (bytes[index] !== (written ? written[index - start] : 0)) return false;
  return true;
}

function hasBytes(bytes: Bytes, offset: number, expected: number[]): boolean {
  return expected.every((byte, index) => bytes[offset + index] === byte);
}

function text(bytes: Bytes, offset: number, length: number): string {
  let value = "";
  for (let index = offset; index < Math.min(offset + length, bytes.length); index += 1)
    value += String.fromCharCode(bytes[index]);
  return value;
}

function ascii(value: string): Bytes {
  return Uint8Array.from(value, (character) => character.charCodeAt(0));
}

function viewOf(bytes: Bytes): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}
