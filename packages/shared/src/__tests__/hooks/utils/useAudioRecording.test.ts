/** @vitest-environment happy-dom */
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAudioRecording } from "../../../hooks/utils/useAudioRecording";

class FakeMediaRecorder {
  static isTypeSupported = vi.fn(() => true);
  static instances: FakeMediaRecorder[] = [];
  state = "inactive";
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  constructor(
    _stream: MediaStream,
    readonly options: MediaRecorderOptions
  ) {
    FakeMediaRecorder.instances.push(this);
  }
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    // MediaRecorder emits the final data chunk before the stop event.
    queueMicrotask(() => {
      this.ondataavailable?.({ data: new Blob(["voice"]) });
      this.onstop?.();
    });
  }
}

const stopTrack = vi.fn();
const stream = { getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream;
const getUserMedia = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  FakeMediaRecorder.instances = [];
  FakeMediaRecorder.isTypeSupported.mockReturnValue(true);
  vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
  getUserMedia.mockReset().mockResolvedValue(stream);
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "mediaDevices");
});

describe("immediate audio recording", () => {
  it.each([true, false])("saves final audio once with Opus support %s", async (opus) => {
    FakeMediaRecorder.isTypeSupported.mockReturnValue(opus);
    const complete = vi.fn();
    const { result } = renderHook(() => useAudioRecording({ onRecordingComplete: complete }));
    await act(async () => result.current.toggle());
    expect(result.current.isRecording).toBe(true);
    expect(complete).not.toHaveBeenCalled();
    await act(async () => {
      result.current.stop();
      result.current.stop();
    });
    expect(complete).toHaveBeenCalledOnce();
    const file = complete.mock.calls[0][0] as File;
    expect(file.size).toBe(5);
    expect(file.type).toBe(opus ? "audio/webm;codecs=opus" : "audio/webm");
    expect(file.name).toMatch(/^audio-note-\d+\.webm$/);
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(result.current.isRecording).toBe(false);
    expect(result.current.elapsed).toBe(0);
  });

  it("auto-stops at the duration limit and uses the latest completion callback", async () => {
    const oldComplete = vi.fn();
    const complete = vi.fn();
    const { result, rerender } = renderHook(
      ({ onRecordingComplete }) => useAudioRecording({ maxDuration: 2, onRecordingComplete }),
      { initialProps: { onRecordingComplete: oldComplete } }
    );
    await act(async () => result.current.toggle());
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    expect(result.current.elapsed).toBe(1);
    rerender({ onRecordingComplete: complete });
    await act(async () => vi.advanceTimersByTimeAsync(5000));
    expect(oldComplete).not.toHaveBeenCalled();
    expect(complete).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps one permission request pending and releases a stream arriving after unmount", async () => {
    let resolve!: (stream: MediaStream) => void;
    getUserMedia.mockReturnValue(
      new Promise<MediaStream>((done) => {
        resolve = done;
      })
    );
    const complete = vi.fn();
    const { result, unmount } = renderHook(() =>
      useAudioRecording({ onRecordingComplete: complete })
    );
    act(() => {
      result.current.toggle();
      result.current.toggle();
    });
    expect(result.current.isRequesting).toBe(true);
    expect(getUserMedia).toHaveBeenCalledOnce();
    unmount();
    await act(async () => resolve(stream));
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(FakeMediaRecorder.instances).toHaveLength(0);
    expect(complete).not.toHaveBeenCalled();
  });

  it("reports denied permission and allows a retry", async () => {
    getUserMedia.mockRejectedValueOnce(new Error("denied"));
    const onError = vi.fn();
    const { result } = renderHook(() =>
      useAudioRecording({ onRecordingComplete: vi.fn(), onError })
    );
    await act(async () => result.current.toggle());
    expect(result.current.error).toBe(
      "Microphone access denied. Please allow microphone permissions."
    );
    expect(onError).toHaveBeenCalledWith(result.current.error);
    expect(result.current.isRequesting).toBe(false);
    await act(async () => result.current.toggle());
    expect(result.current.error).toBeNull();
    expect(result.current.isRecording).toBe(true);
  });

  it("preserves immediate saving when unmount stops an active recording", async () => {
    const complete = vi.fn();
    const { result, unmount } = renderHook(() =>
      useAudioRecording({ onRecordingComplete: complete })
    );
    await act(async () => result.current.toggle());
    await act(async () => unmount());
    expect(complete).toHaveBeenCalledOnce();
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});
