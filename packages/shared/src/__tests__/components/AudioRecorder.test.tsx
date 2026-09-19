/**
 * AudioRecorder inside a form: its controls are the shared Button, which has no
 * default `type`, so each one declares `type="button"`. Otherwise pressing
 * Record, Stop, Use, or Discard would submit the parent form (the admin review
 * form renders the recorder inside one).
 *
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { FormEvent } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AudioRecorder } from "../../components/Audio/AudioRecorder";

class FakeMediaRecorder {
  static isTypeSupported() {
    return true;
  }

  state: "inactive" | "recording" = "inactive";
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;

  start() {
    this.state = "recording";
  }

  stop() {
    this.state = "inactive";
    this.onstop?.();
  }
}

beforeEach(() => {
  vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [] }) },
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "mediaDevices");
});

describe("AudioRecorder inside a form", () => {
  it("records, stops, and confirms without submitting the parent form", async () => {
    const onSubmit = vi.fn((event: FormEvent) => event.preventDefault());
    const onRecordingComplete = vi.fn();
    render(
      <form onSubmit={onSubmit}>
        <AudioRecorder onRecordingComplete={onRecordingComplete} />
      </form>
    );

    const record = screen.getByRole("button", { name: "Start recording audio note" });
    expect(record).toHaveAttribute("type", "button");
    fireEvent.click(record);

    const stop = await screen.findByRole("button", { name: "Stop recording" });
    expect(stop).toHaveAttribute("type", "button");
    fireEvent.click(stop);

    const use = await screen.findByRole("button", { name: "Confirm recording" });
    expect(use).toHaveAttribute("type", "button");
    expect(screen.getByRole("button", { name: "Discard recording" })).toHaveAttribute(
      "type",
      "button"
    );
    fireEvent.click(use);

    expect(onRecordingComplete).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("discards a preview without submitting the parent form", async () => {
    const onSubmit = vi.fn((event: FormEvent) => event.preventDefault());
    const onRecordingComplete = vi.fn();
    render(
      <form onSubmit={onSubmit}>
        <AudioRecorder onRecordingComplete={onRecordingComplete} />
      </form>
    );

    fireEvent.click(screen.getByRole("button", { name: "Start recording audio note" }));
    fireEvent.click(await screen.findByRole("button", { name: "Stop recording" }));
    fireEvent.click(await screen.findByRole("button", { name: "Discard recording" }));

    expect(
      await screen.findByRole("button", { name: "Start recording audio note" })
    ).toBeInTheDocument();
    expect(onRecordingComplete).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
