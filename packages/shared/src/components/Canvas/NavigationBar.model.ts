export interface NavigationVisibilitySlot {
  visible: boolean;
  mobileOnly?: boolean;
  desktopOnly?: boolean;
}

export interface NavigationBarState {
  isDesktop: boolean;
  isLargeDesktop: boolean;
  hideMobileChrome: boolean;
  hasFab: boolean;
}

export function selectNavigationBarModel<T extends NavigationVisibilitySlot>(
  slots: T[],
  state: NavigationBarState
) {
  const visibleSlots = slots.filter((slot) => slot.visible);
  const desktopSlots = visibleSlots.filter((slot) => !slot.mobileOnly);
  const mobileSlots = visibleSlots.filter((slot) => !slot.desktopOnly);
  const shouldRender = state.hasFab || desktopSlots.length > 1 || mobileSlots.length > 1;

  return {
    visibleSlots,
    desktopSlots,
    mobileSlots,
    shouldRender,
    showMobileFab: state.hasFab && !state.isLargeDesktop && !state.hideMobileChrome,
    showDesktopNav: state.isDesktop && desktopSlots.length > 1,
    showMobileNav: !state.isDesktop && mobileSlots.length > 1 && !state.hideMobileChrome,
  };
}
