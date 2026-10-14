import { FlowBar, FlowBarNote, FlowForward, MediaTools } from "@/components/Features/Work";

export interface ProofBarProps {
  /** The media tools ride the bar only on the media step. */
  showMediaTools: boolean;
  isProcessing: boolean;
  isRecording: boolean;
  onToggleRecording: () => void;
  /** What the one forward act says and whether it may be pressed. */
  advanceLabel: string;
  canAdvance: boolean;
  isPending: boolean;
  /** Why the forward act waits, said above it; null when it does not. */
  blockedReason: string | null;
  onAdvance: () => void;
}

const BLOCKED_ID = "proof-blocked";

/**
 * Submit Work's bar, element for element (D16): why the step waits, then the
 * photo, camera and voice tools on the media step, and the one forward act. The
 * photo and camera tools click the hidden inputs `ProofMedia` owns, so the
 * capture surface stays in one place and the bar only points at it.
 */
export function ProofBar({
  showMediaTools,
  isProcessing,
  isRecording,
  onToggleRecording,
  advanceLabel,
  canAdvance,
  isPending,
  blockedReason,
  onAdvance,
}: ProofBarProps) {
  const blocked = !canAdvance && blockedReason;
  return (
    <FlowBar
      status={blocked ? <FlowBarNote id={BLOCKED_ID}>{blockedReason}</FlowBarNote> : null}
      tools={
        showMediaTools ? (
          <MediaTools
            onGallery={() => document.getElementById("proof-media-upload")?.click()}
            onCamera={() => document.getElementById("proof-media-camera")?.click()}
            onToggleRecording={onToggleRecording}
            isRecording={isRecording}
            disabled={isProcessing}
          />
        ) : null
      }
    >
      <FlowForward
        label={advanceLabel}
        onClick={onAdvance}
        disabled={!canAdvance && !isPending}
        loading={isPending}
        describedBy={blocked ? BLOCKED_ID : undefined}
      />
    </FlowBar>
  );
}
