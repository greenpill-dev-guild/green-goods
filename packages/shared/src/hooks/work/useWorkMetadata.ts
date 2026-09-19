import { useQuery } from "@tanstack/react-query";
import { worksKeys } from "../../config/query-keys/work";
import { GC_TIMES } from "../../config/react-query";
import { parseInlineWorkMetadata, readWorkMetadata } from "../../modules/work/read-work-metadata";
import type { WorkMetadata } from "../../types/domain";
import { useOnlineStatus } from "../app/useOnlineStatus";

export type WorkMetadataStatus = "idle" | "loading" | "success" | "error" | "unavailable";
export interface UseWorkMetadataResult {
  metadata: WorkMetadata | null;
  status: WorkMetadataStatus;
  error: string | null;
  retryFetch: () => void;
}

/** Metadata shares the persisted work cache and automatically retries on reconnect. */
export function useWorkMetadata(metadataRaw: string | undefined): UseWorkMetadataResult {
  const raw = typeof metadataRaw === "string" ? metadataRaw.trim() : "";
  const isOnline = useOnlineStatus();
  const inline = parseInlineWorkMetadata(raw);
  const query = useQuery({
    queryKey: worksKeys.metadata(raw),
    queryFn: ({ signal }) => readWorkMetadata(raw, signal),
    enabled: !!raw && inline === null,
    networkMode: "online",
    staleTime: Infinity,
    gcTime: GC_TIMES.works,
  });
  const metadata = inline ?? query.data ?? null;
  return {
    metadata,
    status:
      !raw || metadata
        ? "success"
        : !isOnline
          ? "unavailable"
          : query.isError
            ? "error"
            : "loading",
    error: query.error ? query.error.message : null,
    retryFetch: () => {
      if (isOnline) void query.refetch();
    },
  };
}
