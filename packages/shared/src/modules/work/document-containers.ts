/**
 * The two containers Word files come in, read far enough to tell a Word
 * document from any other file in the same container.
 *
 * A `.docx` is a zip archive. It is a Word document when its central directory
 * lists the `[Content_Types].xml` and `word/document.xml` parts. A `.doc` is a
 * compound file. It is a Word document when its directory holds a stream named
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
const WORD_PARTS = ["[Content_Types].xml", "word/document.xml"];

/** The entry names a zip's central directory lists, or null when it cannot be read. */
function zipEntryNames(bytes: Uint8Array): string[] | null {
  // The end record is the last 22 bytes, unless the archive carries a comment after it.
  const earliest = Math.max(0, bytes.length - 22 - 0xffff);
  let end = -1;
  for (let at = bytes.length - 22; at >= earliest; at--) {
    if (u32(bytes, at) === ZIP_END) {
      end = at;
      break;
    }
  }
  if (end < 0) return null;
  const count = u16(bytes, end + 10);
  const size = u32(bytes, end + 12);
  const start = u32(bytes, end + 16);
  // ZIP64 marks these with all bits set; a Word file within the 10 MB limit never needs it.
  if (count === 0xffff || start === 0xffffffff || start + size > end) return null;
  const decoder = new TextDecoder();
  const names: string[] = [];
  let at = start;
  for (let entry = 0; entry < count; entry++) {
    if (at + 46 > end || u32(bytes, at) !== ZIP_ENTRY) return null;
    const nameLength = u16(bytes, at + 28);
    const next = at + 46 + nameLength + u16(bytes, at + 30) + u16(bytes, at + 32);
    if (next > end) return null;
    names.push(decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength)));
    at = next;
  }
  return names;
}

/** A `.docx`: a zip whose central directory lists the parts every Word document has. */
export function isWordZip(bytes: Uint8Array): boolean {
  const names = zipEntryNames(bytes);
  return names !== null && WORD_PARTS.every((part) => names.includes(part));
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
