/** @vitest-environment jsdom */
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useForm } from "react-hook-form";
import { useWorkLocation, type WorkFormData } from "../../../hooks/work/useWorkForm";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("work location consent", () => {
  it("rounds before entering form state and clears on opt-out", () => {
    let capture!: PositionCallback;
    const getCurrentPosition = vi.fn((callback: PositionCallback) => {
      capture = callback;
    });
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });
    const { result } = renderHook(() => {
      const form = useForm<WorkFormData>();
      return { form, location: useWorkLocation(form.control, form.setValue) };
    });
    expect(getCurrentPosition).not.toHaveBeenCalled();
    act(() => result.current.location.handleLocationToggle());
    act(() =>
      capture({
        coords: { latitude: 12.345678, longitude: -34.567891, accuracy: 1 },
      } as GeolocationPosition)
    );
    expect(result.current.form.getValues("location")).toEqual({ lat: 12.346, lng: -34.568 });
    act(() => result.current.location.handleLocationToggle());
    expect(result.current.form.getValues("location")).toBeUndefined();
    expect(getCurrentPosition).toHaveBeenCalledOnce();
  });
});
