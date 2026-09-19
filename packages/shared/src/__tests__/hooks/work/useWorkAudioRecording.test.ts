/** @vitest-environment jsdom */
import { renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

const recording = vi.hoisted(() => ({
  complete: undefined as ((file: File) => void) | undefined,
  toastError: vi.fn(),
}));
vi.mock("../../../hooks/utils/useAudioRecording", () => ({
  useAudioRecording: ({ onRecordingComplete }: { onRecordingComplete: (file: File) => void }) => {
    recording.complete = onRecordingComplete;
    return { isRecording: false };
  },
}));
vi.mock("../../../components/Toast/toast.service", () => ({
  toastService: { error: recording.toastError },
}));
vi.mock("../../../modules/app/posthog", () => ({ track: vi.fn() }));

import { useWorkAudioRecording } from "../../../hooks/work/useWorkAudioRecording";
import { useWorkFlowStore } from "../../../stores/useWorkFlowStore";

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(IntlProvider, { locale: "en", messages: {} }, children);

beforeEach(() => {
  recording.toastError.mockClear();
  useWorkFlowStore.getState().reset();
});

describe("recording a voice note for work", () => {
  it("keeps the note while a HEIC photo waits to convert", () => {
    useWorkFlowStore.setState({
      images: [new File(["heic"], "garden.heic", { type: "image/heic" })],
    });
    renderHook(() => useWorkAudioRecording(), { wrapper });

    recording.complete?.(new File(["voice"], "note.webm", { type: "audio/webm" }));

    expect(recording.toastError).not.toHaveBeenCalled();
    expect(useWorkFlowStore.getState().audioNotes.map((file) => file.name)).toEqual(["note.webm"]);
  });
});
