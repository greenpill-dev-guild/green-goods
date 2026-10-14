import sharp from "sharp";

/**
 * Photo normalization before anything else sees the bytes: a bounded decode, orientation applied,
 * resized within a fixed edge, flattened and re-encoded as JPEG. Sharp writes no metadata unless
 * asked, so EXIF location, device and author fields never reach a model, the browser or IPFS.
 */
const LIMITS = { maxInputPixels: 40_000_000, maxEdge: 2_048, quality: 85 };

// One expensive decode at a time per worker.
sharp.concurrency(1);

export class ImageRejectedError extends Error {
  constructor() {
    super("The image could not be decoded within the processing limits");
    this.name = "ImageRejectedError";
  }
}

export async function sanitizeImage(
  bytes: Uint8Array
): Promise<{ bytes: Uint8Array; mime: "image/jpeg"; width: number; height: number }> {
  try {
    const { data, info } = await sharp(bytes, {
      limitInputPixels: LIMITS.maxInputPixels,
      failOn: "error",
      sequentialRead: true,
    })
      .rotate()
      .resize({
        width: LIMITS.maxEdge,
        height: LIMITS.maxEdge,
        fit: "inside",
        withoutEnlargement: true,
      })
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .jpeg({ quality: LIMITS.quality })
      .toBuffer({ resolveWithObject: true });
    return {
      bytes: new Uint8Array(data),
      mime: "image/jpeg",
      width: info.width,
      height: info.height,
    };
  } catch {
    throw new ImageRejectedError();
  }
}
