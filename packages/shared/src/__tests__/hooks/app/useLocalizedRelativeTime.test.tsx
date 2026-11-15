/**
 * An age in the reader's language. The short form a card's detail line takes shortens seconds to
 * weeks; a month and a year keep their full word (PRD-1492): a new steward read Spanish's
 * "hace 1 m", a month, as "hace 1 min".
 */

import { renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useLocalizedRelativeTime } from "../../../hooks/app/useLocalizedRelativeTime";

const NOW = Date.UTC(2026, 10, 13, 12);
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function ageIn(locale: string, style: "long" | "short", age: number): string {
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(IntlProvider, { locale, messages: {} }, children);
  const { result } = renderHook(() => useLocalizedRelativeTime({ style }), { wrapper });
  return result.current(NOW - age);
}

describe("useLocalizedRelativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ["es", MINUTE, "hace 1 min"],
    ["es", 2 * HOUR, "hace 2 h"],
    ["es", 31 * DAY, "hace 1 mes"],
    ["es", 400 * DAY, "hace 1 año"],
    ["en", 31 * DAY, "1 month ago"],
    ["en", 800 * DAY, "2 years ago"],
    ["pt", 2 * HOUR, "há 2 h"],
    ["pt", 62 * DAY, "há 2 meses"],
  ])("writes a card's age in %s, %d ms old, as %s", (locale, age, expected) => {
    expect(ageIn(locale, "short", age)).toBe(expected);
  });

  it.each(["en", "es", "pt"])("writes months and years in %s as the long form does", (locale) => {
    for (const age of [31 * DAY, 800 * DAY]) {
      expect(ageIn(locale, "short", age)).toBe(ageIn(locale, "long", age));
    }
  });
});
