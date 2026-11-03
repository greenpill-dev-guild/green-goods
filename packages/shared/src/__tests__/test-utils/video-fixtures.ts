/**
 * Videos as phones and recorders write them, and as they may be published
 *
 * Each `VideoVariant` is a tiny MP4, QuickTime or WebM file carrying where it
 * was recorded and the device that recorded it, in the places its container
 * offers: user data and metadata boxes, XMP, a timed metadata track, WebM
 * tags, names and dates. Beside it is the same file as it may be published:
 * each of those boxes and elements turned into free space or a Void element of
 * the same length and zeroed, the metadata track's samples zeroed and the
 * capture times cleared, so nothing else moves. The samples are placeholder
 * bytes a decoder would not play; the structures around them are laid out the
 * way recorders write them. Every value is built here, independently of the
 * code under test.
 */

type Bytes = Uint8Array<ArrayBuffer>;
type Part = Bytes | string | readonly number[];

/** What a recorder writes into a video. Each is text a test can look for in published bytes. */
export const RECORDER_DETAILS = {
  location: "+52.3740+004.8897",
  make: "Google",
  model: "Pixel 8",
  appleModel: "iPhone 15 Pro",
  xmpLocation: 'exif:GPSLatitude="52,22.4418N"',
  track: "GPS 52.3740 4.8897",
  title: "Plot 7, behind the house",
} as const;

/** Which of the recorder's details some bytes still carry. */
export function leakedRecorderDetails(bytes: Uint8Array): string[] {
  const text = new TextDecoder("latin1").decode(bytes);
  return Object.values(RECORDER_DETAILS).filter((detail) => text.includes(detail));
}

export interface VideoVariant {
  name: string;
  type: "video/mp4" | "video/quicktime" | "video/webm";
  recorded: Bytes;
  published: Bytes;
}

/** Layouts phones and recorders write, as recorded and as they may be published. */
export function videoVariants(): VideoVariant[] {
  return [
    {
      name: "an Android phone's MP4, with its place in the movie's user data",
      type: "video/mp4",
      recorded: androidMp4(false),
      published: androidMp4(true),
    },
    {
      name: "an iPhone's QuickTime movie, with its place in metadata keys and a metadata track",
      type: "video/quicktime",
      recorded: iphoneMovie(false),
      published: iphoneMovie(true),
    },
    {
      name: "a fragmented MP4 whose telemetry track logs the place in its fragments",
      type: "video/mp4",
      recorded: fragmentedMp4(false),
      published: fragmentedMp4(true),
    },
    {
      name: "a fragmented MP4 whose track fragments each start where the one before ended",
      type: "video/mp4",
      recorded: fragmentedMp4(false, { base: "implicit" }),
      published: fragmentedMp4(true, { base: "implicit" }),
    },
    {
      name: "a WebM, with its place in tags and a title, date and names beside them",
      type: "video/webm",
      recorded: webm(false),
      published: webm(true),
    },
    {
      name: "a WebM whose cluster holds an element this does not know, between its blocks",
      type: "video/webm",
      recorded: webm(false, { unknownInCluster: true }),
      published: webm(true, { unknownInCluster: true }),
    },
  ];
}

/** A file of a type a video picker may offer, which no part of this can read. */
export function aviVideo(): Bytes {
  return concat("RIFF", u32le(28), "AVI LIST", u32le(16), "hdrlavih", u32le(4), [0, 0, 0, 0]);
}

/** The Android MP4 with its picture kept in another file, as a QuickTime reference movie does. */
export function referencingMp4(): Bytes {
  return androidMp4(false, { selfContained: false });
}

/** The Android MP4 with nothing but its telemetry track: no picture or sound to keep. */
export function telemetryOnlyMp4(): Bytes {
  return androidMp4(false, { tracks: ["meta"] });
}

/** The WebM with a subtitle track, which this cannot clean in place. */
export function subtitledWebm(): Bytes {
  return webm(false, { subtitles: true });
}

