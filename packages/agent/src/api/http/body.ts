import type { PublicApiError } from "@green-goods/shared/public-contracts";
import { safeError } from "./responses";

export const PUBLIC_JSON_BODY_LIMIT_BYTES = 16 * 1024;

export type BodyReadResult<T> =
  | { ok: true; value: T | undefined }
  | { ok: false; error: PublicApiError; status: 413 };

export async function readJsonBody<T>(request: Request): Promise<T | undefined> {
  try {
    return (await request.json()) as T;
  } catch {
    return undefined;
  }
}

export async function readBodyWithLimit(
  body: ReadableStream<Uint8Array>,
  maxBytes: number
): Promise<Uint8Array | null> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel("attachment too large").catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return combined;
}

function payloadTooLargeError(maxBytes: number): PublicApiError {
  return safeError("invalid_request", "Request body is too large.", {
    params: { maxBytes },
  });
}

function declaredBodyTooLarge(request: Request, maxBytes: number): boolean {
  const contentLength = request.headers.get("content-length");
  if (!contentLength) return false;
  const parsed = Number(contentLength);
  return Number.isFinite(parsed) && parsed > maxBytes;
}

export async function readLimitedTextBody(
  request: Request,
  maxBytes: number
): Promise<{ ok: true; text: string } | { ok: false; error: PublicApiError; status: 413 }> {
  if (declaredBodyTooLarge(request, maxBytes)) {
    return { ok: false, error: payloadTooLargeError(maxBytes), status: 413 };
  }

  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) {
    return { ok: false, error: payloadTooLargeError(maxBytes), status: 413 };
  }

  return { ok: true, text };
}

export async function readLimitedJsonBody<T>(
  request: Request,
  maxBytes = PUBLIC_JSON_BODY_LIMIT_BYTES
): Promise<BodyReadResult<T>> {
  const body = await readLimitedTextBody(request, maxBytes);
  if (!body.ok) return body;

  try {
    return { ok: true, value: JSON.parse(body.text) as T };
  } catch {
    return { ok: true, value: undefined };
  }
}
