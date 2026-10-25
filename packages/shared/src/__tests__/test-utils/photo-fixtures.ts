/**
 * Photos as cameras write them, and as they may be published
 *
 * `cameraPhoto` is a tiny JPEG, PNG or WebP carrying where it was taken and the
 * device that took it, in each place its format offers: EXIF with a GPS
 * directory, XMP, IPTC, text chunks, comments, and bytes after the image ends.
 * `cleanPhoto` is the same picture as it may be published: nothing left but
 * what draws it and its orientation. The picture bytes are placeholders a
 * decoder would not draw; the metadata around them is laid out the way cameras
 * and editors write it. Every value is built here, independently of the code
 * under test.
 */

type Bytes = Uint8Array<ArrayBuffer>;
type Piece = Bytes | number[] | string;

export type PhotoType = "image/jpeg" | "image/png" | "image/webp";

/** What a camera writes into a photo. Each is text a test can look for in published bytes. */
export const CAMERA_DETAILS = {
  make: "Canon",
  model: "EOS R5",
  serial: "032021001234",
  software: "Firmware 1.8.1",
  lens: "RF24-105mm F4 L IS USM",
  gpsDatum: "WGS-84",
  xmpLocation: 'exif:GPSLatitude="52,22.4418N"',
  iptcCity: "Amsterdam",
  comment: "Plot 7, behind the house",
} as const;

/** Which of the camera's details some bytes still carry. */
export function leakedCameraDetails(bytes: Uint8Array): string[] {
  const text = new TextDecoder("latin1").decode(bytes);
  return Object.values(CAMERA_DETAILS).filter((detail) => text.includes(detail));
}

interface PhotoOptions {
  /** EXIF Orientation; 6 is a phone held upright, 1 needs no tag. */
  orientation?: number;
  /** Text the placeholder picture data spells, so two photos differ. */
  label?: string;
}

/** A photo as the camera wrote it, carrying where and with what it was taken. */
export function cameraPhoto(
  type: PhotoType,
  { orientation = 6, label = "garden" }: PhotoOptions = {}
) {
  const exif = cameraExif(orientation);
  switch (type) {
    case "image/jpeg":
      return concat(
        SOI,
        JFIF,
        jpegSegment(APP1, "Exif\0\0", exif),
        jpegSegment(APP1, "http://ns.adobe.com/xap/1.0/\0", XMP),
        JPEG_ICC_PROFILE,
        jpegSegment(0xed, "Photoshop 3.0\0", IPTC_RESOURCE),
        jpegSegment(0xfe, CAMERA_DETAILS.comment),
        jpegPicture(label),
        EOI,
        // Phones append a second picture, such as a depth map, after the first one ends.
        SOI,
        jpegSegment(APP1, "Exif\0\0", exif),
        jpegPicture("depth"),
        EOI
      );
    case "image/png":
      return concat(
        PNG_SIGNATURE,
        PNG_HEADER,
        PNG_SRGB,
        pngChunk("eXIf", exif),
        pngChunk("tEXt", "Software\0", CAMERA_DETAILS.software),
        pngChunk("iTXt", "XML:com.adobe.xmp\0", [0, 0], "\0\0", XMP),
        pngChunk("tIME", [0x07, 0xea, 10, 25, 9, 30, 0]),
        pngChunk("IDAT", label),
        PNG_END,
        CAMERA_DETAILS.comment
      );
    case "image/webp":
      return webp(
        webpChunk("VP8X", [WEBP_ICC | WEBP_EXIF | WEBP_XMP, 0, 0, 0], WEBP_CANVAS),
        WEBP_ICC_PROFILE,
        webpChunk("VP8 ", label),
        webpChunk("EXIF", exif),
        webpChunk("XMP ", XMP)
      );
  }
}

/** The same picture as it may be published: what draws it, and its orientation when not upright. */
export function cleanPhoto(
  type: PhotoType,
  { orientation = 1, label = "garden" }: PhotoOptions = {}
) {
  const exif = orientation === 1 ? undefined : orientationOnlyExif(orientation);
  switch (type) {
    case "image/jpeg":
      return concat(
        SOI,
        JFIF,
        exif ? jpegSegment(APP1, "Exif\0\0", exif) : [],
        JPEG_ICC_PROFILE,
        jpegPicture(label),
        EOI
      );
    case "image/png":
      return concat(
        PNG_SIGNATURE,
        PNG_HEADER,
        PNG_SRGB,
        exif ? pngChunk("eXIf", exif) : [],
        pngChunk("IDAT", label),
        PNG_END
      );
    case "image/webp":
      return webp(
        webpChunk("VP8X", [WEBP_ICC | (exif ? WEBP_EXIF : 0), 0, 0, 0], WEBP_CANVAS),
        WEBP_ICC_PROFILE,
        webpChunk("VP8 ", label),
        exif ? webpChunk("EXIF", exif) : []
      );
  }
}

