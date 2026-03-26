/**
 * Hook for resolving work metadata from an IPFS CID or inline JSON string.
 *
 * Work metadata is stored as a JSON object on IPFS, with the CID referenced
 * in the EAS attestation's `metadata` field. This hook handles both legacy
 * inline JSON and the standard IPFS CID case.
 *
 * @module hooks/work/useWorkMetadata
 */

import { useState } from "react";
import { getFileByHash } from "../../modules/data/ipfs";
import { logger } from "../../modules/app/logger";
import type { WorkMetadata } from "../../types/domain";
import { useAsyncEffect } from "../utils/useAsyncEffect";

export type WorkMetadataStatus = "idle" | "loading" | "success" | "error";

export interface UseWorkMetadataResult {
  metadata: WorkMetadata | null;
  status: WorkMetadataStatus;
  error: string | null;
}

/**
 * Resolves work metadata from a raw string that may be:
 * - An IPFS CID (fetched from gateway)
 * - Inline JSON (parsed directly)
 * - Double-encoded JSON (unwrapped then parsed)
 *
 * @param metadataRaw - The raw metadata string from the EAS attestation
 */
export function useWorkMetadata(metadataRaw: string | undefined): UseWorkMetadataResult {
  const [metadata, setMetadata] = useState<WorkMetadata | null>(null);
  const [status, setStatus] = useState<WorkMetadataStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  useAsyncEffect(
    async ({ signal, isMounted }) => {
      setStatus("loading");
      setError(null);
      setMetadata(null);

      if (!metadataRaw || typeof metadataRaw !== "string") {
        if (isMounted()) {
          setMetadata(null);
          setStatus("success");
        }
        return;
      }

      const trimmed = metadataRaw.trim();

      // Try parsing as inline JSON first (legacy or double-encoded)
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
          let parsed = JSON.parse(trimmed) as unknown;
          if (typeof parsed === "string") {
            parsed = JSON.parse(parsed) as unknown;
          }
          if (isMounted()) {
            setMetadata(parsed as WorkMetadata);
            setStatus("success");
          }
          return;
        } catch {
          // Not valid JSON — fall through to IPFS fetch
        }
      }

      // Treat as IPFS CID and fetch from gateway
      try {
        const file = await getFileByHash(trimmed, { signal, timeoutMs: 30_000 });
        if (!isMounted()) return;

        const raw = file.data;
        const text = typeof raw === "string" ? raw : await raw.text();
        if (!isMounted()) return;

        const parsed = JSON.parse(text) as WorkMetadata;
        setMetadata(parsed);
        setStatus("success");
      } catch (fetchError) {
        if (!isMounted()) return;
        const message = fetchError instanceof Error ? fetchError.message : String(fetchError);
        setMetadata(null);
        setStatus("error");
        setError(message);
        logger.warn("Failed to fetch work metadata from IPFS", {
          metadataRaw: trimmed,
          error: message,
          source: "useWorkMetadata",
        });
      }
    },
    [metadataRaw]
  );

  return { metadata, status, error };
}
