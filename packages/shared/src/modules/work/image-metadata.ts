/**
 * Photos without the metadata cameras write into them
 *
 * A work photo is pinned to public IPFS and named on an attestation, and
 * neither can be withdrawn. Cameras write where a photo was taken, the device
 * that took it and much else into the file itself, so a photo loses that
 * metadata before it can be published. The garden keeps its own record of
 * where work happened: the rounded location stored beside the photo, never the
 * camera's.
 *
 * Only metadata is removed. The encoded image is copied byte for byte, with no
 * decoder or canvas involved, so a photo of any size keeps its quality. Two
 * things that change how a photo looks stay: its color profile, and the EXIF
 * Orientation, rewritten as the only tag (`exif-orientation.ts`), since without
 * it a portrait photo shows on its side.
 *
 * @module modules/work/image-metadata
 */

import { orientationExif } from "./exif-orientation";

type Bytes = Uint8Array<ArrayBuffer>;

/** A photo's bytes as they may be published; `changed` is false when nothing had to go. */
interface Rewrite {
  parts: Bytes[];
  changed: boolean;
}

const JPEG_START = "\xff\xd8";
const PNG_SIGNATURE = "\x89PNG\r\n\x1a\n";
const EXIF_HEADER = "Exif\0\0";

/**
 * The photo as it may be published: a JPEG, PNG or WebP without its location,
 * camera, editing or other metadata, under the same name and type. The same
 * file comes back when there was nothing to remove. Null when the bytes are not
 * an image this can read, so the caller refuses the photo rather than publish
 * what it could not check.
 */
export async function withoutImageMetadata(file: File): Promise<File | null> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const rewrite = hasText(bytes, 0, JPEG_START)
    ? rewriteJpeg(bytes)
    : hasText(bytes, 0, PNG_SIGNATURE)
      ? rewritePng(bytes)
      : hasText(bytes, 0, "RIFF") && hasText(bytes, 8, "WEBP")
        ? rewriteWebp(bytes)
        : null;
  if (!rewrite) return null;
  if (!rewrite.changed) return file;
  return new File(rewrite.parts, file.name, { type: file.type, lastModified: file.lastModified });
}

// ---------------------------------------------------------------------------
// JPEG
// ---------------------------------------------------------------------------

const EOI = 0xd9;
const SOS = 0xda;
const APP0 = 0xe0;
const APP1 = 0xe1;
const APP2 = 0xe2;
const APP14 = 0xee;
const APP15 = 0xef;
const COM = 0xfe;

/**
 * A JPEG's segments without metadata. Kept: the tables, frames and scans the
 * image is decoded from, a JFIF header without a thumbnail, the color profile
 * and Adobe's color transform. Removed: EXIF, XMP, IPTC, every other application
 * segment, comments, stray bytes between segments, and anything after the image
 * ends, where phones append second pictures such as depth maps.
 */
function rewriteJpeg(bytes: Bytes): Rewrite | null {
  const view = viewOf(bytes);
  const parts: Bytes[] = [bytes.subarray(0, 2)];
  let changed = false;
  let exifRead = false;
  let scanned = false;
  let position = 2;
  while (position < bytes.length) {
    if (bytes[position] !== 0xff) {
      // Stray bytes between segments, which decoders skip too, are dropped.
      const marker = bytes.indexOf(0xff, position);
      if (marker === -1) break;
      changed = true;
      position = marker;
    }
    const start = position;
    // Any number of 0xFF fill bytes may come before a marker.
    while (bytes[position] === 0xff) position += 1;
    const marker = bytes[position];
    position += 1;
    if (marker === undefined) break;
    if (marker === EOI) {
      parts.push(bytes.subarray(start, position));
      return { parts, changed: changed || position < bytes.length };
    }
    if (marker === 0x00 || marker === 0xd8) return null;
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      // A restart marker or TEM stands alone, with no length.
      parts.push(bytes.subarray(start, position));
      continue;
    }
    if (position + 2 > bytes.length) return null;
    const end = position + view.getUint16(position);
    if (end < position + 2 || end > bytes.length) return null;
    if (marker === SOS) {
      scanned = true;
      position = endOfScan(bytes, end);
      parts.push(bytes.subarray(start, position));
      continue;
    }
    const payload = bytes.subarray(position + 2, end);
    const isMetadata = (marker >= APP0 && marker <= APP15) || marker === COM;
    if (!isMetadata || keepsSegment(marker, payload)) {
      parts.push(bytes.subarray(start, end));
    } else if (marker === APP1 && !exifRead && hasText(payload, 0, EXIF_HEADER)) {
      // Decoders read the first EXIF segment's Orientation, so that one is carried over.
      exifRead = true;
      const { tiff, same } = orientationExif(payload.subarray(EXIF_HEADER.length));
      if (same) parts.push(bytes.subarray(start, end));
      else {
        changed = true;
        if (tiff) parts.push(exifSegment(tiff));
      }
    } else {
      changed = true;
    }
    position = end;
  }
  // The file stops after a scan without its end marker: keep what it holds, closed with one.
  if (!scanned) return null;
  parts.push(Uint8Array.of(0xff, EOI));
  return { parts, changed: true };
}

