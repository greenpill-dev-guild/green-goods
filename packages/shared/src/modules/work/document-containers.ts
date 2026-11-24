/**
 * The two containers Word files come in, read far enough to tell a Word
 * document from any other file in the same container.
 *
 * A `.docx` is a zip archive. It is a Word document when its central directory
 * lists the `[Content_Types].xml` and `word/document.xml` parts, and each part
 * has its local record, the header in front of its data. A `.doc` is a compound
 * file. It is a Word document when its directory holds a stream named
 * `WordDocument`. Both are read from the structures that name entries, never
 * by searching the bytes, so a name carried inside another file's content does
 * not count. Anything malformed or out of bounds reads as not Word.
 *
 * @module modules/work/document-containers
 */

const u16 = (bytes: Uint8Array, at: number) => (bytes[at] ?? 0) | ((bytes[at + 1] ?? 0) << 8);
const u32 = (bytes: Uint8Array, at: number) => (u16(bytes, at) | (u16(bytes, at + 2) << 16)) >>> 0;

const ZIP_END = 0x06054b50;
const ZIP_ENTRY = 0x02014b50;
const ZIP_LOCAL = 0x04034b50;
const ZIP64 = 0xffffffff;
const WORD_PARTS = ["[Content_Types].xml", "word/document.xml"];

/** Where a zip's end record starts, or -1 when it has none. */
function zipEndRecord(bytes: Uint8Array): number {
  // The end record is the last 22 bytes, unless a comment of up to 64 KB follows it. A comment
  // can hold bytes that look like an end record, so a candidate counts only when the comment
  // length it declares runs exactly to the end of the file.
  const earliest = Math.max(0, bytes.length - 22 - 0xffff);
  for (let at = bytes.length - 22; at >= earliest; at--) {
    if (u32(bytes, at) === ZIP_END && at + 22 + u16(bytes, at + 20) === bytes.length) return at;
  }
  return -1;
}

/** A central directory entry: the name it lists and where the entry starts. */
interface ZipEntry {
  name: string;
  at: number;
}

/** The entries a zip's central directory lists, or null when it cannot be read. */
function zipDirectory(bytes: Uint8Array): { entries: ZipEntry[]; start: number } | null {
  const end = zipEndRecord(bytes);
  if (end < 0) return null;
  const count = u16(bytes, end + 10);
  const size = u32(bytes, end + 12);
  const start = u32(bytes, end + 16);
  // ZIP64 marks these with all bits set; a Word file within the 10 MB limit never needs it.
  if (count === 0xffff || start === ZIP64 || start + size > end) return null;
  const decoder = new TextDecoder();
  const entries: ZipEntry[] = [];
  let at = start;
  for (let entry = 0; entry < count; entry++) {
    if (at + 46 > end || u32(bytes, at) !== ZIP_ENTRY) return null;
    const nameLength = u16(bytes, at + 28);
    const next = at + 46 + nameLength + u16(bytes, at + 30) + u16(bytes, at + 32);
    if (next > end) return null;
    entries.push({ name: decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength)), at });
    at = next;
  }
  return { entries, start };
}

/**
 * Whether the file data a directory entry points at is there: a local record under the same
 * name whose data ends before the directory. A directory can list names it holds no data for.
 */
function hasLocalRecord(bytes: Uint8Array, entry: number, directoryStart: number): boolean {
  const nameLength = u16(bytes, entry + 28);
  const dataLength = u32(bytes, entry + 20);
  const local = u32(bytes, entry + 42);
  if (dataLength === ZIP64 || local === ZIP64) return false;
  if (local + 30 + nameLength > directoryStart || u32(bytes, local) !== ZIP_LOCAL) return false;
  if (u16(bytes, local + 26) !== nameLength) return false;
  for (let offset = 0; offset < nameLength; offset++) {
    if (bytes[local + 30 + offset] !== bytes[entry + 46 + offset]) return false;
  }
  const dataStart = local + 30 + nameLength + u16(bytes, local + 28);
  return dataStart + dataLength <= directoryStart;
}

/**
 * A `.docx`: a zip whose central directory lists the parts every Word document has, each
 * with its local record in place.
 */
export function isWordZip(bytes: Uint8Array): boolean {
  const directory = zipDirectory(bytes);
  if (!directory) return false;
  return WORD_PARTS.every((part) =>
    directory.entries.some(
      (entry) => entry.name === part && hasLocalRecord(bytes, entry.at, directory.start)
    )
  );
}

const COMPOUND_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const END_OF_CHAIN = 0xfffffffe;
const FREE = 0xffffffff;
const STREAM = 2;

/** A `.doc`: a compound file whose directory holds a stream named `WordDocument`. */
export function isWordCompoundFile(bytes: Uint8Array): boolean {
  if (bytes.length < 512 || !COMPOUND_SIGNATURE.every((byte, index) => bytes[index] === byte))
    return false;
  if (u16(bytes, 0x1c) !== 0xfffe) return false;
  const shift = u16(bytes, 0x1e);
  if (shift !== 9 && shift !== 12) return false;
  const sectorSize = 1 << shift;
  const perSector = sectorSize / 4;
  const total = Math.floor(bytes.length / sectorSize);
  /** Where a sector starts in the file, or -1 when it lies outside it. */
  const offsetOf = (sector: number) => {
    const at = (sector + 1) * sectorSize;
    return sector < total && at + sectorSize <= bytes.length ? at : -1;
  };

  // The allocation table's own sectors: 109 named in the header, the rest in a chain.
  const tableSectors: number[] = [];
  for (let index = 0; index < 109; index++) {
    const sector = u32(bytes, 0x4c + index * 4);
    if (sector !== FREE) tableSectors.push(sector);
  }
  let link = u32(bytes, 0x44);
  for (let hops = 0; link !== END_OF_CHAIN && link !== FREE; hops++) {
    const at = offsetOf(link);
    if (at < 0 || hops > total) return false;
    for (let index = 0; index < perSector - 1; index++) {
      const sector = u32(bytes, at + index * 4);
      if (sector !== FREE) tableSectors.push(sector);
    }
    link = u32(bytes, at + (perSector - 1) * 4);
  }
  const nextOf = (sector: number) => {
    const table = tableSectors[Math.floor(sector / perSector)];
    const at = table === undefined ? -1 : offsetOf(table);
    return at < 0 ? -1 : u32(bytes, at + (sector % perSector) * 4);
  };

  // The directory: a chain of sectors of 128-byte entries, each a name, a length and a type.
  let sector = u32(bytes, 0x30);
  for (let hops = 0; sector !== END_OF_CHAIN; hops++) {
    const at = offsetOf(sector);
    if (at < 0 || hops > total) return false;
    for (let entry = at; entry < at + sectorSize; entry += 128) {
      const nameBytes = u16(bytes, entry + 0x40);
      if (bytes[entry + 0x42] !== STREAM || nameBytes < 2 || nameBytes > 64) continue;
      let name = "";
      for (let offset = 0; offset < nameBytes - 2; offset += 2)
        name += String.fromCharCode(u16(bytes, entry + offset));
      if (name === "WordDocument") return true;
    }
    sector = nextOf(sector);
    if (sector < 0) return false;
  }
  return false;
}
