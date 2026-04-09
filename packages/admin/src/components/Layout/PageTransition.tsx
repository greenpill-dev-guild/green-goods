import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useRef } from "react";

export function PageTransition() {
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);

  useEffect(() => {
    if (prevPathRef.current !== location.pathname) {
      // Use View Transitions API if available
      if (document.startViewTransition) {
        document.startViewTransition(() => {
          prevPathRef.current = location.pathname;
        });
      } else {
        prevPathRef.current = location.pathname;
      }
    }
  }, [location.pathname]);

  return (
    <div className="animate-page-slide-in motion-reduce:animate-none">
      <Outlet />
    </div>
  );
}
