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

/**
 * The camera's PNG with its chunks broken the way the client's end-to-end
 * 1-pixel PNG is, which browsers draw anyway: the picture chunk's length is
 * one byte short and its CRC is wrong, so no chunk after it can be found.
 */
export function unreadableCameraPng(): Bytes {
  const bytes = cameraPhoto("image/png");
  const view = new DataView(bytes.buffer);
  const lengthAt =
    bytes.findIndex(
      (_, index) => String.fromCharCode(...bytes.subarray(index, index + 4)) === "IDAT"
    ) - 4;
  const length = view.getUint32(lengthAt);
  view.setUint32(lengthAt, length - 1);
  view.setUint32(lengthAt + 8 + length, 0xfe65291d);
  return bytes;
}

export interface PhotoVariant {
  name: string;
  type: PhotoType;
  picked: Bytes;
  published: Bytes;
}

/**
 * Layouts cameras and editors also write, as picked and as they may be
 * published. Each carries the camera's EXIF, with the Orientation the only tag
 * that may survive.
 */
export function photoVariants(): PhotoVariant[] {
  const exif = (structure: Bytes) => jpegSegment(APP1, "Exif\0\0", structure);
  const [camera, oriented] = [exif(cameraExif(6)), exif(orientationOnlyExif(6))];
  const picture = jpegPicture("variant");
  const tables = jpegSegment(0xdb, [0], new Array(64).fill(1));
  const huffman = jpegSegment(0xc4, [0], new Array(16).fill(0));
  const progressive = concat(
    tables,
    jpegSegment(0xc2, [8, 0, 8, 0, 8, 1, 1, 0x11, 0]),
    huffman,
    jpegSegment(0xda, [1, 1, 0, 0, 0, 0]),
    "first scan",
    jpegSegment(0xc4, [0x10], new Array(16).fill(0)),
    jpegSegment(0xda, [1, 1, 0, 1, 63, 0]),
    "second scan"
  );
  const cmyk = concat(
    tables,
    jpegSegment(0xc0, [8, 0, 8, 0, 8, 4, 1, 0x11, 0, 2, 0x11, 0, 3, 0x11, 0, 4, 0x11, 0]),
    huffman,
    jpegSegment(0xda, [4, 1, 0, 2, 0, 3, 0, 4, 0, 0, 63, 0]),
    "cmyk scan"
  );
  const adobe = jpegSegment(0xee, "Adobe", [0, 100, 0, 0, 0, 0, 2]);
  const jfifThumbnail = jpegSegment(0xe0, "JFIF\0", [1, 2, 0, 0, 1, 0, 1, 1, 1], [9, 9, 9]);
  const mpf = jpegSegment(0xe2, "MPF\0", "II*\0", [8, 0, 0, 0]);
  const jpeg = (name: string, picked: Piece[], published: Piece[]): PhotoVariant => ({
    name,
    type: "image/jpeg",
    picked: concat(...picked),
    published: concat(...published),
  });

  const png = (name: string, picked: Piece[], published: Piece[]): PhotoVariant => ({
    name,
    type: "image/png",
    picked: concat(PNG_SIGNATURE, ...picked, PNG_END),
    published: concat(PNG_SIGNATURE, ...published, PNG_END),
  });
  const paletteHeader = pngChunk("IHDR", u32(8), u32(8), [8, 3, 0, 0, 0]);
  const palette = [pngChunk("PLTE", [0, 0, 0, 255, 255, 255]), pngChunk("tRNS", [0, 255])];
  const frame = (sequence: number) =>
    pngChunk("fcTL", u32(sequence), u32(8), u32(8), u32(0), u32(0), [0, 1, 0, 10, 0, 0]);
  const animation = [
    pngChunk("acTL", u32(2), u32(0)),
    frame(0),
    pngChunk("IDAT", "first frame"),
    frame(1),
    pngChunk("fdAT", u32(2), "second frame"),
  ];
  const text = pngChunk("tEXt", "Software\0", CAMERA_DETAILS.software);

  const webpWith = (name: string, flags: number, picked: Piece[], published: Piece[]) => ({
    name,
    type: "image/webp" as const,
    picked: webp(
      webpChunk("VP8X", [flags | WEBP_EXIF | WEBP_XMP, 0, 0, 0], WEBP_CANVAS),
      ...picked,
      webpChunk("EXIF", cameraExif(6)),
      webpChunk("XMP ", XMP)
    ),
    published: webp(
      webpChunk("VP8X", [flags | WEBP_EXIF, 0, 0, 0], WEBP_CANVAS),
      ...published,
      webpChunk("EXIF", orientationOnlyExif(6))
    ),
  });
  const frames = [1, 2].map((index) =>
    webpChunk("ANMF", new Array(16).fill(0), webpChunk("VP8 ", `frame ${index}`))
  );

  return [
    jpeg(
      "a JPEG whose EXIF is little-endian",
      [SOI, JFIF, exif(cameraExif(6, true)), picture, EOI],
      [SOI, JFIF, oriented, picture, EOI]
    ),
    jpeg(
      "a progressive JPEG with a table between its scans",
      [SOI, JFIF, camera, progressive, EOI],
      [SOI, JFIF, oriented, progressive, EOI]
    ),
    jpeg("an Adobe CMYK JPEG", [SOI, adobe, camera, cmyk, EOI], [SOI, adobe, oriented, cmyk, EOI]),
    jpeg(
      "a JPEG with an MPF index and a second picture after it",
      [SOI, JFIF, camera, mpf, picture, EOI, SOI, camera, jpegPicture("depth"), EOI],
      [SOI, JFIF, oriented, picture, EOI]
    ),
    jpeg(
      "a JPEG whose JFIF header holds a thumbnail",
      [SOI, jfifThumbnail, camera, picture, EOI],
      [SOI, oriented, picture, EOI]
    ),
    jpeg(
      "a JPEG with a stray byte between segments",
      [SOI, JFIF, [0x00], camera, picture, EOI],
      [SOI, JFIF, oriented, picture, EOI]
    ),
    png(
      "a palette PNG with transparency",
      [
        paletteHeader,
        ...palette,
        pngChunk("eXIf", cameraExif(6)),
        text,
        pngChunk("IDAT", "palette"),
      ],
      [
        paletteHeader,
        ...palette,
        pngChunk("eXIf", orientationOnlyExif(6)),
        pngChunk("IDAT", "palette"),
      ]
    ),
    png(
      "an animated PNG",
      [PNG_HEADER, pngChunk("eXIf", cameraExif(6)), ...animation, text],
      [PNG_HEADER, pngChunk("eXIf", orientationOnlyExif(6)), ...animation]
    ),
    webpWith(
      "a lossy WebP with an alpha chunk",
      WEBP_ALPHA,
      [webpChunk("ALPH", [0], "alpha"), webpChunk("VP8 ", "lossy")],
      [webpChunk("ALPH", [0], "alpha"), webpChunk("VP8 ", "lossy")]
    ),
    webpWith(
      "a lossless WebP",
      0,
      [webpChunk("VP8L", "lossless")],
      [webpChunk("VP8L", "lossless")]
    ),
    webpWith(
      "an animated WebP",
      WEBP_ANIMATION,
      [webpChunk("ANIM", [0, 0, 0, 0, 0, 0]), ...frames],
      [webpChunk("ANIM", [0, 0, 0, 0, 0, 0]), ...frames]
    ),
    webpWith(
      "a WebP whose chunks have odd sizes",
      0,
      [webpChunk("VP8 ", "odd"), webpChunk("XMP ", "<x:xmpmeta/>!")],
      [webpChunk("VP8 ", "odd")]
    ),
  ];
}

