import { inflateRawSync } from "node:zlib";

/**
 * Format detection from bytes, never from a name or declared type, plus a bounded inspection of
 * Office containers. A DOCX or XLSX is a ZIP: its central directory is read without trusting any
 * size it claims, and macros, encrypted entries, external relationships and archives that expand
 * far beyond their size are refused before any parser or converter sees them.
 */
export type DetectedType =
  | { kind: "image"; mime: "image/jpeg" | "image/png" | "image/webp" }
  | { kind: "pdf"; mime: "application/pdf" }
  | { kind: "docx" | "xlsx"; mime: string }
  | { kind: "csv"; mime: "text/csv" }
  | { kind: "audio"; mime: string }
  | { kind: "video"; mime: string }
  | { kind: "unsupported"; reason: UnsupportedReason };

export type UnsupportedReason =
  | "unknown_format"
  | "legacy_office"
  | "macro_enabled"
  | "encrypted"
  | "external_content"
  | "archive_limits"
  | "corrupt";

const OFFICE_LIMITS = {
  maxEntries: 2_000,
  maxExpandedBytes: 64 * 1024 * 1024,
  maxRatio: 100,
  maxRelsBytes: 256 * 1024,
};

const starts = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((value, index) => bytes[offset + index] === value);
const ascii = (bytes: Uint8Array, offset: number, length: number) =>
  String.fromCharCode(...bytes.subarray(offset, offset + length));

interface ZipEntry {
  name: string;
  flags: number;
  method: number;
  compressedSize: number;
  size: number;
  localOffset: number;
}

/** Reads the central directory; returns null for anything that is not a well-formed ZIP. */
function zipEntries(bytes: Uint8Array): ZipEntry[] | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const floor = Math.max(0, bytes.length - 22 - 65_535);
  let end = -1;
  for (let offset = bytes.length - 22; offset >= floor; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      end = offset;
      break;
    }
  }
  if (end < 0) return null;
  const count = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true);
  // ZIP64 markers and oversized directories are outside the bounds of a report attachment.
  if (count > OFFICE_LIMITS.maxEntries || count === 0xffff || offset === 0xffffffff) return [];
  const entries: ZipEntry[] = [];
  for (let index = 0; index < count; index += 1) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== 0x02014b50) return null;
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    entries.push({
      flags: view.getUint16(offset + 8, true),
      method: view.getUint16(offset + 10, true),
      compressedSize: view.getUint32(offset + 20, true),
      size: view.getUint32(offset + 24, true),
      localOffset: view.getUint32(offset + 42, true),
      name: new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength)),
    });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

/** Inflates one small entry with a hard output cap; claimed sizes are not trusted. */
function readZipEntry(bytes: Uint8Array, entry: ZipEntry, maxBytes: number): Uint8Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const local = entry.localOffset;
  if (view.getUint32(local, true) !== 0x04034b50) throw new Error("corrupt local header");
  const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
  const data = bytes.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) return data.subarray(0, maxBytes);
  if (entry.method !== 8) throw new Error("unsupported compression");
  return new Uint8Array(inflateRawSync(data, { maxOutputLength: maxBytes }));
}

function inspectOffice(bytes: Uint8Array): DetectedType {
  const entries = zipEntries(bytes);
  if (!entries) return { kind: "unsupported", reason: "corrupt" };
  if (entries.length === 0) return { kind: "unsupported", reason: "archive_limits" };
  const names = new Set(entries.map((entry) => entry.name));
  const expanded = entries.reduce((total, entry) => total + entry.size, 0);
  const packed = entries.reduce((total, entry) => total + entry.compressedSize, 0);
  if (entries.some((entry) => (entry.flags & 0x1) !== 0))
    return { kind: "unsupported", reason: "encrypted" };
  if (
    expanded > OFFICE_LIMITS.maxExpandedBytes ||
    expanded > Math.max(packed, 1) * OFFICE_LIMITS.maxRatio
  ) {
    return { kind: "unsupported", reason: "archive_limits" };
  }
  if ([...names].some((name) => /(^|\/)(vbaProject\.bin|activeX\/)/i.test(name))) {
    return { kind: "unsupported", reason: "macro_enabled" };
  }
  const types = entries.find((entry) => entry.name === "[Content_Types].xml");
  if (types) {
    try {
      const xml = new TextDecoder().decode(readZipEntry(bytes, types, OFFICE_LIMITS.maxRelsBytes));
      if (/macroEnabled/i.test(xml)) return { kind: "unsupported", reason: "macro_enabled" };
    } catch {
      return { kind: "unsupported", reason: "corrupt" };
    }
  }
  for (const entry of entries.filter((candidate) => candidate.name.endsWith(".rels"))) {
    let rels: string;
    try {
      rels = new TextDecoder().decode(readZipEntry(bytes, entry, OFFICE_LIMITS.maxRelsBytes));
    } catch {
      return { kind: "unsupported", reason: "corrupt" };
    }
    if (/TargetMode\s*=\s*"External"/i.test(rels)) {
      return { kind: "unsupported", reason: "external_content" };
    }
  }
  if (names.has("word/document.xml")) {
    return {
      kind: "docx",
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
  }
  if (names.has("xl/workbook.xml")) {
    return {
      kind: "xlsx",
      mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  }
  return { kind: "unsupported", reason: "unknown_format" };
}

function looksLikeCsv(bytes: Uint8Array): boolean {
  if (bytes.length === 0 || bytes.includes(0)) return false;
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, 64 * 1024));
  } catch {
    return false;
  }
  const lines = text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .slice(0, 20);
  if (lines.length < 2) return false;
  const separator = [",", ";", "\t"].find((candidate) => lines[0]?.includes(candidate));
  if (!separator) return false;
  const width = lines[0]?.split(separator).length ?? 0;
  return width > 1 && lines.every((line) => Math.abs(line.split(separator).length - width) <= 1);
}

export function detectType(bytes: Uint8Array): DetectedType {
  if (starts(bytes, [0xff, 0xd8, 0xff])) return { kind: "image", mime: "image/jpeg" };
  if (starts(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return { kind: "image", mime: "image/png" };
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP")
    return { kind: "image", mime: "image/webp" };
  if (ascii(bytes, 0, 5) === "%PDF-") return { kind: "pdf", mime: "application/pdf" };
  if (starts(bytes, [0x50, 0x4b, 0x03, 0x04])) return inspectOffice(bytes);
  if (starts(bytes, [0xd0, 0xcf, 0x11, 0xe0]))
    return { kind: "unsupported", reason: "legacy_office" };
  if (ascii(bytes, 0, 4) === "OggS") return { kind: "audio", mime: "audio/ogg" };
  if (ascii(bytes, 0, 3) === "ID3" || starts(bytes, [0xff, 0xfb]))
    return { kind: "audio", mime: "audio/mpeg" };
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WAVE")
    return { kind: "audio", mime: "audio/wav" };
  if (ascii(bytes, 4, 4) === "ftyp") {
    const brand = ascii(bytes, 8, 4);
    return brand.startsWith("M4A")
      ? { kind: "audio", mime: "audio/mp4" }
      : { kind: "video", mime: "video/mp4" };
  }
  if (starts(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return { kind: "video", mime: "video/webm" };
  if (looksLikeCsv(bytes)) return { kind: "csv", mime: "text/csv" };
  return { kind: "unsupported", reason: "unknown_format" };
}
