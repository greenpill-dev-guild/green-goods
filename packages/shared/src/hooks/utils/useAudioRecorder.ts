import { useCallback, useEffect, useRef, useState } from "react";

export const DEFAULT_AUDIO_RECORDING_MAX_DURATION = 260; // 4:20 in seconds

interface AudioRecorderOptions {
  maxDuration?: number;
  onRecordingComplete: (file: File) => void;
  onError?: (error: string) => void;
  monitorAmplitude?: boolean;
  /** The immediate-save consumer also saves an active recording when it unmounts. */
  completeOnUnmount?: boolean;
}

/** Owns microphone capture and cleanup; consumers own saving or previewing the file. */
export function useAudioRecorder({
  maxDuration = DEFAULT_AUDIO_RECORDING_MAX_DURATION,
  onRecordingComplete,
  onError,
  monitorAmplitude = false,
  completeOnUnmount = false,
}: AudioRecorderOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [amplitude, setAmplitude] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationRef = useRef<number | null>(null);
  const requestingRef = useRef(false);
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);
  const callbacksRef = useRef({ onRecordingComplete, onError, completeOnUnmount });

  useEffect(() => {
    callbacksRef.current = { onRecordingComplete, onError, completeOnUnmount };
  }, [onRecordingComplete, onError, completeOnUnmount]);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const releaseCapture = useCallback(() => {
    clearTimer();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    void audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
    if (mountedRef.current) setAmplitude(0);
  }, [clearTimer]);

  const startAmplitudeMonitor = useCallback((stream: MediaStream) => {
    try {
      const context = new AudioContext();
      audioContextRef.current = context;
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const average = data.reduce((sum, value) => sum + value, 0) / data.length;
        setAmplitude(Math.min(average / 128, 1));
        animationRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // Recording still works when the amplitude indicator is unavailable.
    }
  }, []);

  const stop = useCallback(() => {
    clearTimer();
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }, [clearTimer]);

  const start = useCallback(async () => {
    if (requestingRef.current || recorderRef.current || !mountedRef.current) return;
    requestingRef.current = true;
    const requestId = ++requestIdRef.current;
    setError(null);
    setIsRequesting(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mountedRef.current || requestId !== requestIdRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = () => {
        recorderRef.current = null;
        releaseCapture();
        if (mountedRef.current) setIsRecording(false);
        if (mountedRef.current || callbacksRef.current.completeOnUnmount) {
          const file = new File(chunks, `audio-note-${Date.now()}.webm`, { type: mimeType });
          callbacksRef.current.onRecordingComplete(file);
        }
      };

      recorder.start(1000);
      setIsRecording(true);
      setElapsed(0);
      if (monitorAmplitude) startAmplitudeMonitor(stream);
      let seconds = 0;
      timerRef.current = setInterval(() => {
        seconds += 1;
        setElapsed(seconds);
        if (seconds >= maxDuration) stop();
      }, 1000);
    } catch {
      if (requestId !== requestIdRef.current) return;
      recorderRef.current = null;
      releaseCapture();
      if (mountedRef.current && requestId === requestIdRef.current) {
        const message = "Microphone access denied. Please allow microphone permissions.";
        setError(message);
        callbacksRef.current.onError?.(message);
      }
    } finally {
      if (requestId === requestIdRef.current) {
        requestingRef.current = false;
        if (mountedRef.current) setIsRequesting(false);
      }
    }
  }, [maxDuration, monitorAmplitude, releaseCapture, startAmplitudeMonitor, stop]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
      requestingRef.current = false;
      stop();
      releaseCapture();
    };
  }, [releaseCapture, stop]);

  return { isRecording, isRequesting, elapsed, amplitude, error, start, stop };
}
