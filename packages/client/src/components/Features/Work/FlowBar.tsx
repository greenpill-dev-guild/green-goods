import { Button } from "@green-goods/shared/components/Button";
import { IconButton } from "@green-goods/shared/components/IconButton";
import { cn } from "@green-goods/shared/utils/styles/cn";
import {
  RiArrowRightSLine,
  RiCameraFill,
  RiFileTextFill,
  RiImageFill,
  RiMicLine,
  RiStopFill,
} from "@remixicon/react";
import type { ReactNode, Ref } from "react";
import { useIntl } from "react-intl";

import { pwaStatusStyles } from "@/components/Pwa/statusStyles";

/**
 * The fixed bar Submit Work and Add Proof share (D16, D18): lines saying what
 * the step waits on, then one row with the media tools, on the media step, and
 * the one forward act. The public reporting pages use it too, with `column` so
 * the bar's content stays in their single reading column on wide screens.
 */
export function FlowBar({
  status,
  tools,
  children,
  layout = "page",
  ref,
}: {
  status?: ReactNode;
  tools?: ReactNode;
  children: ReactNode;
  /** `page` spans the app's page margins; `column` keeps to a centred 48rem column. */
  layout?: "page" | "column";
  /** The bar itself, for a page that measures it to keep its content clear. */
  ref?: Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={ref}
      data-component="FlowBar"
      className="flex fixed left-0 bottom-0 py-3 pb-[calc(0.75rem+var(--safe-area-bottom))] w-full z-modal bg-bg-white-0 border-t border-stroke-soft-200 rounded-t-[var(--radius-lg)] overflow-hidden"
    >
      <div
        className={cn(
          "flex flex-col gap-2 w-full",
          layout === "column" ? "mx-auto max-w-3xl px-4 sm:px-6" : "padded"
        )}
      >
        {status}
        {/* Four tools and the act share one row, so the tools sit closer than a lone act. */}
        <div className={cn("flex flex-row w-full", tools ? "gap-2" : "gap-4")}>
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

/**
 * The step's one forward act, full width at the page-level lg height (DL-023). Given a `form`, it
 * submits that form, so the keyboard's enter key and the act agree.
 */
export function FlowForward({
  label,
  onClick,
  form,
  disabled = false,
  loading = false,
  describedBy,
}: {
  label: string;
  disabled?: boolean;
  loading?: boolean;
  /** The notes above it: why it waits, and the prompts it opens. */
  describedBy?: string;
} & ({ onClick: () => void; form?: never } | { form: string; onClick?: never })) {
  return (
    <Button
      onClick={onClick}
      form={form}
      disabled={disabled}
      loading={loading}
      aria-describedby={describedBy}
      // A long label wraps rather than running past the bar (Portuguese on a 320px phone).
      className="w-full whitespace-normal [text-wrap:balance]"
      size="lg"
      type={form ? "submit" : "button"}
    >
      {/* Beside the four media tools on a narrow phone, the act gives up its arrow, then its
          word, which stays its name for screen readers, rather than spilling out of itself. */}
      <span className="@container flex w-full min-w-0 items-center justify-center gap-2">
        <span className="min-w-0 @max-[60px]:sr-only">{label}</span>
        {loading ? null : (
          <RiArrowRightSLine
            className="h-5 w-5 shrink-0 @min-[60px]:@max-[88px]:hidden"
            aria-hidden="true"
          />
        )}
      </span>
    </Button>
  );
}

/**
 * The media step's tools: your photos and videos, the camera, a voice note, which fills
 * with the error colour while it records, and your documents. Documents have a picker of
 * their own, so the photo picker keeps the phone's photo grid.
 */
export function MediaTools({
  onGallery,
  onCamera,
  onToggleRecording,
  onDocuments,
  isRecording,
  disabled = false,
}: {
  onGallery: () => void;
  onCamera: () => void;
  onToggleRecording: () => void;
  onDocuments: () => void;
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
      <IconButton
        onClick={onDocuments}
        disabled={disabled}
        aria-label={formatMessage({ id: "app.proof.media.documents" })}
        emphasis="secondary"
        size="lg"
        icon={<RiFileTextFill className={pwaStatusStyles.primary.icon} aria-hidden="true" />}
      />
    </>
  );
}