/** The WebM in a segment that gives its size around a cluster that does not. */
export function sizedSegmentWebm(): Bytes {
  return webm(false, { sizedSegment: true });
}

/**
 * A fragmented MP4 whose picture starts where a telemetry fragment ended:
 * blanking that fragment would move the picture for every player.
 */
export function chainedFragmentMp4(): Bytes {
  return fragmentedMp4(false, { base: "implicit", first: "telemetry" });
}

/** A fragmented MP4 whose telemetry run promises a data offset it has no room for. */
export function shortRunMp4(): Bytes {
  return fragmentedMp4(false, { shortRun: true });
}

/** The Android MP4 with its sound sized the old QuickTime way, by its sample description. */
export function legacySoundMp4(): Bytes {
  return androidMp4(false, { legacySound: true });
}

export function videoFile(bytes: Bytes, name: string, type: string) {
  return new File([bytes], name, { type, lastModified: 1_760_000_000_000 });
}

// ---------------------------------------------------------------------------
// MP4 and QuickTime
// ---------------------------------------------------------------------------

const RECORDED_AT = 0xe5d1_6ab0;
const PICTURE = ["frame one ", "frame two "];
const SOUND = "sound ";
const MATRIX = [...u32(0x10000), ...zeros(12), ...u32(0x10000), ...zeros(12), ...u32(0x40000000)];
const XMP_UUID = [
  0xbe, 0x7a, 0xcf, 0xcb, 0x97, 0xa9, 0x42, 0xe8, 0x9c, 0x71, 0x99, 0x94, 0x91, 0xe3, 0xaf, 0xac,
];

type Handler = "vide" | "soun" | "meta";

interface Sample {
  handler: Handler;
  bytes: string;
}

/** Video, its metadata track, then sound: the order the samples sit in the media data. */
const SAMPLES: Sample[] = [
  { handler: "vide", bytes: PICTURE[0] },
  { handler: "vide", bytes: PICTURE[1] },
  { handler: "meta", bytes: RECORDER_DETAILS.track },
  { handler: "soun", bytes: SOUND },
];

const TRACK_IDS: Record<Handler, number> = { vide: 1, soun: 2, meta: 3 };

/**
 * The media data box: each kept sample's bytes, and the metadata track's
 * zeroed once published.
 */
function mediaData(published: boolean, handlers: Handler[]): Bytes {
  return box(
    "mdat",
    ...SAMPLES.filter(({ handler }) => handlers.includes(handler)).map(({ handler, bytes }) =>
      published && handler === "meta" ? zeros(bytes.length) : bytes
    )
  );
}

/** Where each track's samples sit, given where the media data's contents start. */
function sampleOffsets(start: number, handlers: Handler[]): Record<Handler, number[]> {
  const offsets: Record<Handler, number[]> = { vide: [], soun: [], meta: [] };
  let position = start;
  for (const { handler, bytes } of SAMPLES.filter(({ handler }) => handlers.includes(handler))) {
    offsets[handler].push(position);
    position += bytes.length;
  }
  return offsets;
}

interface MovieOptions {
  selfContained?: boolean;
  tracks?: Handler[];
  /** Sound sized the old QuickTime way: every frame given a size of 1. */
  legacySound?: boolean;
}

/**
 * Media data first, then the movie: a phone's MP4 with its place, make and
 * model in the movie's user data, a telemetry track, and XMP at the end.
 */
