/**
 * Native Compression Utilities
 *
 * Uses browser-native CompressionStream/DecompressionStream APIs (2023+)
 * Eliminates need for pako/zlib bundle dependencies
 *
 * @module utils/compression
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Compression_Streams_API
 */

export type CompressionFormat = "gzip" | "deflate" | "deflate-raw";

/**
 * Check if native compression streams are supported
 */
export function isCompressionSupported(): boolean {
  return typeof CompressionStream !== "undefined" && typeof DecompressionStream !== "undefined";
}

/**
 * Compress data using native CompressionStream
 *
 * @param data - String or ArrayBuffer to compress
 * @param format - Compression format (default: gzip)
 * @returns Compressed data as ArrayBuffer
 */
export async function compress(
  data: string | ArrayBuffer,
  format: CompressionFormat = "gzip"
): Promise<ArrayBuffer> {
  if (!isCompressionSupported()) {
    throw new Error("CompressionStream API not supported in this environment");
  }

  const input = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);

  const cs = new CompressionStream(format);
  const writer = cs.writable.getWriter();
  writer.write(input);
  writer.close();

  const chunks: Uint8Array[] = [];
  const reader = cs.readable.getReader();

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  // Combine chunks into single ArrayBuffer
  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result.buffer;
}

/**
 * Decompress data using native DecompressionStream
 *
 * @param data - Compressed ArrayBuffer
 * @param format - Compression format (default: gzip)
 * @returns Decompressed string
 */
export async function decompress(
  data: ArrayBuffer,
  format: CompressionFormat = "gzip"
): Promise<string> {
  if (!isCompressionSupported()) {
    throw new Error("DecompressionStream API not supported in this environment");
  }

  const ds = new DecompressionStream(format);
  const writer = ds.writable.getWriter();
  writer.write(new Uint8Array(data));
  writer.close();

  const reader = ds.readable.getReader();
  const chunks: Uint8Array[] = [];

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  // Combine chunks and decode to string
  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return new TextDecoder().decode(result);
}

/**
 * Decompress a fetch Response body if it's gzip-encoded
 *
 * Note: Modern browsers automatically decompress gzip responses,
 * but this is useful for manually handling compressed blobs from IndexedDB
 * or other sources.
 *
 * @param response - Fetch Response object
 * @returns Decompressed text content
 */
export async function decompressResponse(response: Response): Promise<string> {
  const contentEncoding = response.headers.get("content-encoding");

  // Only decompress if we received compressed content that wasn't auto-decompressed
  if (contentEncoding === "gzip" && isCompressionSupported()) {
    const buffer = await response.arrayBuffer();
    return decompress(buffer, "gzip");
  }

  if (contentEncoding === "deflate" && isCompressionSupported()) {
    const buffer = await response.arrayBuffer();
    return decompress(buffer, "deflate");
  }

  // Return text for uncompressed or auto-decompressed responses
  return response.text();
}

/**
 * Compress JSON data for efficient storage or transmission
 *
 * @param data - JSON-serializable data
 * @param format - Compression format (default: gzip)
 * @returns Compressed data as Blob
 */
export async function compressJSON<T>(data: T, format: CompressionFormat = "gzip"): Promise<Blob> {
  const json = JSON.stringify(data);
  const compressed = await compress(json, format);
  const mimeType = format === "gzip" ? "application/gzip" : "application/octet-stream";
  return new Blob([compressed], { type: mimeType });
}

/**
 * Decompress and parse JSON data
 *
 * @param data - Compressed ArrayBuffer or Blob
 * @param format - Compression format (default: gzip)
 * @returns Parsed JSON data
 */
export async function decompressJSON<T>(
  data: ArrayBuffer | Blob,
  format: CompressionFormat = "gzip"
): Promise<T> {
  const buffer = data instanceof Blob ? await data.arrayBuffer() : data;
  const json = await decompress(buffer, format);
  return JSON.parse(json) as T;
}

/**
 * Calculate compression ratio
 *
 * @param original - Original size in bytes
 * @param compressed - Compressed size in bytes
 * @returns Compression ratio as percentage (e.g., 75 means 75% smaller)
 */
export function getCompressionRatio(original: number, compressed: number): number {
  if (original === 0) return 0;
  return Math.round(((original - compressed) / original) * 100);
}
