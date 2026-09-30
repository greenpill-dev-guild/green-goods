import { Button } from "@green-goods/shared/components/Button";
import { IconButton } from "@green-goods/shared/components/IconButton";
import { cn } from "@green-goods/shared/utils/styles/cn";
import {
  RiArrowRightSLine,
  RiCameraFill,
  RiImageFill,
  RiMicLine,
  RiStopFill,
} from "@remixicon/react";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";

import { pwaStatusStyles } from "@/components/Pwa/statusStyles";

/**
 * The fixed bar Submit Work and Add Proof share (D16, D18): lines saying what
 * the step waits on, then one row with the media tools, on the media step, and
 * the one forward act.
 */
export function FlowBar({
  status,
  tools,
  children,
}: {
  status?: ReactNode;
  tools?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      data-component="FlowBar"
      className="flex fixed left-0 bottom-0 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] w-full z-modal bg-bg-white-0 border-t border-stroke-soft-200 rounded-t-[var(--radius-lg)] overflow-hidden"
    >
      <div className="flex flex-col gap-2 w-full padded">
        {status}
        <div className="flex flex-row gap-4 w-full">
          {tools}
          {children}
        </div>
      </div>
    </div>
  );
}

/** One line above the acts: why the forward act waits, or where a send stands. */
export function FlowBarNote({
  id,
  tone = "neutral",
  children,
}: {
  id?: string;
  tone?: "neutral" | "success";
  children: ReactNode;
}) {
  return (
    <p
      id={id}
      className={cn("text-xs px-1", tone === "success" ? "text-success-dark" : "text-text-sub-600")}
      role="status"
      aria-live="polite"
    >
      {children}
    </p>
  );
}

/** The step's one forward act, full width at the page-level lg height (DL-023). */
export function FlowForward({
  label,
  onClick,
  disabled = false,
  loading = false,
  describedBy,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** The note that says why it waits. */
  describedBy?: string;
}) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      loading={loading}
      aria-describedby={describedBy}
      className="w-full"
      size="lg"
      type="button"
      trailingIcon={
        loading ? undefined : <RiArrowRightSLine className="h-5 w-5" aria-hidden="true" />
      }
    >
      {label}
    </Button>
  );
}

/**
 * The media step's tools: your photos, the camera, and a voice note, which
 * fills with the error colour while it records.
 */
export function MediaTools({
  onGallery,
  onCamera,
  onToggleRecording,
  isRecording,
  disabled = false,
}: {
  onGallery: () => void;
  onCamera: () => void;
  onToggleRecording: () => void;
  isRecording: boolean;
  /** Photos are still being prepared, so more can't be added yet. */
  disabled?: boolean;
}) {
  const { formatMessage } = useIntl();
  return (
    <>
      <IconButton
        onClick={onGallery}
        disabled={disabled}
        aria-label={formatMessage({ id: "app.proof.media.gallery" })}
        emphasis="secondary"
        size="lg"
        icon={<RiImageFill className={pwaStatusStyles.primary.icon} aria-hidden="true" />}
      />
      <IconButton
        onClick={onCamera}
        disabled={disabled}
        aria-label={formatMessage({ id: "app.proof.media.camera" })}
        emphasis="secondary"
        size="lg"
        icon={<RiCameraFill className={pwaStatusStyles.primary.icon} aria-hidden="true" />}
      />
      <IconButton
        onClick={onToggleRecording}
        aria-label={formatMessage({
          id: isRecording ? "app.proof.media.stopRecording" : "app.proof.media.record",
        })}
        aria-pressed={isRecording}
        emphasis={isRecording ? "primary" : "secondary"}
        tone={isRecording ? "danger" : "default"}
        size="lg"
        icon={
          isRecording ? (
            <RiStopFill aria-hidden="true" />
          ) : (
            <RiMicLine className={pwaStatusStyles.primary.icon} aria-hidden="true" />
          )
        }
      />
    </>
  );
}
