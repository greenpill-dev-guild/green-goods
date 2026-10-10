import { describe, expect, it } from "vitest";
import {
  selectNavigationBarModel,
  type NavigationBarState,
  type NavigationVisibilitySlot,
} from "../../components/Canvas/NavigationBar.model";

interface TestSlot extends NavigationVisibilitySlot {
  id: string;
}

const slots: TestSlot[] = [
  { id: "hub", visible: true },
  { id: "garden", visible: true },
  { id: "profile", visible: true, mobileOnly: true },
  { id: "desktop-tools", visible: true, desktopOnly: true },
  { id: "hidden", visible: false },
];

const baseState: NavigationBarState = {
  isDesktop: true,
  isLargeDesktop: false,
  hideMobileChrome: false,
  hasFab: false,
};

describe("selectNavigationBarModel", () => {
  it("filters desktop and mobile slots without losing their declared order", () => {
    const model = selectNavigationBarModel(slots, baseState);

    expect(model.desktopSlots.map(({ id }) => id)).toEqual(["hub", "garden", "desktop-tools"]);
    expect(model.mobileSlots.map(({ id }) => id)).toEqual(["hub", "garden", "profile"]);
  });

  it.each([
    {
      name: "desktop navigation",
      state: { ...baseState, isDesktop: true },
      expected: { showDesktopNav: true, showMobileNav: false, showMobileFab: false },
    },
    {
      name: "mobile navigation",
      state: { ...baseState, isDesktop: false },
      expected: { showDesktopNav: false, showMobileNav: true, showMobileFab: false },
    },
    {
      name: "mobile navigation hidden by transient chrome",
      state: { ...baseState, isDesktop: false, hideMobileChrome: true },
      expected: { showDesktopNav: false, showMobileNav: false, showMobileFab: false },
    },
    {
      name: "tablet or mobile FAB",
      state: { ...baseState, isDesktop: false, hasFab: true },
      expected: { showDesktopNav: false, showMobileNav: true, showMobileFab: true },
    },
    {
      name: "large desktop hides the floating FAB",
      state: { ...baseState, isLargeDesktop: true, hasFab: true },
      expected: { showDesktopNav: true, showMobileNav: false, showMobileFab: false },
    },
  ])("selects $name state", ({ state, expected }) => {
    expect(selectNavigationBarModel(slots, state)).toMatchObject(expected);
  });

  it("suppresses a one-item shell unless a FAB keeps it actionable", () => {
    const oneSlot = [{ id: "hub", visible: true }];

    expect(selectNavigationBarModel(oneSlot, baseState).shouldRender).toBe(false);
    expect(selectNavigationBarModel(oneSlot, { ...baseState, hasFab: true }).shouldRender).toBe(
      true
    );
  });
});