/** The application segments a decoder can need. A JFIF thumbnail can show what a crop removed. */
function keepsSegment(marker: number, payload: Bytes): boolean {
  if (marker === APP0) return hasText(payload, 0, "JFIF\0") && (!payload[12] || !payload[13]);
  if (marker === APP2) return hasText(payload, 0, "ICC_PROFILE\0");
  if (marker === APP14) return hasText(payload, 0, "Adobe");
  return false;
}

/** Where the marker after a scan's entropy-coded data starts, or the end of the bytes. */
function endOfScan(bytes: Bytes, from: number): number {
  for (
    let index = bytes.indexOf(0xff, from);
    index !== -1 && index + 1 < bytes.length;
    index = bytes.indexOf(0xff, index + 1)
  ) {
    const next = bytes[index + 1];
    // A stuffed zero, a restart marker or a fill byte belongs to the scan; any other marker ends it.
    if (next !== 0x00 && next !== 0xff && (next < 0xd0 || next > 0xd7)) return index;
  }
  return bytes.length;
}

function exifSegment(tiff: Bytes): Bytes {
  const segment = new Uint8Array(4 + EXIF_HEADER.length + tiff.length);
  const length = segment.length - 2;
  segment.set([0xff, APP1, length >> 8, length & 0xff]);
  segment.set(ascii(EXIF_HEADER), 4);
  segment.set(tiff, 4 + EXIF_HEADER.length);
  return segment;
}

// ---------------------------------------------------------------------------
// PNG
// ---------------------------------------------------------------------------

/** Ancillary chunks that change how a PNG looks or animates. Every other ancillary chunk goes. */
const PNG_RENDERING_CHUNKS = new Set(
  "tRNS gAMA cHRM sRGB iCCP sBIT pHYs bKGD hIST sPLT cICP mDCv cLLi acTL fcTL fdAT".split(" ")
);

/**
 * A PNG's chunks without metadata: text, XMP (carried as text), EXIF,
 * timestamps and any chunk that does not draw the image are removed, along
 * with anything after its end.
 */
function rewritePng(bytes: Bytes): Rewrite | null {
  const view = viewOf(bytes);
  const parts: Bytes[] = [bytes.subarray(0, PNG_SIGNATURE.length)];
  let changed = false;
  let exifRead = false;
  let position = PNG_SIGNATURE.length;
  while (position + 12 <= bytes.length) {
    const end = position + 12 + view.getUint32(position);
    if (end > bytes.length) return null;
    const type = String.fromCharCode(...bytes.subarray(position + 4, position + 8));
    // A critical chunk, named with a capital first letter, is part of the image itself.
    const critical = (bytes[position + 4] & 0x20) === 0;
    if (critical || PNG_RENDERING_CHUNKS.has(type)) {
      parts.push(bytes.subarray(position, end));
    } else if (type === "eXIf" && !exifRead) {
      exifRead = true;
      const { tiff, same } = orientationExif(bytes.subarray(position + 8, end - 4));
      if (same) parts.push(bytes.subarray(position, end));
      else {
        changed = true;
        if (tiff) parts.push(pngChunk("eXIf", tiff));
      }
    } else {
      changed = true;
    }
    position = end;
    if (type === "IEND") return { parts, changed: changed || position < bytes.length };
  }
  return null;
}

