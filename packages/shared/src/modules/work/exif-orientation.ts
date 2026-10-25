/**
 * The one EXIF tag a published photo keeps
 *
 * EXIF is a TIFF structure carried inside a JPEG segment, a PNG chunk or a
 * WebP chunk. Whichever container holds it, the block is replaced rather than
 * edited: all that survives is the photo's Orientation, written alone in one
 * fixed form, since without it a portrait photo shows on its side. The GPS
 * directory and the camera's make, model and serial go with everything else.
 *
 * @module modules/work/exif-orientation
 */

type Bytes = Uint8Array<ArrayBuffer>;

const ORIENTATION_TAG = 0x0112;
const TIFF_SHORT = 3;

/**
 * What a photo's EXIF block becomes: its Orientation alone, or nothing when the
 * photo is upright. `same` when the block already is exactly that, so a photo
 * stripped once comes back as it was.
 */
export function orientationExif(exif: Bytes): { tiff: Bytes | undefined; same: boolean } {
  const tiff = orientationOnly(readOrientation(exif));
  const same =
    tiff !== undefined &&
    exif.length === tiff.length &&
    exif.every((byte, index) => byte === tiff[index]);
  return { tiff, same };
}

/** The Orientation, 1 to 8, in an EXIF TIFF structure that holds a readable one. */
function readOrientation(tiff: Bytes): number | undefined {
  if (tiff.length < 8) return undefined;
  const byteOrder = String.fromCharCode(tiff[0], tiff[1]);
  if (byteOrder !== "II" && byteOrder !== "MM") return undefined;
  const littleEndian = byteOrder === "II";
  const view = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
  if (view.getUint16(2, littleEndian) !== 42) return undefined;
  const directory = view.getUint32(4, littleEndian);
  if (directory + 2 > tiff.length) return undefined;
  const entries = view.getUint16(directory, littleEndian);
  for (let index = 0; index < entries; index += 1) {
    const entry = directory + 2 + index * 12;
    if (entry + 12 > tiff.length) return undefined;
    if (view.getUint16(entry, littleEndian) !== ORIENTATION_TAG) continue;
    const value = view.getUint16(entry + 8, littleEndian);
    const isShort = view.getUint16(entry + 2, littleEndian) === TIFF_SHORT;
    return isShort && value >= 1 && value <= 8 ? value : undefined;
  }
  return undefined;
}

/**
 * A big-endian TIFF structure holding the Orientation alone, or none when the
 * photo needs none: 1 is upright, which is also what no tag means.
 */
function orientationOnly(orientation: number | undefined): Bytes | undefined {
  if (!orientation || orientation === 1) return undefined;
  const tiff = new Uint8Array(26);
  const view = new DataView(tiff.buffer);
  tiff.set([0x4d, 0x4d]); // "MM"
  view.setUint16(2, 42);
  view.setUint32(4, 8); // the one directory follows the header
  view.setUint16(8, 1); // with one entry
  view.setUint16(10, ORIENTATION_TAG);
  view.setUint16(12, TIFF_SHORT);
  view.setUint32(14, 1);
  view.setUint16(18, orientation); // the rest, the next directory's offset among it, stays zero
  return tiff;
}
