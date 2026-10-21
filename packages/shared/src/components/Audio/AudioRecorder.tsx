import {
  RiCheckLine,
  RiDeleteBinLine,
  RiLoader4Line,
  RiMicLine,
  RiStopFill,
} from "@remixicon/react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_AUDIO_RECORDING_MAX_DURATION,
  useAudioRecorder,
} from "../../hooks/utils/useAudioRecorder";
import { useTimeout } from "../../hooks/utils/useTimeout";
import { cn } from "../../utils/styles/cn";
import { Button } from "../Button";
import { AudioPlayer } from "./AudioPlayer";

type PreviewState = "idle" | "preview" | "confirmed";

export interface AudioRecorderProps {
  /** Called when a recording is confirmed by the user */
  onRecordingComplete: (file: File) => void;
  /** Maximum recording duration in seconds (default: 260 = 4:20) */
  maxDuration?: number;
  disabled?: boolean;
  className?: string;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Audio recorder component using MediaRecorder API.
 *
 * Flow: idle -> requesting-permission -> recording -> preview -> confirmed
 * Records in WebM/Opus format with a configurable max duration.
 * Provides a simple amplitude level indicator during recording.
 *
 * Its controls are the shared `Button` at the `sm` size, so they take the
 * surface's corner and metric: 40px in the app, the cockpit's 32px pill in
 * admin (DL-031).
 */
export function AudioRecorder({
  onRecordingComplete,
  maxDuration = DEFAULT_AUDIO_RECORDING_MAX_DURATION,
  disabled = false,
  className,
}: AudioRecorderProps) {
  const [previewState, setPreviewState] = useState<PreviewState>("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const recordedFileRef = useRef<File | null>(null);
  const { set: scheduleTimeout } = useTimeout();
  const {
    isRecording,
    isRequesting,
    elapsed,
    amplitude,
    error,
    start: handleStart,
    stop: handleStop,
  } = useAudioRecorder({
    maxDuration,
    monitorAmplitude: true,
    onRecordingComplete: (file) => {
      recordedFileRef.current = file;
      setPreviewUrl(URL.createObjectURL(file));
      setPreviewState("preview");
    },
  });
  const state = isRequesting ? "requesting-permission" : isRecording ? "recording" : previewState;

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleCancel = useCallback(() => {
    setPreviewUrl(null);
    recordedFileRef.current = null;
    setPreviewState("idle");
  }, []);

  const handleConfirm = useCallback(() => {
    if (recordedFileRef.current) {
      onRecordingComplete(recordedFileRef.current);
      setPreviewState("confirmed");
      scheduleTimeout(handleCancel, 500);
    }
  }, [onRecordingComplete, handleCancel, scheduleTimeout]);

  const remaining = maxDuration - elapsed;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* Recording controls */}
      {state === "idle" && (
        <Button
          type="button"
          emphasis="secondary"
          size="sm"
          onClick={handleStart}
          disabled={disabled}
          aria-label="Start recording audio note"
          leadingIcon={<RiMicLine className="h-4 w-4" aria-hidden="true" />}
        >
          Record Audio Note
        </Button>
      )}

      {state === "requesting-permission" && (
        <div className="flex items-center gap-2 text-sm text-text-soft-400">
          <RiLoader4Line className="h-4 w-4 animate-spin" aria-hidden="true" />
          Requesting microphone access...
        </div>
      )}

      {state === "recording" && (
        <div className="flex items-center gap-3">
          {/* Amplitude indicator */}
          <div
            className="h-8 w-8 rounded-full bg-error-base transition-transform"
            style={{ transform: `scale(${0.6 + amplitude * 0.4})` }}
            aria-hidden="true"
          />

          {/* Timer */}
          <span
            className="tabular-nums text-sm font-medium text-text-strong-950"
            aria-live="polite"
          >
            {formatTime(elapsed)}
          </span>
          <span className="text-xs text-text-soft-400">/ {formatTime(maxDuration)}</span>

          {/* Remaining warning */}
          {remaining <= 30 && (
            <span className="text-xs text-warning-base" aria-live="polite">
              {remaining}s left
            </span>
          )}

          <div className="flex-1" />

          <Button
            type="button"
            emphasis="primary"
            tone="danger"
            size="sm"
            onClick={handleStop}
            aria-pressed="true"
            aria-label="Stop recording"
            leadingIcon={<RiStopFill className="h-4 w-4" aria-hidden="true" />}
          >
            Stop
          </Button>
        </div>
      )}

      {state === "preview" && previewUrl && (
        <div className="flex flex-col gap-2">
          <AudioPlayer src={previewUrl} compact />

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleConfirm}
              aria-label="Confirm recording"
              leadingIcon={<RiCheckLine className="h-4 w-4" aria-hidden="true" />}
            >
              Use
            </Button>

            <Button
              type="button"
              emphasis="secondary"
              size="sm"
              onClick={handleCancel}
              aria-label="Discard recording"
              leadingIcon={<RiDeleteBinLine className="h-4 w-4" aria-hidden="true" />}
            >
              Discard
            </Button>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="text-xs text-error-base" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
