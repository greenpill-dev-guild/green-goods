import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

/**
 * Hook to ensure proper re-rendering when browser back/forward buttons are used
 * Forces components to update when navigation occurs outside of React Router's normal flow
 */
export function useBrowserNavigation() {
  const location = useLocation();
  const [forceUpdate, setForceUpdate] = useState(0);

  useEffect(() => {
    const handlePopState = () => {
      // Force a re-render when browser back/forward buttons are used
      setForceUpdate((prev) => prev + 1);
    };

    // Listen for browser navigation events
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  // Also update when location changes through React Router
  useEffect(() => {
    setForceUpdate((prev) => prev + 1);
  }, [location.pathname, location.search, location.hash]);

  return forceUpdate;
}
