import { useCallback } from "react";
import { useAudioRecorder } from "./useAudioRecorder";

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

/** Saves recordings immediately when stopped, including when the consumer unmounts. */
export function useAudioRecording(options: UseAudioRecordingOptions): UseAudioRecordingReturn {
  const { isRecording, isRequesting, elapsed, error, start, stop } = useAudioRecorder({
    ...options,
    completeOnUnmount: true,
  });
  const toggle = useCallback(() => {
    if (isRecording) stop();
    else if (!isRequesting) void start();
  }, [isRecording, isRequesting, start, stop]);

  return { isRecording, isRequesting, elapsed: isRecording ? elapsed : 0, error, toggle, stop };
}