function pngChunk(type: string, data: Bytes): Bytes {
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  chunk.set(ascii(type), 4);
  chunk.set(data, 8);
  view.setUint32(8 + data.length, crc32(chunk.subarray(4, 8 + data.length)));
  return chunk;
}

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, byte) => {
  let value = byte;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(bytes: Bytes): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// ---------------------------------------------------------------------------
// WebP
// ---------------------------------------------------------------------------

/** The chunks a WebP is drawn from, with its color profile. EXIF, XMP and unknown chunks go. */
const WEBP_IMAGE_CHUNKS = new Set(["VP8X", "VP8 ", "VP8L", "ALPH", "ANIM", "ANMF", "ICCP"]);
const WEBP_EXIF_FLAG = 0x08;
const WEBP_XMP_FLAG = 0x04;

/**
 * A WebP's chunks without metadata, with the extended header's EXIF and XMP
 * flags saying what is left and anything after the RIFF container removed.
 */
function rewriteWebp(bytes: Bytes): Rewrite | null {
  const view = viewOf(bytes);
  const riffEnd = 8 + view.getUint32(4, true);
  if (riffEnd > bytes.length) return null;
  const chunks: Bytes[] = [];
  let changed = riffEnd < bytes.length;
  let header: { index: number; chunk: Bytes } | undefined;
  let exifRead = false;
  let exifKept = false;
  let position = 12;
  while (position < riffEnd) {
    if (position + 8 > riffEnd) return null;
    const fourcc = String.fromCharCode(...bytes.subarray(position, position + 4));
    const size = view.getUint32(position + 4, true);
    if (position + 8 + size > riffEnd) return null;
    // A chunk is padded to an even length; a last chunk missing its pad byte is read as it is.
    const end = Math.min(position + 8 + size + (size % 2), riffEnd);
    if (WEBP_IMAGE_CHUNKS.has(fourcc)) {
      if (fourcc === "VP8X") {
        if (size < 10) return null;
        header = { index: chunks.length, chunk: bytes.subarray(position, end) };
      }
      chunks.push(bytes.subarray(position, end));
    } else if (fourcc === "EXIF" && header && !exifRead) {
      // Only the extended format carries EXIF that a decoder reads.
      exifRead = true;
      const data = bytes.subarray(position + 8, position + 8 + size);
      // Some writers keep JPEG's "Exif\0\0" in front of the TIFF structure.
      const { tiff, same } = orientationExif(
        hasText(data, 0, EXIF_HEADER) ? data.subarray(EXIF_HEADER.length) : data
      );
      exifKept = tiff !== undefined;
      if (same) chunks.push(bytes.subarray(position, end));
      else {
        changed = true;
        if (tiff) chunks.push(webpChunk("EXIF", tiff));
      }
    } else {
      changed = true;
    }
    position = end;
  }
  if (!changed) return { parts: [bytes], changed: false };
  if (header) {
    const rewritten = header.chunk.slice();
    rewritten[8] =
      (rewritten[8] & ~(WEBP_EXIF_FLAG | WEBP_XMP_FLAG)) | (exifKept ? WEBP_EXIF_FLAG : 0);
    chunks[header.index] = rewritten;
  }
  const riff = new Uint8Array(12);
  riff.set(ascii("RIFF"));
  new DataView(riff.buffer).setUint32(
    4,
    4 + chunks.reduce((sum, chunk) => sum + chunk.length, 0),
    true
  );
  riff.set(ascii("WEBP"), 8);
  return { parts: [riff, ...chunks], changed: true };
}

function webpChunk(fourcc: string, data: Bytes): Bytes {
  const chunk = new Uint8Array(8 + data.length + (data.length % 2));
  chunk.set(ascii(fourcc));
  new DataView(chunk.buffer).setUint32(4, data.length, true);
  chunk.set(data, 8);
  return chunk;
}

// ---------------------------------------------------------------------------
// Bytes
// ---------------------------------------------------------------------------

function hasText(bytes: Bytes, offset: number, text: string): boolean {
  if (offset + text.length > bytes.length) return false;
  for (let index = 0; index < text.length; index += 1)
    if (bytes[offset + index] !== text.charCodeAt(index)) return false;
  return true;
}

function ascii(text: string): Bytes {
  return Uint8Array.from(text, (character) => character.charCodeAt(0));
}

function viewOf(bytes: Bytes): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}
