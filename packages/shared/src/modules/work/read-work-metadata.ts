import { getFileByHash } from "../data/ipfs/resolve";
import type { WorkMetadata } from "../../types/domain";

export function parseInlineWorkMetadata(raw: string): WorkMetadata | null {
  try {
    let parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "string") parsed = JSON.parse(parsed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      return parsed as WorkMetadata;
  } catch {
    /* Content identifiers are resolved by readWorkMetadata. */
  }
  return null;
}

/** One decoding boundary for foreground reads and offline preparation. */
export async function readWorkMetadata(raw: string, signal?: AbortSignal): Promise<WorkMetadata> {
  const inline = parseInlineWorkMetadata(raw);
  if (inline) return inline;
  const file = await getFileByHash(raw, { signal, timeoutMs: 30_000 });
  const text = typeof file.data === "string" ? file.data : await file.data.text();
  const parsed = parseInlineWorkMetadata(text);
  if (!parsed) throw new Error("Invalid work metadata");
  return parsed;
}
