/**
 * WebM and Matroska videos without their metadata
 *
 * What a WebM has to have written over it to keep only what its picture and
 * sound play from (`video-metadata.ts` says what goes and why).
 *
 * @module modules/media/webm-metadata
 */

import { type Bytes, type Patch, alreadyWritten, hasBytes, text } from "./video-bytes";

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

/** Whether the bytes start like a WebM or Matroska file: an EBML header. */
export function startsLikeMatroska(bytes: Bytes): boolean {
  return hasBytes(bytes, 0, EBML_MAGIC);
}

/**
 * What has to be written for a WebM to keep only what its picture and sound
 * play from: its tags, attachments, chapters and unknown elements voided, and
 * its title, recording date and track names with them. Null when the file is
 * not a WebM or Matroska file this can read in full, or carries a track that is
 * neither picture nor sound, or an encrypted one.
 */
export function matroskaPatches(bytes: Bytes): Patch[] | null {
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