export function photoFile(bytes: Bytes, name: string, type: PhotoType) {
  return new File([bytes], name, { type, lastModified: 1_760_000_000_000 });
}

export async function bytesOf(file: Blob): Promise<Bytes> {
  return new Uint8Array(await file.arrayBuffer());
}

// ---------------------------------------------------------------------------
// EXIF: a big-endian TIFF structure
// ---------------------------------------------------------------------------

interface Entry {
  tag: number;
  type: number;
  count: number;
  data: Bytes;
  /** The directory a pointer entry names; its offset is filled in when laid out. */
  points?: "exif" | "gps";
}

const asciiEntry = (tag: number, text: string): Entry => ({
  tag,
  type: 2,
  count: text.length + 1,
  data: concat(text, [0]),
});
const shortEntry = (tag: number, value: number): Entry => ({
  tag,
  type: 3,
  count: 1,
  data: Uint8Array.of(value >> 8, value & 0xff),
});
const pointerEntry = (tag: number, points: "exif" | "gps"): Entry => ({
  tag,
  type: 4,
  count: 1,
  data: new Uint8Array(4),
  points,
});
const rationalEntry = (tag: number, values: Array<[number, number]>): Entry => ({
  tag,
  type: 5,
  count: values.length,
  data: concat(...values.flatMap(([numerator, denominator]) => [u32(numerator), u32(denominator)])),
});

/** A camera's EXIF: the device and Orientation, the body's serial and lens, and the place. */
function cameraExif(orientation: number): Bytes {
  return tiff({
    ifd0: [
      asciiEntry(0x010f, CAMERA_DETAILS.make),
      asciiEntry(0x0110, CAMERA_DETAILS.model),
      shortEntry(0x0112, orientation),
      asciiEntry(0x0131, CAMERA_DETAILS.software),
      pointerEntry(0x8769, "exif"),
      pointerEntry(0x8825, "gps"),
    ],
    exif: [asciiEntry(0xa431, CAMERA_DETAILS.serial), asciiEntry(0xa434, CAMERA_DETAILS.lens)],
    gps: [
      asciiEntry(0x0001, "N"),
      rationalEntry(0x0002, [
        [52, 1],
        [22, 1],
        [2651, 100],
      ]),
      asciiEntry(0x0003, "E"),
      rationalEntry(0x0004, [
        [4, 1],
        [53, 1],
        [2288, 100],
      ]),
      asciiEntry(0x0012, CAMERA_DETAILS.gpsDatum),
    ],
  });
}

/** EXIF holding the Orientation and nothing else. */
function orientationOnlyExif(orientation: number): Bytes {
  return tiff({ ifd0: [shortEntry(0x0112, orientation)] });
}

function tiff(directories: { ifd0: Entry[]; exif?: Entry[]; gps?: Entry[] }): Bytes {
  const even = (length: number) => length + (length % 2);
  const sizeOf = (entries: Entry[]) =>
    6 +
    entries.length * 12 +
    entries.reduce((sum, entry) => sum + (entry.data.length > 4 ? even(entry.data.length) : 0), 0);
  const order = (["ifd0", "exif", "gps"] as const).filter((name) => directories[name]);
  const offsets: Partial<Record<(typeof order)[number], number>> = {};
  let end = 8;
  for (const name of order) {
    offsets[name] = end;
    end += sizeOf(directories[name]!);
  }
  const bytes = new Uint8Array(end);
  const view = new DataView(bytes.buffer);
  bytes.set([0x4d, 0x4d, 0, 42, 0, 0, 0, 8]);
  for (const name of order) {
    const entries = directories[name]!;
    let at = offsets[name]!;
    let dataAt = at + 6 + entries.length * 12;
    view.setUint16(at, entries.length);
    at += 2;
    for (const entry of entries) {
      view.setUint16(at, entry.tag);
      view.setUint16(at + 2, entry.type);
      view.setUint32(at + 4, entry.count);
      const data = entry.points ? u32(offsets[entry.points]!) : entry.data;
      if (data.length <= 4) bytes.set(data, at + 8);
      else {
        view.setUint32(at + 8, dataAt);
        bytes.set(data, dataAt);
        dataAt += even(data.length);
      }
      at += 12;
    }
    // The next directory's offset stays zero: each chain holds one directory.
  }
  return bytes;
}

