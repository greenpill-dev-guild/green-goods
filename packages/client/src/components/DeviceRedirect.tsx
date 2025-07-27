import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { RiSmartphoneLine, RiComputerLine, RiDownloadLine, RiCloseLine } from "@remixicon/react";

interface DeviceInfo {
  isMobile: boolean;
  isDesktop: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isInApp: boolean;
  userAgent: string;
}

const getDeviceInfo = (): DeviceInfo => {
  const userAgent = navigator.userAgent.toLowerCase();
  const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
  const isDesktop = !isMobile;
  const isIOS = /iphone|ipad|ipod/i.test(userAgent);
  const isAndroid = /android/i.test(userAgent);
  
  // Check if user is in an app (basic detection)
  const isInApp = /greengoods|wv/i.test(userAgent) || 
                 (window.navigator as any).standalone === true || // iOS standalone
                 window.matchMedia('(display-mode: standalone)').matches; // PWA

  return {
    isMobile,
    isDesktop,
    isIOS,
    isAndroid,
    isInApp,
    userAgent
  };
};

const AppInstallBanner = ({ 
  deviceInfo, 
  onClose 
}: { 
  deviceInfo: DeviceInfo;
  onClose: () => void;
}) => {
  const handleInstallClick = () => {
    if (deviceInfo.isIOS) {
      // Redirect to App Store
      window.open('https://apps.apple.com/app/greengoods', '_blank');
    } else if (deviceInfo.isAndroid) {
      // Redirect to Google Play Store
      window.open('https://play.google.com/store/apps/details?id=com.greengoods.app', '_blank');
    } else {
      // Desktop - suggest mobile download
      window.open('https://greengoods.app/download', '_blank');
    }
  };

  const handleTryMobileLink = () => {
    // Try to open the mobile app with a custom scheme
    const currentPath = window.location.pathname;
    const appScheme = `greengoods://app${currentPath}`;
    
    // Try to open the app
    window.location.href = appScheme;
    
    // If app doesn't open, user will stay on the page
    setTimeout(() => {
      // After a short delay, if still on page, show install prompt
      console.log('App not detected, staying on web version');
    }, 2000);
  };

  return (
    <div className="fixed top-0 left-0 right-0 bg-green-600 text-white p-4 z-50 shadow-lg">
      <div className="flex items-center justify-between max-w-sm mx-auto">
        <div className="flex items-center space-x-3 flex-1">
          {deviceInfo.isMobile ? (
            <RiSmartphoneLine className="w-6 h-6 flex-shrink-0" />
          ) : (
            <RiComputerLine className="w-6 h-6 flex-shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              {deviceInfo.isMobile 
                ? "Get the Green Goods app" 
                : "View on mobile for the best experience"
              }
            </p>
            <p className="text-xs text-green-100">
              {deviceInfo.isMobile 
                ? "Better performance and offline access" 
                : "This content is optimized for mobile"
              }
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2 ml-3">
          {deviceInfo.isMobile && (
            <button
              onClick={handleTryMobileLink}
              className="bg-white text-green-600 px-3 py-1 rounded text-xs font-medium hover:bg-green-50 transition-colors"
              aria-label="Try to open in app"
            >
              Open App
            </button>
          )}
          
          <button
            onClick={handleInstallClick}
            className="bg-green-700 text-white px-3 py-1 rounded text-xs font-medium hover:bg-green-800 transition-colors flex items-center space-x-1"
            aria-label={deviceInfo.isMobile ? "Install app" : "Get mobile app"}
          >
            <RiDownloadLine className="w-3 h-3" />
            <span>{deviceInfo.isMobile ? "Install" : "Get App"}</span>
          </button>
          
          <button
            onClick={onClose}
            className="text-green-100 hover:text-white p-1"
            aria-label="Close banner"
          >
            <RiCloseLine className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export const DeviceRedirect: React.FC = () => {
  const location = useLocation();
  const [deviceInfo] = useState<DeviceInfo>(getDeviceInfo);
  const [showBanner, setShowBanner] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    // Check if this is a shared link
    const isSharedLink = location.search.includes('shared=true') || 
                        location.pathname.startsWith('/share/');

    // Check if banner was dismissed in this session
    const dismissed = sessionStorage.getItem('app-banner-dismissed') === 'true';
    
    if (dismissed) {
      setBannerDismissed(true);
      return;
    }

    // Show banner logic
    const shouldShowBanner = isSharedLink && !deviceInfo.isInApp && !bannerDismissed;

    if (shouldShowBanner) {
      // Small delay to allow page to load
      const timer = setTimeout(() => {
        setShowBanner(true);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [location, deviceInfo, bannerDismissed]);

  const handleCloseBanner = () => {
    setShowBanner(false);
    setBannerDismissed(true);
    sessionStorage.setItem('app-banner-dismissed', 'true');
  };

  // Auto-redirect for desktop users on shared links
  useEffect(() => {
    const isSharedLink = location.search.includes('shared=true');
    
    if (isSharedLink && deviceInfo.isDesktop && !deviceInfo.isInApp) {
      // For desktop users viewing shared links, suggest mobile experience
      // But don't force redirect, let them view the content
      console.log('Desktop user viewing shared content - suggesting mobile app');
    }
  }, [location, deviceInfo]);

  // Handle deep linking attempts
  useEffect(() => {
    const handleAppScheme = () => {
      if (deviceInfo.isMobile && !deviceInfo.isInApp) {
        const currentPath = window.location.pathname;
        const search = window.location.search;
        
        // Create app deep link
        const appScheme = `greengoods://app${currentPath}${search}`;
        
        // Store the attempt to track if successful
        const attemptTime = Date.now();
        localStorage.setItem('deeplink-attempt', attemptTime.toString());
        
        // Try to open the app
        window.location.href = appScheme;
        
        // Check if the app opened by seeing if the page becomes hidden
        const handleVisibilityChange = () => {
          if (document.hidden) {
            // Page became hidden, likely app opened successfully
            localStorage.setItem('deeplink-success', 'true');
          }
        };
        
        document.addEventListener('visibilitychange', handleVisibilityChange);
        
        // Cleanup after attempt
        setTimeout(() => {
          document.removeEventListener('visibilitychange', handleVisibilityChange);
          
          // If still on page after 3 seconds, app probably didn't open
          const success = localStorage.getItem('deeplink-success');
          if (!success) {
            console.log('Deep link failed, app not installed');
          }
          
          localStorage.removeItem('deeplink-attempt');
          localStorage.removeItem('deeplink-success');
        }, 3000);
      }
    };

    // Only attempt deep linking on shared links and if not already in app
    const isSharedLink = location.search.includes('shared=true');
    if (isSharedLink && deviceInfo.isMobile && !deviceInfo.isInApp) {
      // Small delay to allow page to load first
      const timer = setTimeout(handleAppScheme, 500);
      return () => clearTimeout(timer);
    }
  }, [location, deviceInfo]);

  return (
    <>
      {showBanner && (
        <AppInstallBanner 
          deviceInfo={deviceInfo} 
          onClose={handleCloseBanner}
        />
      )}
      
      {/* Add padding to body when banner is shown */}
      {showBanner && (
        <style>
          {`
            body {
              padding-top: 80px;
            }
          `}
        </style>
      )}
    </>
  );
};

// Hook for sharing functionality
export const useShareLink = () => {
  const [deviceInfo] = useState<DeviceInfo>(getDeviceInfo);

  const shareCurrentPage = async (title?: string, text?: string) => {
    const url = window.location.href;
    const shareData = {
      title: title || document.title,
      text: text || 'Check out this garden on Green Goods',
      url: url
    };

    try {
      if (navigator.share && deviceInfo.isMobile) {
        // Use native share API on mobile
        await navigator.share(shareData);
        return true;
      } else {
        // Fallback to clipboard copy
        await navigator.clipboard.writeText(url);
        
        // Show a toast or notification that link was copied
        console.log('Link copied to clipboard');
        return true;
      }
    } catch (error) {
      console.error('Error sharing:', error);
      return false;
    }
  };

  const generateShareableLink = (path: string, addSharedParam = true) => {
    const baseUrl = window.location.origin;
    const sharePath = path.startsWith('/share/') ? path : `/share${path}`;
    const url = `${baseUrl}${sharePath}`;
    
    if (addSharedParam) {
      const separator = sharePath.includes('?') ? '&' : '?';
      return `${url}${separator}shared=true`;
    }
    
    return url;
  };

  return {
    deviceInfo,
    shareCurrentPage,
    generateShareableLink,
    isShareSupported: !!navigator.share && deviceInfo.isMobile
  };
};

export default DeviceRedirect;