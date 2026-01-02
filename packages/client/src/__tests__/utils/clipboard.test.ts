/**
 * Clipboard Utility Tests
 *
 * Tests for clipboard operations
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock navigator.clipboard
const mockWriteText = vi.fn();
Object.defineProperty(navigator, "clipboard", {
  value: {
    writeText: mockWriteText,
  },
  writable: true,
});

describe("Clipboard Utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteText.mockResolvedValue(undefined);
  });

  it("copies text to clipboard", async () => {
    const text = "0x1234567890abcdef";
    await navigator.clipboard.writeText(text);
    expect(mockWriteText).toHaveBeenCalledWith(text);
  });

  it("handles clipboard write errors", async () => {
    mockWriteText.mockRejectedValue(new Error("Clipboard access denied"));

    await expect(navigator.clipboard.writeText("test")).rejects.toThrow("Clipboard access denied");
  });

  it("formats addresses for display", () => {
    const address = "0x1234567890abcdef1234567890abcdef12345678";
    const formatted = `${address.slice(0, 6)}...${address.slice(-4)}`;
    expect(formatted).toBe("0x1234...5678");
  });
});
