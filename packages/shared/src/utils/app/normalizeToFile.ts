export interface NormalizeToFileOptions {
  /**
   * Fallback filename used when the input has no usable `name`.
   * Provide a deterministic name when possible (e.g. `work-${jobId}-${index}.jpg`).
   */
  fallbackName: string;
  /** MIME type to use when the input blob has an empty type. */
  mimeTypeFallback?: string;
  /** lastModified timestamp for the created File (defaults to now). */
  lastModified?: number;
}

/**
 * Normalizes arbitrary "file-ish" inputs into a real `File`.
 *
 * Useful when upstream code may produce `Blob`s (e.g. image compression, canvas exports),
 * or when `instanceof File` checks are unreliable due to cross-realm objects.
 */
export function normalizeToFile(input: unknown, options: NormalizeToFileOptions): File | null {
  if (input instanceof File) {
    return input;
  }

  // Cross-realm safety: `instanceof Blob` can fail in some cases, so fall back to
  // structural checks for a Blob-like object.
  const isBlobLike =
    typeof input === "object" &&
    input !== null &&
    typeof (input as { arrayBuffer?: unknown }).arrayBuffer === "function" &&
    typeof (input as { slice?: unknown }).slice === "function" &&
    typeof (input as { size?: unknown }).size === "number" &&
    typeof (input as { type?: unknown }).type === "string";

  if (!(input instanceof Blob) && !isBlobLike) {
    return null;
  }

  const blob = input as Blob;

  // Best-effort filename preservation (if present).
  const maybeName =
    typeof (input as { name?: unknown }).name === "string"
      ? (input as { name: string }).name
      : null;

  const name = maybeName && maybeName.length > 0 ? maybeName : options.fallbackName;

  return new File([blob], name, {
    type: blob.type || options.mimeTypeFallback || "image/jpeg",
    lastModified: options.lastModified ?? Date.now(),
  });
}
