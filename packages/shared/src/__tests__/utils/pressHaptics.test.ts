/**
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installPressHaptics, resetHapticsState } from "../../utils/app/haptics";

describe("installPressHaptics", () => {
  const vibrate = vi.fn();
  let uninstall: () => void;

  beforeEach(() => {
    localStorage.clear();
    resetHapticsState();
    vibrate.mockClear();
    Object.defineProperty(navigator, "vibrate", { value: vibrate, configurable: true });
    document.body.innerHTML = `
      <button class="gg-button" id="button"><span id="label">Save</span></button>
      <button class="gg-button" id="busy" aria-disabled="true">Saving</button>
      <button data-pressable="tab" id="tab">Work</button>
      <button data-pressable="card" id="card">Open garden</button>
      <button data-pressable="card" aria-pressed="false" id="choice">Newest first</button>
    `;
    uninstall = installPressHaptics();
  });

  afterEach(() => uninstall());

  it("answers a button with the light tap and a tab with the selection tap", () => {
    document.getElementById("label")?.click();
    document.getElementById("tab")?.click();

    expect(vibrate.mock.calls).toEqual([[10], [5]]);
  });

  it("answers a card that toggles a choice with the selection tap", () => {
    document.getElementById("choice")?.click();

    expect(vibrate.mock.calls).toEqual([[5]]);
  });

  it("stays quiet for a card that only navigates and for a control that is not available", () => {
    document.getElementById("card")?.click();
    document.getElementById("busy")?.click();

    expect(vibrate).not.toHaveBeenCalled();
  });

  it("stops answering once it is removed", () => {
    uninstall();
    document.getElementById("button")?.click();

    expect(vibrate).not.toHaveBeenCalled();
  });
});