export function photoFile(bytes: Bytes, name: string, type: PhotoType) {
  return new File([bytes], name, { type, lastModified: 1_760_000_000_000 });
}

export async function bytesOf(file: Blob): Promise<Bytes> {
  return new Uint8Array(await file.arrayBuffer());
}

// ---------------------------------------------------------------------------
// EXIF: a TIFF structure, big-endian unless asked otherwise
// ---------------------------------------------------------------------------

type Directory = "ifd0" | "exif" | "gps";
/** Text is ASCII, a number a SHORT, pairs RATIONALs, and `points` the offset of another directory. */
type Entry = [
  tag: number,
  value: string | number | Array<[number, number]> | { points: Directory },
];

/** A camera's EXIF: the device and Orientation, the body's serial and lens, and the place. */
function cameraExif(orientation: number, littleEndian = false): Bytes {
  return tiff(
    {
      ifd0: [
        [0x010f, CAMERA_DETAILS.make],
        [0x0110, CAMERA_DETAILS.model],
        [0x0112, orientation],
        [0x0131, CAMERA_DETAILS.software],
        [0x8769, { points: "exif" }],
        [0x8825, { points: "gps" }],
      ],
      exif: [
        [0xa431, CAMERA_DETAILS.serial],
        [0xa434, CAMERA_DETAILS.lens],
      ],
      gps: [
        [0x0001, "N"],
        [
          0x0002,
          [
            [52, 1],
            [22, 1],
            [2651, 100],
          ],
        ],
        [0x0003, "E"],
        [
          0x0004,
          [
            [4, 1],
            [53, 1],
            [2288, 100],
          ],
        ],
        [0x0012, CAMERA_DETAILS.gpsDatum],
      ],
    },
    littleEndian
  );
}

