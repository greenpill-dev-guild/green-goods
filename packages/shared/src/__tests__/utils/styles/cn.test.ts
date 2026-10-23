import { describe, expect, it } from "vitest";
import { cn } from "../../../utils/styles/cn";

describe("cn", () => {
  it("keeps a type role beside an arbitrary text colour", () => {
    // The AdminTextField floating label: size first, colour second. tailwind-merge
    // used to read a custom size as a colour and drop it in favour of the rgb() class.
    expect(cn("type-meta", "text-[rgb(var(--m3-error))]")).toBe(
      "type-meta text-[rgb(var(--m3-error))]"
    );
  });

  it("keeps a shared-scale size beside a theme text colour", () => {
    expect(cn("text-label-md font-medium", "text-text-sub-600")).toBe(
      "text-label-md font-medium text-text-sub-600"
    );
    expect(cn("text-paragraph-sm", "text-text-strong")).toBe("text-paragraph-sm text-text-strong");
  });

  it("resolves a raw size, a shared-scale size, and a type role to the last one", () => {
    // A shared default size overridden by the caller: both classes used to survive
    // and the default won in the cascade.
    expect(cn("font-mono text-sm", "type-meta")).toBe("font-mono type-meta");
    expect(cn("text-label-sm", "text-sm")).toBe("text-sm");
    expect(cn("text-label-md", "type-label")).toBe("type-label");
    expect(cn("type-body", "type-meta-sm")).toBe("type-meta-sm");
  });

  it("keeps a type role beside a weight, leading, or colour", () => {
    expect(cn("type-label", "font-semibold", "leading-6", "text-[rgb(var(--m3-error))]")).toBe(
      "type-label font-semibold leading-6 text-[rgb(var(--m3-error))]"
    );
  });

  it("still resolves two colours to the last one", () => {
    expect(cn("text-text-sub", "text-[rgb(var(--m3-error))]")).toBe("text-[rgb(var(--m3-error))]");
  });

  it("handles conditional and falsy inputs like clsx", () => {
    expect(cn("gg-button", false, undefined, { "is-active": true, hidden: false })).toBe(
      "gg-button is-active"
    );
  });
});