function androidMp4(
  published: boolean,
  {
    selfContained = true,
    tracks = ["vide", "soun", "meta"],
    legacySound = false,
  }: MovieOptions = {}
): Bytes {
  const header = box("ftyp", "isom", u32(512), "isomiso2mp41");
  const media = mediaData(published, tracks);
  const offsets = sampleOffsets(header.length + 8, tracks);
  const userData = box(
    "udta",
    box(
      "\xa9xyz",
      u16(RECORDER_DETAILS.location.length + 1),
      u16(0x15c7),
      `${RECORDER_DETAILS.location}/`
    ),
    box("\xa9mak", u16(RECORDER_DETAILS.make.length), u16(0x15c7), RECORDER_DETAILS.make),
    box("\xa9mod", u16(RECORDER_DETAILS.model.length), u16(0x15c7), RECORDER_DETAILS.model)
  );
  const movie = box(
    "moov",
    movieHeader(published),
    ...tracks.map((handler) => {
      const legacySizes = legacySound && handler === "soun";
      const built = track(handler, offsets[handler], { published, selfContained, legacySizes });
      return handler === "meta" && published ? freeSpace(built) : built;
    }),
    published ? freeSpace(userData) : userData
  );
  const xmp = box(
    "uuid",
    XMP_UUID,
    `<x:xmpmeta><rdf:Description ${RECORDER_DETAILS.xmpLocation}/></x:xmpmeta>`
  );
  return concat(header, media, movie, published ? freeSpace(xmp) : xmp);
}

/**
 * The movie first, then the media data, as an iPhone writes it: its place,
 * make and model as QuickTime metadata keys, a timed metadata track logging
 * the place, a track's own user data, and stale bytes in a free box.
 */
function iphoneMovie(published: boolean): Bytes {
  const header = box("ftyp", "qt  ", u32(0), "qt  ");
  // An editor that removed the location by renaming its box left the bytes behind.
  const leftOver = `\xa9xyz${RECORDER_DETAILS.location}`;
  const stale = box("free", published ? zeros(leftOver.length) : leftOver);
  const keys = [
    ["com.apple.quicktime.location.ISO6709", `${RECORDER_DETAILS.location}+001.000/`],
    ["com.apple.quicktime.make", "Apple"],
    ["com.apple.quicktime.model", RECORDER_DETAILS.appleModel],
  ];
  const metadata = box(
    "meta",
    full("hdlr", 0, 0, u32(0), "mdta", zeros(12), "\0"),
    full("keys", 0, 0, u32(keys.length), ...keys.map(([key]) => box("mdta", key))),
    box(
      "ilst",
      ...keys.map(([, value], index) => {
        const data = box("data", u32(1), u32(0), value);
        return concat(u32(8 + data.length), u32(index + 1), data);
      })
    )
  );
  const handlers: Handler[] = ["vide", "soun", "meta"];
  const build = (mediaStart: number) => {
    const offsets = sampleOffsets(mediaStart, handlers);
    return box(
      "moov",
      movieHeader(published),
      track("vide", offsets.vide, { published, entry: "hvc1", userData: true }),
      track("soun", offsets.soun, { published }),
      published
        ? freeSpace(track("meta", offsets.meta, { published, entry: "mebx" }))
        : track("meta", offsets.meta, { published, entry: "mebx" }),
      published ? freeSpace(metadata) : metadata
    );
  };
  // The movie's length does not depend on the offsets it records.
  const mediaStart = header.length + stale.length + build(0).length + 8;
  return concat(header, stale, build(mediaStart), mediaData(published, handlers));
}

interface FragmentOptions {
  /** Where each track fragment counts from: the fragment, or where the one before it ended. */
  base?: "fragment" | "implicit";
  /** Which track fragment, and which sample in the media data, comes first. */
  first?: "picture" | "telemetry";
  /** The telemetry run promises a data offset its box has no room for. */
  shortRun?: boolean;
}

/**
 * A fragmented MP4: an empty movie, then one fragment whose runs place the
 * picture and the telemetry track's sample in the media data that follows.
 */
