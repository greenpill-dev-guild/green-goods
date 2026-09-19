import { describe, expect, it } from "vitest";
import { cn } from "../../../utils/styles/cn";

describe("cn", () => {
  it("keeps a custom text-size alias beside an arbitrary text colour", () => {
    // The AdminTextField floating label: size first, colour second. tailwind-merge
    // used to read the alias as a colour and drop it in favour of the rgb() class.
    expect(cn("text-body-sm", "text-[rgb(var(--m3-error))]")).toBe(
      "text-body-sm text-[rgb(var(--m3-error))]"
    );
  });

  it("keeps a custom text-size alias beside a theme text colour", () => {
    expect(cn("text-label-lg font-medium", "text-text-sub-600")).toBe(
      "text-label-lg font-medium text-text-sub-600"
    );
    expect(cn("text-title-md", "text-text-strong")).toBe("text-title-md text-text-strong");
  });

  it("still resolves two sizes to the last one", () => {
    expect(cn("text-body-md", "text-body-lg")).toBe("text-body-lg");
    expect(cn("text-label-sm", "text-sm")).toBe("text-sm");
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
