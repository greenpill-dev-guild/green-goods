import { useCallback, useRef, useState } from "react";

export enum GardenTab {
  Work = "work",
  Insights = "insights",
  Gardeners = "gardeners",
}

/** Manages garden view tabs while preserving scroll position per section. */
export const useGardenTabs = () => {
  const [activeTab, setActiveTab] = useState<GardenTab>(GardenTab.Work);
  const [scrollPositions, setScrollPositions] = useState({
    [GardenTab.Work]: 0,
    [GardenTab.Insights]: 0,
    [GardenTab.Gardeners]: 0,
  });

  // Individual refs for each tab's scrollable container
  const workRef = useRef<HTMLUListElement>(null);
  const reportsRef = useRef<HTMLUListElement>(null);
  const gardenersRef = useRef<HTMLUListElement>(null);

  // Create tabRefs object using individual refs
  const tabRefs = useRef({
    [GardenTab.Work]: workRef,
    [GardenTab.Insights]: reportsRef,
    [GardenTab.Gardeners]: gardenersRef,
  }).current;

  // Save scroll position on scroll event for the active tab
  const handleScroll = useCallback(
    (tab: GardenTab) => (event: React.UIEvent<HTMLUListElement, UIEvent>) => {
      setScrollPositions((prev) => ({
        ...prev,
        [tab]: event.currentTarget.scrollTop,
      }));
    },
    []
  );

  // Restore scroll position when switching tabs
  const restoreScrollPosition = useCallback(() => {
    const currentRef = tabRefs[activeTab].current;
    if (currentRef) {
      currentRef.scrollTop = scrollPositions[activeTab];
    }
  }, [activeTab, scrollPositions, tabRefs]);

  return {
    activeTab,
    setActiveTab,
    scrollPositions,
    tabRefs,
    handleScroll,
    restoreScrollPosition,
  };
};