function fragmentedMp4(
  published: boolean,
  { base = "fragment", first = "picture", shortRun = false }: FragmentOptions = {}
): Bytes {
  const header = box("ftyp", "iso6", u32(512), "iso6mp41");
  const telemetry = RECORDER_DETAILS.track.length;
  const pictureLength = PICTURE.join("").length;
  const userData = box(
    "udta",
    box("\xa9xyz", u16(18), u16(0x15c7), `${RECORDER_DETAILS.location}/`)
  );
  const metadataTrack = track("meta", [], { published });
  const movie = box(
    "moov",
    movieHeader(published),
    track("vide", [], { published }),
    published ? freeSpace(metadataTrack) : metadataTrack,
    box(
      "mvex",
      full("trex", 0, 0, u32(TRACK_IDS.vide), u32(1), u32(0), u32(0), u32(0)),
      full("trex", 0, 0, u32(TRACK_IDS.meta), u32(1), u32(0), u32(telemetry), u32(0))
    ),
    published ? freeSpace(userData) : userData
  );
  const baseFlag = base === "fragment" ? 0x20000 : 0;
  // `mediaAt` is where the media data's contents start, counted from the fragment.
  const fragment = (mediaAt: number) => {
    const pictureAt = first === "picture" ? mediaAt : mediaAt + telemetry;
    const telemetryAt = first === "picture" ? mediaAt + pictureLength : mediaAt;
    // A run names its offset when it counts from the fragment; the second of two implicit
    // track fragments starts where the first one's data ended, so its run names none.
    const names = (which: "picture" | "telemetry") => base === "fragment" || first === which;
    const sizes = PICTURE.map((frame) => u32(frame.length));
    const pictureRun = names("picture")
      ? full("trun", 0, 0x201, u32(2), u32(pictureAt), ...sizes)
      : full("trun", 0, 0x200, u32(2), ...sizes);
    const telemetryRun = shortRun
      ? full("trun", 0, 0x1, u32(1))
      : names("telemetry")
        ? full("trun", 0, 0x1, u32(1), u32(telemetryAt))
        : full("trun", 0, 0, u32(1));
    const pictureFragment = box("traf", full("tfhd", 0, baseFlag, u32(TRACK_IDS.vide)), pictureRun);
    const telemetryFragment = box(
      "traf",
      full("tfhd", 0, baseFlag, u32(TRACK_IDS.meta)),
      telemetryRun
    );
    const telemetryOut = published ? freeSpace(telemetryFragment) : telemetryFragment;
    return box(
      "moof",
      full("mfhd", 0, 0, u32(1)),
      ...(first === "picture" ? [pictureFragment, telemetryOut] : [telemetryOut, pictureFragment])
    );
  };
  const mediaAt = fragment(0).length + 8;
  const telemetrySample = published ? zeros(telemetry) : RECORDER_DETAILS.track;
  const media = box(
    "mdat",
    ...(first === "picture" ? [...PICTURE, telemetrySample] : [telemetrySample, ...PICTURE])
  );
  return concat(header, movie, fragment(mediaAt), media);
}

function movieHeader(published: boolean): Bytes {
  const time = published ? 0 : RECORDED_AT;
  return full(
    "mvhd",
    0,
    0,
    u32(time),
    u32(time),
    u32(1000),
    u32(1000),
    u32(0x10000),
    u16(0x100),
    zeros(10),
    MATRIX,
    zeros(24),
    u32(4)
  );
}

interface TrackOptions {
  published: boolean;
  selfContained?: boolean;
  entry?: string;
  userData?: boolean;
  /** One chunk of frames each given a size of 1, sized by the sample description instead. */
  legacySizes?: boolean;
}

/**
 * A track whose samples sit at `offsets`: the two frames of picture together
 * in one chunk, any other sample in a chunk of its own.
 */
