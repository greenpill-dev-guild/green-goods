/** @vitest-environment jsdom */

/**
 * useScrollToTop Tests
 *
 * The installed app scrolls inside #app-scroll, so Android overscroll stretches
 * that scroller and never the document behind the fixed app bar. Editorial
 * pages keep scrolling the document.
 */

import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { scrollAppToTop, useScrollToTop } from "../../../hooks/app/useScrollToTop";

describe("hooks/app/useScrollToTop", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.getElementById("app-scroll")?.remove();
  });

  it("resets the app scroller instead of the document inside the installed app", () => {
    const windowScroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const appScroll = document.createElement("div");
    appScroll.id = "app-scroll";
    const appScrollTo = vi.fn();
    appScroll.scrollTo = appScrollTo;
    document.body.append(appScroll);

    renderHook(() => useScrollToTop());

    expect(appScrollTo).toHaveBeenCalledWith({ top: 0, behavior: "auto" });
    expect(windowScroll).not.toHaveBeenCalled();
  });

  it("scrolls the document when no app scroller is mounted", () => {
    const windowScroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});

    scrollAppToTop("instant");

    expect(windowScroll).toHaveBeenCalledWith({ top: 0, behavior: "instant" });
  });
});
