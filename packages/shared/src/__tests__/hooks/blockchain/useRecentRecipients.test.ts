/**
 * useRecentRecipients Hook Tests
 * @vitest-environment jsdom
 */

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { Address } from "../../../types/domain";
import {
  addRecentRecipient,
  useRecentRecipients,
  useRecentRecipientsVersion,
} from "../../../hooks/blockchain/useRecentRecipients";

const addr = (n: number): Address => `0x${n.toString(16).padStart(40, "0")}` as Address;

describe("hooks/blockchain/useRecentRecipients", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts empty and reflects an added recipient", () => {
    const { result } = renderHook(() => useRecentRecipients());
    expect(result.current).toEqual([]);

    act(() => addRecentRecipient(addr(1), "for coffee"));

    expect(result.current).toHaveLength(1);
    expect(result.current[0].address.toLowerCase()).toBe(addr(1).toLowerCase());
    expect(result.current[0].note).toBe("for coffee");
  });

  it("upserts an existing address to the front without duplicating", () => {
    const { result } = renderHook(() => useRecentRecipients());
    act(() => addRecentRecipient(addr(1)));
    act(() => addRecentRecipient(addr(2)));
    act(() => addRecentRecipient(addr(1)));

    expect(result.current).toHaveLength(2);
    expect(result.current[0].address.toLowerCase()).toBe(addr(1).toLowerCase());
  });

  it("caps the list at 10 newest-first", () => {
    const { result } = renderHook(() => useRecentRecipients());
    act(() => {
      for (let i = 1; i <= 12; i++) addRecentRecipient(addr(i));
    });

    expect(result.current).toHaveLength(10);
    expect(result.current[0].address.toLowerCase()).toBe(addr(12).toLowerCase());
    expect(result.current.some((r) => r.address.toLowerCase() === addr(1).toLowerCase())).toBe(
      false
    );
  });

  it("increments the version on add", () => {
    const { result } = renderHook(() => useRecentRecipientsVersion());
    const start = result.current;
    act(() => addRecentRecipient(addr(7)));
    expect(result.current).toBe(start + 1);
  });
});