function track(
  handler: Handler,
  offsets: number[],
  { published, selfContained = true, entry, userData = false, legacySizes = false }: TrackOptions
): Bytes {
  const time = published ? 0 : RECORDED_AT;
  const sampleBytes = SAMPLES.filter((sample) => sample.handler === handler)
    .slice(0, offsets.length)
    .map(({ bytes }) => bytes.length);
  // The old way counts one "sample" per byte of sound and gives each a size of 1.
  const sizes = legacySizes
    ? Array.from({ length: sampleBytes.reduce((sum, size) => sum + size, 0) }, () => 1)
    : sampleBytes;
  const perChunk = legacySizes ? sizes.length : handler === "vide" && offsets.length === 2 ? 2 : 1;
  const chunks = legacySizes
    ? offsets.slice(0, 1)
    : offsets.filter((_, index) => index % perChunk === 0);
  const mediaHeader = {
    vide: full("vmhd", 0, 1, zeros(8)),
    soun: full("smhd", 0, 0, zeros(4)),
    meta: full("nmhd", 0, 0),
  }[handler];
  const sampleEntry = entry ?? { vide: "avc1", soun: "mp4a", meta: "mett" }[handler];
  const ownUserData = box("udta", box("name", `${RECORDER_DETAILS.appleModel} camera`));
  return box(
    "trak",
    full(
      "tkhd",
      0,
      3,
      u32(time),
      u32(time),
      u32(TRACK_IDS[handler]),
      zeros(4),
      u32(1000),
      zeros(16),
      MATRIX,
      u32(160 << 16),
      u32(120 << 16)
    ),
    box(
      "mdia",
      full("mdhd", 0, 0, u32(time), u32(time), u32(1000), u32(1000), u16(0x55c4), u16(0)),
      full("hdlr", 0, 0, u32(0), handler, zeros(12), `${handler} handler\0`),
      box(
        "minf",
        mediaHeader,
        box("dinf", full("dref", 0, 0, u32(1), full("url ", 0, selfContained ? 1 : 0))),
        box(
          "stbl",
          full("stsd", 0, 0, u32(1), box(sampleEntry, zeros(16))),
          full("stts", 0, 0, u32(0)),
          full(
            "stsc",
            0,
            0,
            u32(chunks.length ? 1 : 0),
            ...(chunks.length ? [u32(1), u32(perChunk), u32(1)] : [])
          ),
          legacySizes
            ? full("stsz", 0, 0, u32(1), u32(sizes.length))
            : full("stsz", 0, 0, u32(0), u32(sizes.length), ...sizes.map(u32)),
          full("stco", 0, 0, u32(chunks.length), ...chunks.map(u32))
        )
      )
    ),
    ...(userData ? [published ? freeSpace(ownUserData) : ownUserData] : [])
  );
}

/** What a blanked box becomes: free space of the same length, holding zeros. */
function freeSpace(of: Bytes): Bytes {
  return concat(u32(of.length), "free", zeros(of.length - 8));
}

function box(type: string, ...parts: Part[]): Bytes {
  const body = concat(...parts);
  return concat(u32(8 + body.length), type, body);
}

function full(type: string, version: number, flags: number, ...parts: Part[]): Bytes {
  return box(type, [version, (flags >> 16) & 0xff, (flags >> 8) & 0xff, flags & 0xff], ...parts);
}

// ---------------------------------------------------------------------------
// WebM
// ---------------------------------------------------------------------------

const UNKNOWN_SIZE = [0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff];

/**
 * A recording as a browser writes it: a segment and a cluster of unknown size,
 * a title and recording date in the segment's info, named tracks, and tags
 * holding the place.
 */
interface WebmOptions {
  /** A third track, of subtitles. */
  subtitles?: boolean;
  /** An element of an ID Matroska does not define, between the cluster's blocks. */
  unknownInCluster?: boolean;
  /** The segment gives its size, while its cluster still runs until something ends it. */
  sizedSegment?: boolean;
}

