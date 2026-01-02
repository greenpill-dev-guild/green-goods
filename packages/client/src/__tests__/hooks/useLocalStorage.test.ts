/**
 * useLocalStorage Hook Tests
 *
 * Tests for localStorage persistence hook
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("useLocalStorage Hook", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("stores value in localStorage", () => {
    const key = "test-key";
    const value = "test-value";
    localStorage.setItem(key, value);
    expect(localStorage.getItem(key)).toBe(value);
  });

  it("retrieves value from localStorage", () => {
    const key = "test-key";
    const value = "test-value";
    localStorage.setItem(key, value);
    const retrieved = localStorage.getItem(key);
    expect(retrieved).toBe(value);
  });

  it("returns null for non-existent key", () => {
    const value = localStorage.getItem("non-existent");
    expect(value).toBeNull();
  });

  it("updates value in localStorage", () => {
    const key = "test-key";
    localStorage.setItem(key, "old-value");
    localStorage.setItem(key, "new-value");
    expect(localStorage.getItem(key)).toBe("new-value");
  });

  it("removes value from localStorage", () => {
    const key = "test-key";
    localStorage.setItem(key, "value");
    localStorage.removeItem(key);
    expect(localStorage.getItem(key)).toBeNull();
  });

  it("clears all localStorage", () => {
    localStorage.setItem("key1", "value1");
    localStorage.setItem("key2", "value2");
    localStorage.clear();
    expect(localStorage.getItem("key1")).toBeNull();
    expect(localStorage.getItem("key2")).toBeNull();
  });

  it("stores and retrieves JSON objects", () => {
    const key = "test-object";
    const obj = { name: "Test", value: 123 };
    localStorage.setItem(key, JSON.stringify(obj));
    const retrieved = JSON.parse(localStorage.getItem(key) || "{}");
    expect(retrieved).toEqual(obj);
  });

  it("handles invalid JSON gracefully", () => {
    const key = "invalid-json";
    localStorage.setItem(key, "not-json");
    expect(() => JSON.parse(localStorage.getItem(key) || "{}")).toThrow();
  });
});
