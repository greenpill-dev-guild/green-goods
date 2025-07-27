import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

interface PersistentLinkProps {
  to: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  replace?: boolean;
  state?: any;
  preventRedirect?: boolean;
}

// Hook to manage navigation state persistence
export const useNavigationState = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Store the current route in session storage for persistence
    sessionStorage.setItem('lastRoute', location.pathname + location.search);
    
    // Store navigation history for back button behavior
    const history = JSON.parse(sessionStorage.getItem('navigationHistory') || '[]');
    const currentEntry = {
      path: location.pathname,
      search: location.search,
      timestamp: Date.now()
    };
    
    // Only add if it's different from the last entry
    if (history.length === 0 || history[history.length - 1].path !== currentEntry.path) {
      history.push(currentEntry);
      
      // Keep only last 10 entries
      if (history.length > 10) {
        history.shift();
      }
      
      sessionStorage.setItem('navigationHistory', JSON.stringify(history));
    }
  }, [location]);

  const restoreLastRoute = () => {
    const lastRoute = sessionStorage.getItem('lastRoute');
    if (lastRoute && lastRoute !== location.pathname + location.search) {
      navigate(lastRoute, { replace: true });
      return true;
    }
    return false;
  };

  const goBackInHistory = () => {
    const history = JSON.parse(sessionStorage.getItem('navigationHistory') || '[]');
    if (history.length > 1) {
      // Remove current entry and go to previous
      history.pop();
      const previousEntry = history[history.length - 1];
      sessionStorage.setItem('navigationHistory', JSON.stringify(history));
      navigate(previousEntry.path + previousEntry.search, { replace: true });
      return true;
    }
    return false;
  };

  return {
    restoreLastRoute,
    goBackInHistory,
    currentPath: location.pathname,
    hasHistory: JSON.parse(sessionStorage.getItem('navigationHistory') || '[]').length > 1
  };
};

// Component that preserves navigation state
export const PersistentLink: React.FC<PersistentLinkProps> = ({
  to,
  children,
  className = "",
  onClick,
  replace = false,
  state,
  preventRedirect = false
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isNavigating, setIsNavigating] = useState(false);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (onClick) {
      onClick();
    }

    // Prevent default redirect behavior if specified
    if (preventRedirect) {
      e.preventDefault();
      setIsNavigating(true);
      
      // Store intention to navigate
      sessionStorage.setItem('pendingNavigation', JSON.stringify({
        to,
        timestamp: Date.now(),
        from: location.pathname
      }));

      // Navigate with state preservation
      setTimeout(() => {
        navigate(to, { replace, state });
        setIsNavigating(false);
      }, 100);
    }
  };

  // Check if this link is the current route
  const isActive = location.pathname === to || 
                  (to !== '/' && location.pathname.startsWith(to));

  return (
    <Link
      to={to}
      className={`${className} ${isActive ? 'active' : ''} ${isNavigating ? 'navigating' : ''}`}
      onClick={handleClick}
      replace={replace}
      state={state}
      aria-current={isActive ? 'page' : undefined}
    >
      {children}
    </Link>
  );
};

// Hook for handling deep link persistence
export const useDeepLinkPersistence = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user arrived via direct link or shared link
    const isDirectAccess = !document.referrer || 
                          document.referrer.indexOf(window.location.hostname) === -1;
    
    const isSharedLink = location.search.includes('shared=true') ||
                        location.pathname.startsWith('/share/');

    if (isDirectAccess || isSharedLink) {
      // Mark this as a direct/shared access
      sessionStorage.setItem('directAccess', JSON.stringify({
        path: location.pathname,
        search: location.search,
        timestamp: Date.now(),
        isShared: isSharedLink
      }));

      // Don't redirect away from the intended destination
      if (isSharedLink) {
        // For shared links, ensure we stay on the share route
        sessionStorage.setItem('preserveRoute', 'true');
      }
    }

    // Check for pending navigation from previous session
    const pendingNav = sessionStorage.getItem('pendingNavigation');
    if (pendingNav) {
      try {
        const navData = JSON.parse(pendingNav);
        const timeDiff = Date.now() - navData.timestamp;
        
        // If navigation was recent (within 5 seconds), continue it
        if (timeDiff < 5000 && navData.to !== location.pathname) {
          navigate(navData.to, { replace: true });
        }
        
        sessionStorage.removeItem('pendingNavigation');
      } catch (error) {
        console.error('Error parsing pending navigation:', error);
        sessionStorage.removeItem('pendingNavigation');
      }
    }
  }, [location, navigate]);

  const preserveCurrentRoute = () => {
    sessionStorage.setItem('preserveRoute', 'true');
    sessionStorage.setItem('preservedRoute', location.pathname + location.search);
  };

  const shouldPreserveRoute = () => {
    return sessionStorage.getItem('preserveRoute') === 'true';
  };

  const clearRoutePreservation = () => {
    sessionStorage.removeItem('preserveRoute');
    sessionStorage.removeItem('preservedRoute');
  };

  return {
    preserveCurrentRoute,
    shouldPreserveRoute,
    clearRoutePreservation,
    isDirectAccess: !!sessionStorage.getItem('directAccess')
  };
};

export default PersistentLink;