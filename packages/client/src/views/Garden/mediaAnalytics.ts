import { DEFAULT_CHAIN_ID, track } from "@green-goods/shared";

type AuthMode = "wallet" | "passkey" | "embedded" | null;

type WorkMediaEventName =
  | "work_media_selected"
  | "work_media_heic_conversion_started"
  | "work_media_heic_conversion_succeeded"
  | "work_media_heic_conversion_failed"
  | "work_media_preview_failed"
  | "work_media_removed"
  | "work_broken_media_removed";

type WorkMediaEventMetadata = {
  work_submission_journey_id?: string | null;
  source?: "camera" | "gallery" | "media" | "review";
  file_count?: number;
  mime_type?: string;
  mime_types?: string[];
  extension?: string;
  extensions?: string[];
  size_bucket?: string;
  size_buckets?: string[];
  media_kind?: string;
  image_count?: number;
  video_count?: number;
  conversion_count?: number;
  rejected_count?: number;
  broken_count?: number;
  auth_mode?: AuthMode;
  chain_id?: number;
  app_version?: string;
  action_uid?: number | null;
  submission_phase?: "media" | "review";
  parsed_error_family?: string;
};

export function trackWorkMediaJourneyEvent(
  event: WorkMediaEventName,
  metadata: WorkMediaEventMetadata
) {
  track(
    event,
    {
      chain_id: DEFAULT_CHAIN_ID,
      app_version: import.meta.env.VITE_APP_VERSION || "unknown",
      ...metadata,
    },
    { includeSessionId: false }
  );
}
