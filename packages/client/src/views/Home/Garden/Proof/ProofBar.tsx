import { RiCameraFill, RiImageFill, RiMicLine, RiStopFill } from "@remixicon/react";
import { useIntl } from "react-intl";

import { pwaStatusStyles } from "@/components/Pwa/statusStyles";

const TOOL_BUTTON =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-lg)] border tap-target-lg";
const TOOL_IDLE = `${TOOL_BUTTON} border-stroke-soft-200 bg-bg-white-0`;

export interface ProofBarProps {
  /** The media tools ride the bar only on the media beat. */
  showMediaTools: boolean;
  isProcessing: boolean;
  isRecording: boolean;
  onToggleRecording: () => void;
  /** What the one forward button says and whether it may be pressed. */
  advanceLabelId: string;
  canAdvance: boolean;
  isPending: boolean;
  /** Why the forward button is held, read aloud beside it; null when it is not. */
  blockedReasonId: string | null;
  onAdvance: () => void;
}

/**
 * The composer's fixed bottom bar: the media tools and the one forward act.
 * The gallery and camera buttons click the hidden inputs that `ProofMedia`
 * owns, so the capture surface stays in one place and the bar only points at it.
 */
export function ProofBar({
  showMediaTools,
  isProcessing,
  isRecording,
  onToggleRecording,
  advanceLabelId,
  canAdvance,
  isPending,
  blockedReasonId,
  onAdvance,
}: ProofBarProps) {
  const { formatMessage } = useIntl();
  const blocked = !canAdvance && blockedReasonId;
  return (
    <div className="shrink-0 border-t border-stroke-soft-200 bg-bg-white-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      {blocked ? (
        <p className="mb-2 text-xs text-text-sub-600" id="proof-blocked" role="status">
          {formatMessage({ id: blockedReasonId })}
        </p>
      ) : null}
      <div className="flex items-center gap-2">
        {showMediaTools ? (
          <>
            <button
              type="button"
              onClick={() => document.getElementById("proof-media-upload")?.click()}
              disabled={isProcessing}
              aria-label={formatMessage({ id: "app.proof.media.gallery" })}
              className={`${TOOL_IDLE} disabled:opacity-60`}
            >
              <RiImageFill className={`h-5 w-5 ${pwaStatusStyles.primary.icon}`} />
            </button>
            <button
              type="button"
              onClick={() => document.getElementById("proof-media-camera")?.click()}
              disabled={isProcessing}
              aria-label={formatMessage({ id: "app.proof.media.camera" })}
              className={`${TOOL_IDLE} disabled:opacity-60`}
            >
              <RiCameraFill className={`h-5 w-5 ${pwaStatusStyles.primary.icon}`} />
            </button>
            <button
              type="button"
              onClick={onToggleRecording}
              aria-pressed={isRecording}
              aria-label={formatMessage({
                id: isRecording ? "app.proof.media.stopRecording" : "app.proof.media.record",
              })}
              className={
                isRecording
                  ? `${TOOL_BUTTON} ${pwaStatusStyles.error.surface} ${pwaStatusStyles.error.border}`
                  : TOOL_IDLE
              }
            >
              {isRecording ? (
                <RiStopFill className={`h-5 w-5 ${pwaStatusStyles.error.icon}`} />
              ) : (
                <RiMicLine className={`h-5 w-5 ${pwaStatusStyles.primary.icon}`} />
              )}
            </button>
          </>
        ) : null}
        <button
          aria-describedby={blocked ? "proof-blocked" : undefined}
          type="button"
          disabled={!canAdvance || isPending}
          aria-busy={isPending}
          onClick={onAdvance}
          className="min-w-0 flex-1 rounded-[var(--radius-lg)] bg-primary-action px-4 py-3 text-sm font-medium text-primary-action-foreground tap-target-lg disabled:opacity-60"
        >
          {formatMessage({ id: advanceLabelId })}
        </button>
      </div>
    </div>
  );
}
