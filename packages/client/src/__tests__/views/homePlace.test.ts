/**
 * Home's place under the pages it opens (QA finding 3, Codex on #1333): the scroller's offset
 * and the opener it follows, how both come back, and when the reader takes over.
 *
 * @vitest-environment happy-dom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { followHomePlace, type HomePlace, restoreHomePlace } from "../../views/Home/homePlace";

/** How far the scroller's rows let it scroll, as a browser clamps `scrollTop`. */
let reach = Number.POSITIVE_INFINITY;
const offsets = new WeakMap<Element, number>();
const scrollTopDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, "scrollTop");

beforeEach(() => {
  reach = Number.POSITIVE_INFINITY;
  Object.defineProperty(Element.prototype, "scrollTop", {
    configurable: true,
    get() {
      return offsets.get(this) ?? 0;
    },
    set(value: number) {
      offsets.set(this, Math.min(value, reach));
    },
  });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
  if (scrollTopDescriptor)
    Object.defineProperty(Element.prototype, "scrollTop", scrollTopDescriptor);
  else Reflect.deleteProperty(Element.prototype, "scrollTop");
});

/** Home's content in the app's scroller, with one row, followed from the moment it shows. */
function mountHome() {
  const scroller = document.body.appendChild(document.createElement("div"));
  scroller.id = "app-scroll";
  const content = scroller.appendChild(document.createElement("div"));
  const row = content.appendChild(document.createElement("button"));
  row.type = "button";
  row.textContent = "Open Its Page";
  const place: HomePlace = { scrollTop: 0, opener: null, away: false };
  const stopFollowing = followHomePlace(content, scroller, place);
  return { scroller, content, row, place, stopFollowing };
}

const scrollTo = (scroller: HTMLElement, offset: number) => {
  scroller.scrollTop = offset;
  scroller.dispatchEvent(new Event("scroll"));
};

/** Home opens a page: the shell resets the scroller for it, the page takes focus and scrolls. */
function leaveHome(scroller: HTMLElement, place: HomePlace) {
  place.away = true;
  (document.activeElement as HTMLElement | null)?.blur();
  scrollTo(scroller, 0);
  scrollTo(scroller, 300);
}

/** Home shows again: its restore is scheduled, the shell resets the scroller, the frame paints. */
function returnHome(content: HTMLElement, scroller: HTMLElement, place: HomePlace) {
  const stop = restoreHomePlace(content, scroller, place);
  scrollTo(scroller, 0);
  vi.advanceTimersToNextFrame();
  return stop;
}

/** Lets the rows that arrived reach the restore's observer. */
const settleRows = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("Home's place", () => {
  it("follows the offset and the last control pressed in Home, and ignores the scroller while away", () => {
    const { scroller, row, place } = mountHome();

    scrollTo(scroller, 567);
    row.click();
    expect(place).toMatchObject({ scrollTop: 567, opener: row });

    // The page's own scrolling, and the shell's reset for it, are not Home's.
    leaveHome(scroller, place);
    expect(place.scrollTop).toBe(567);
  });

  it("comes back to the offset and the opener, and keeps the opener through Forward and Back", () => {
    const { scroller, content, row, place } = mountHome();
    scrollTo(scroller, 567);
    row.click();

    leaveHome(scroller, place);
    returnHome(content, scroller, place);
    expect(scroller.scrollTop).toBe(567);
    expect(document.activeElement).toBe(row);
    expect(place.away).toBe(false);

    // Forward reopens the page with nothing pressed in Home; Back must still find the row.
    leaveHome(scroller, place);
    expect(document.activeElement).toBe(document.body);
    returnHome(content, scroller, place);
    expect(document.activeElement).toBe(row);
    expect(place.opener).toBe(row);
  });

  it("replaces the opener only on another press in Home, and lets go of one its rows replaced", () => {
    const { scroller, content, row, place } = mountHome();
    const chip = content.appendChild(document.createElement("button"));
    row.click();
    chip.click();
    expect(place.opener).toBe(chip);

    // A press in a sheet over Home lands in <body>: the chip that opened the sheet stays.
    document.body.appendChild(document.createElement("button")).click();
    expect(place.opener).toBe(chip);

    chip.remove();
    leaveHome(scroller, place);
    returnHome(content, scroller, place);
    expect(place.opener).toBeNull();
    expect(document.activeElement).toBe(document.body);
  });

  it.each([
    "pointerdown",
    "keydown",
  ])("stops restoring once the reader takes the scroller itself (%s), not only Home's content", async (interaction) => {
    const { scroller, content, row, place } = mountHome();
    scrollTo(scroller, 567);
    row.click();
    leaveHome(scroller, place);

    // Home's rows are still loading, so the saved offset cannot be reached yet.
    reach = 300;
    returnHome(content, scroller, place);
    expect(scroller.scrollTop).toBe(300);

    // A scrollbar drag or a key lands on the scroller, outside Home's content.
    scroller.dispatchEvent(new Event(interaction, { bubbles: true }));
    scrollTo(scroller, 120);

    // The late rows arrive and the offset would now fit; the reader's place stands.
    reach = Number.POSITIVE_INFINITY;
    content.appendChild(document.createElement("div"));
    await settleRows();
    expect(scroller.scrollTop).toBe(120);
  });
});