/** EXIF holding the Orientation and nothing else. */
function orientationOnlyExif(orientation: number): Bytes {
  return tiff({ ifd0: [[0x0112, orientation]] });
}

function tiff(directories: { [name in Directory]?: Entry[] }, littleEndian = false): Bytes {
  const word = (value: number, size: 2 | 4) => {
    const bytes = new Uint8Array(size);
    const view = new DataView(bytes.buffer);
    if (size === 2) view.setUint16(0, value, littleEndian);
    else view.setUint32(0, value, littleEndian);
    return bytes;
  };
  const encode = ([, value]: Entry, offsets: { [name in Directory]?: number }) => {
    if (typeof value === "string")
      return { type: 2, count: value.length + 1, data: concat(value, [0]) };
    if (typeof value === "number") return { type: 3, count: 1, data: word(value, 2) };
    if (Array.isArray(value))
      return {
        type: 5,
        count: value.length,
        data: concat(...value.flatMap(([top, bottom]) => [word(top, 4), word(bottom, 4)])),
      };
    return { type: 4, count: 1, data: word(offsets[value.points] ?? 0, 4) };
  };
  const even = (length: number) => length + (length % 2);
  const order = (["ifd0", "exif", "gps"] as const).filter((name) => directories[name]);
  const offsets: { [name in Directory]?: number } = {};
  let end = 8;
  for (const name of order) {
    const entries = directories[name]!;
    offsets[name] = end;
    end += 6 + entries.length * 12;
    for (const entry of entries) {
      const { data } = encode(entry, {});
      if (data.length > 4) end += even(data.length);
    }
  }
  const bytes = new Uint8Array(end);
  bytes.set(concat(littleEndian ? "II" : "MM", word(42, 2), word(8, 4)));
  for (const name of order) {
    const entries = directories[name]!;
    let at = offsets[name]!;
    let dataAt = at + 6 + entries.length * 12;
    bytes.set(word(entries.length, 2), at);
    at += 2;
    for (const entry of entries) {
      const { type, count, data } = encode(entry, offsets);
      bytes.set(concat(word(entry[0], 2), word(type, 2), word(count, 4)), at);
      if (data.length <= 4) bytes.set(data, at + 8);
      else {
        bytes.set(word(dataAt, 4), at + 8);
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
const WEBP_ALPHA = 0x10;
const WEBP_EXIF = 0x08;
const WEBP_XMP = 0x04;
const WEBP_ANIMATION = 0x02;
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