function webm(
  published: boolean,
  { subtitles = false, unknownInCluster = false, sizedSegment = false }: WebmOptions = {}
): Bytes {
  const scrub = (element: Bytes) => (published ? voidOf(element) : element);
  const header = element(
    0x1a45dfa3,
    element(0x4286, [1]),
    element(0x42f7, [1]),
    element(0x42f2, [4]),
    element(0x42f3, [8]),
    element(0x4282, "webm"),
    element(0x4287, [4]),
    element(0x4285, [2])
  );
  const info = element(
    0x1549a966,
    element(0x2ad7b1, u32(1_000_000)),
    scrub(element(0x7ba9, RECORDER_DETAILS.title)),
    scrub(element(0x4461, [0x09, 0x3a, 0x4c, 0x2b, 0x1e, 0x7a, 0x00, 0x00])),
    element(0x4d80, "Chrome"),
    element(0x5741, "Chrome")
  );
  const trackEntry = (number: number, type: number, codec: string, name: string) =>
    element(
      0xae,
      element(0xd7, [number]),
      element(0x73c5, [number]),
      element(0x83, [type]),
      element(0x86, codec),
      scrub(element(0x536e, name))
    );
  const tracks = element(
    0x1654ae6b,
    trackEntry(1, 1, "V_VP9", `${RECORDER_DETAILS.model} camera`),
    trackEntry(2, 2, "A_OPUS", `${RECORDER_DETAILS.model} microphone`),
    ...(subtitles ? [trackEntry(3, 17, "S_TEXT/WEBVTT", "Captions")] : [])
  );
  const tags = element(
    0x1254c367,
    element(
      0x7373,
      element(0x63c0),
      element(0x67c8, element(0x45a3, "LOCATION"), element(0x4487, `${RECORDER_DETAILS.location}/`))
    )
  );
  const cluster = concat(
    [0x1f, 0x43, 0xb6, 0x75],
    UNKNOWN_SIZE,
    element(0xe7, [0]),
    element(0xa3, [0x81, 0, 0, 0x80], PICTURE[0]),
    ...(unknownInCluster ? [element(0x5a5a, "vendor note")] : []),
    element(0xa3, [0x82, 0, 0, 0x80], SOUND)
  );
  const body = concat(info, tracks, scrub(tags), cluster);
  const size = sizedSegment ? sizeField(body.length, 8) : UNKNOWN_SIZE;
  return concat(header, [0x18, 0x53, 0x80, 0x67], size, body);
}

/** An EBML element: its ID's own bytes, then its size in the fewest bytes that hold it. */
function element(id: number, ...parts: Part[]): Bytes {
  const body = concat(...parts);
  const idBytes: number[] = [];
  for (let value = id; value > 0; value = Math.floor(value / 256)) idBytes.unshift(value % 256);
  return concat(idBytes, sizeField(body.length), body);
}

/** What a voided element becomes: a Void element of the same length, holding zeros. */
function voidOf(of: Bytes): Bytes {
  for (let length = 1; length <= 8; length += 1) {
    const content = of.length - 1 - length;
    if (content >= 0 && content <= 2 ** (7 * length) - 2)
      return concat([0xec], sizeField(content, length), zeros(content));
  }
  throw new Error("An element this short cannot be voided");
}

function sizeField(value: number, length = 1): number[] {
  while (value > 2 ** (7 * length) - 2) length += 1;
  const field: number[] = [];
  let rest = value + 2 ** (7 * length);
  for (let index = 0; index < length; index += 1) {
    field.unshift(rest % 256);
    rest = Math.floor(rest / 256);
  }
  return field;
}

// ---------------------------------------------------------------------------
// Bytes
// ---------------------------------------------------------------------------

function concat(...parts: Part[]): Bytes {
  const arrays = parts.map((part) =>
    typeof part === "string"
      ? Uint8Array.from(part, (character) => character.charCodeAt(0))
      : Uint8Array.from(part)
  );
  const bytes = new Uint8Array(arrays.reduce((sum, array) => sum + array.length, 0));
  let offset = 0;
  for (const array of arrays) {
    bytes.set(array, offset);
    offset += array.length;
  }
  return bytes;
}

function zeros(length: number): Bytes {
  return new Uint8Array(length);
}

function u16(value: number): number[] {
  return [(value >> 8) & 0xff, value & 0xff];
}

function u32(value: number): number[] {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

function u32le(value: number): number[] {
  return u32(value).reverse();
}
