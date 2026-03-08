import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_MAX_DURATION = 260; // 4:20 in seconds

export interface UseAudioRecordingOptions {
  /** Maximum recording duration in seconds (default: 260 = 4:20) */
  maxDuration?: number;
  /** Called when a recording finishes (no preview step — saved immediately) */
  onRecordingComplete: (file: File) => void;
  /** Called on error (e.g. mic permission denied) */
  onError?: (error: string) => void;
}

export interface UseAudioRecordingReturn {
  /** Whether the recorder is currently capturing audio */
  isRecording: boolean;
  /** Whether mic permission is being requested */
  isRequesting: boolean;
  /** Elapsed recording time in seconds */
  elapsed: number;
  /** Human-readable error message, if any */
  error: string | null;
  /** Start if idle, stop if recording */
  toggle: () => void;
  /** Force-stop (no-op if not recording) */
  stop: () => void;
}

/**
 * Headless audio recording hook backed by the MediaRecorder API.
 *
 * Unlike the AudioRecorder component, this hook has no preview/confirm step:
 * when recording stops (user toggle or auto-stop at maxDuration), the file is
 * immediately passed to `onRecordingComplete`.
 *
 * Designed to be driven by an action-bar toggle button.
 */
export function useAudioRecording({
  maxDuration = DEFAULT_MAX_DURATION,
  onRecordingComplete,
  onError,
}: UseAudioRecordingOptions): UseAudioRecordingReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onCompleteRef = useRef(onRecordingComplete);
  const onErrorRef = useRef(onError);

  // Keep callback refs fresh without re-triggering effects
  useEffect(() => {
    onCompleteRef.current = onRecordingComplete;
  }, [onRecordingComplete]);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setIsRequesting(true);

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
        onCompleteRef.current(file);
        stopStream();
        setIsRecording(false);
        setElapsed(0);
      };

      recorder.start(1000);
      setIsRecording(true);
      setIsRequesting(false);
      setElapsed(0);

      // Elapsed timer + auto-stop at maxDuration
      timerRef.current = setInterval(() => {
        setElapsed((prev) => {
          const next = prev + 1;
          if (next >= maxDuration) {
            recorder.stop();
            clearTimer();
          }
          return next;
        });
      }, 1000);
    } catch {
      const msg = "Microphone access denied. Please allow microphone permissions.";
      setError(msg);
      onErrorRef.current?.(msg);
      setIsRequesting(false);
      stopStream();
    }
  }, [maxDuration, stopStream, clearTimer]);

  const stop = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    clearTimer();
  }, [clearTimer]);

  const toggle = useCallback(() => {
    if (isRecording) {
      stop();
    } else if (!isRequesting) {
      start();
    }
  }, [isRecording, isRequesting, start, stop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      clearTimer();
      stopStream();
    };
  }, [clearTimer, stopStream]);

  return { isRecording, isRequesting, elapsed, error, toggle, stop };
}