const XMP = `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:exif="http://ns.adobe.com/exif/1.0/" ${CAMERA_DETAILS.xmpLocation} exif:BodySerialNumber="${CAMERA_DETAILS.serial}"/></rdf:RDF></x:xmpmeta>`;

/** A Photoshop resource holding IPTC's City. */
const IPTC_RESOURCE = concat(
  "8BIM",
  [0x04, 0x04, 0, 0],
  u32(5 + CAMERA_DETAILS.iptcCity.length),
  [0x1c, 0x02, 0x5a, 0, CAMERA_DETAILS.iptcCity.length],
  CAMERA_DETAILS.iptcCity
);

// ---------------------------------------------------------------------------
// Containers
// ---------------------------------------------------------------------------

const SOI = [0xff, 0xd8];
const EOI = [0xff, 0xd9];
const APP1 = 0xe1;

function jpegSegment(marker: number, ...payload: Piece[]): Bytes {
  const body = concat(...payload);
  return concat([0xff, marker, (body.length + 2) >> 8, (body.length + 2) & 0xff], body);
}

const JFIF = jpegSegment(0xe0, "JFIF\0", [1, 2, 0, 0, 1, 0, 1, 0, 0]);
const JPEG_ICC_PROFILE = jpegSegment(0xe2, "ICC_PROFILE\0", [1, 1], "display-p3-profile");

/** Tables, frame and scan; the scan data spells `label` around a stuffed byte and a restart marker. */
function jpegPicture(label: string): Bytes {
  return concat(
    jpegSegment(0xdb, [0], new Array(64).fill(1)),
    jpegSegment(0xc0, [8, 0, 8, 0, 8, 1, 1, 0x11, 0]),
    jpegSegment(0xc4, [0], new Array(16).fill(0)),
    jpegSegment(0xda, [1, 1, 0, 0, 63, 0]),
    label,
    [0xff, 0x00],
    label,
    [0xff, 0xd0],
    label
  );
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function pngChunk(type: string, ...data: Piece[]): Bytes {
  const body = concat(type, ...data);
  return concat(u32(body.length - 4), body, u32(crc32(body)));
}

const PNG_HEADER = pngChunk("IHDR", u32(8), u32(8), [8, 2, 0, 0, 0]);
const PNG_SRGB = pngChunk("sRGB", [0]);
const PNG_END = pngChunk("IEND");

const WEBP_ICC = 0x20;
const WEBP_EXIF = 0x08;
const WEBP_XMP = 0x04;
/** An 8 by 8 canvas: width and height less one, 24-bit little-endian. */
const WEBP_CANVAS = [7, 0, 0, 7, 0, 0];

function webpChunk(fourcc: string, ...data: Piece[]): Bytes {
  const body = concat(...data);
  const size = new Uint8Array(4);
  new DataView(size.buffer).setUint32(0, body.length, true);
  return concat(fourcc, size, body, body.length % 2 ? [0] : []);
}

const WEBP_ICC_PROFILE = webpChunk("ICCP", "display-p3-profile");

function webp(...chunks: Piece[]): Bytes {
  const body = concat("WEBP", ...chunks);
  const size = new Uint8Array(4);
  new DataView(size.buffer).setUint32(0, body.length, true);
  return concat("RIFF", size, body);
}

// ---------------------------------------------------------------------------
// Bytes
// ---------------------------------------------------------------------------

function concat(...pieces: Piece[]): Bytes {
  const arrays = pieces.map((piece) =>
    typeof piece === "string"
      ? Uint8Array.from(piece, (character) => character.charCodeAt(0))
      : Uint8Array.from(piece)
  );
  const bytes = new Uint8Array(arrays.reduce((sum, array) => sum + array.length, 0));
  let offset = 0;
  for (const array of arrays) {
    bytes.set(array, offset);
    offset += array.length;
  }
  return bytes;
}

function u32(value: number): Bytes {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value);
  return bytes;
}

function crc32(bytes: Bytes): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
