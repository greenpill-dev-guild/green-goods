import { Button } from "@green-goods/shared/components/Button";
import { IconButton } from "@green-goods/shared/components/IconButton";
import { RiCameraFill, RiImageFill, RiMicLine, RiStopFill } from "@remixicon/react";
import { useIntl } from "react-intl";

import { pwaStatusStyles } from "@/components/Pwa/statusStyles";

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
 * Tools and the forward act share the page-level lg height (DL-023).
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
            <IconButton
              emphasis="secondary"
              size="lg"
              onClick={() => document.getElementById("proof-media-upload")?.click()}
              disabled={isProcessing}
              aria-label={formatMessage({ id: "app.proof.media.gallery" })}
              icon={<RiImageFill className={pwaStatusStyles.primary.icon} aria-hidden="true" />}
            />
            <IconButton
              emphasis="secondary"
              size="lg"
              onClick={() => document.getElementById("proof-media-camera")?.click()}
              disabled={isProcessing}
              aria-label={formatMessage({ id: "app.proof.media.camera" })}
              icon={<RiCameraFill className={pwaStatusStyles.primary.icon} aria-hidden="true" />}
            />
            <IconButton
              // Recording fills the tool with the error color, as on Submit Work.
              emphasis={isRecording ? "primary" : "secondary"}
              tone={isRecording ? "danger" : "default"}
              size="lg"
              onClick={onToggleRecording}
              aria-pressed={isRecording}
              aria-label={formatMessage({
                id: isRecording ? "app.proof.media.stopRecording" : "app.proof.media.record",
              })}
              icon={
                isRecording ? (
                  <RiStopFill aria-hidden="true" />
                ) : (
                  <RiMicLine className={pwaStatusStyles.primary.icon} aria-hidden="true" />
                )
              }
            />
          </>
        ) : null}
        <Button
          aria-describedby={blocked ? "proof-blocked" : undefined}
          type="button"
          size="lg"
          loading={isPending}
          disabled={!canAdvance && !isPending}
          onClick={onAdvance}
          className="min-w-0 flex-1"
        >
          {formatMessage({ id: advanceLabelId })}
        </Button>
      </div>
    </div>
  );
}
