import {
  RiCheckLine,
  RiDeleteBinLine,
  RiLoader4Line,
  RiMicLine,
  RiStopFill,
} from "@remixicon/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTimeout } from "../../hooks/utils/useTimeout";
import { cn } from "../../utils/styles/cn";
import { Button } from "../Button";
import { AudioPlayer } from "./AudioPlayer";

type RecorderState = "idle" | "requesting-permission" | "recording" | "preview" | "confirmed";

const DEFAULT_MAX_DURATION = 260; // 4:20 in seconds

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
  maxDuration = DEFAULT_MAX_DURATION,
  disabled = false,
  className,
}: AudioRecorderProps) {
  const [state, setState] = useState<RecorderState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [amplitude, setAmplitude] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const recordedFileRef = useRef<File | null>(null);
  const { set: scheduleTimeout } = useTimeout();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      audioContextRef.current?.close();
      audioContextRef.current = null;
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const stopAmplitudeMonitor = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setAmplitude(0);
  }, []);

  const startAmplitudeMonitor = useCallback((stream: MediaStream) => {
    try {
      // Close any prior AudioContext before creating a new one
      audioContextRef.current?.close();
      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((sum, v) => sum + v, 0) / data.length;
        setAmplitude(Math.min(avg / 128, 1)); // 0..1
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // AudioContext unavailable — amplitude indicator just won't work
    }
  }, []);

  const handleStart = useCallback(async () => {
    setError(null);
    setState("requesting-permission");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const file = new File([blob], `audio-note-${Date.now()}.webm`, { type: mimeType });
        recordedFileRef.current = file;

        // Revoke previous preview if any
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setState("preview");

        stopStream();
        stopAmplitudeMonitor();
      };

      recorder.start(1000); // Collect data every second
      setState("recording");
      setElapsed(0);

      startAmplitudeMonitor(stream);

      // Timer for elapsed + auto-stop
      timerRef.current = setInterval(() => {
        setElapsed((prev) => {
          const next = prev + 1;
          if (next >= maxDuration) {
            recorder.stop();
            if (timerRef.current) clearInterval(timerRef.current);
          }
          return next;
        });
      }, 1000);
    } catch {
      setState("idle");
      setError("Microphone access denied. Please allow microphone permissions.");
      stopStream();
    }
  }, [maxDuration, previewUrl, startAmplitudeMonitor, stopAmplitudeMonitor, stopStream]);

  const handleStop = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleCancel = useCallback(() => {
    handleStop();
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    recordedFileRef.current = null;
    chunksRef.current = [];
    setState("idle");
    setElapsed(0);
    stopStream();
    stopAmplitudeMonitor();
  }, [handleStop, previewUrl, stopStream, stopAmplitudeMonitor]);

  const handleConfirm = useCallback(() => {
    if (recordedFileRef.current) {
      onRecordingComplete(recordedFileRef.current);
      setState("confirmed");
      // Reset after a brief moment (auto-cleaned on unmount by useTimeout)
      scheduleTimeout(() => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
        recordedFileRef.current = null;
        setState("idle");
        setElapsed(0);
      }, 500);
    }
  }, [onRecordingComplete, previewUrl, scheduleTimeout]);

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
