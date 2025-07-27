import { useState } from "react";
import { RiShareLine, RiLinkM, RiCheckLine } from "@remixicon/react";
import { useShareLink } from "@/components/DeviceRedirect";
import { useCurrentMeta } from "@/components/SocialPreview";
import { Button } from "./Button";

interface ShareButtonProps {
  type: "garden" | "work";
  title?: string;
  description?: string;
  className?: string;
  variant?: "primary" | "neutral";
  size?: "small" | "medium";
  showLabel?: boolean;
}

export const ShareButton: React.FC<ShareButtonProps> = ({
  type,
  title,
  description,
  className = "",
  variant = "neutral",
  size = "medium",
  showLabel = true
}) => {
  const [isShared, setIsShared] = useState(false);
  const { shareCurrentPage, isShareSupported } = useShareLink();
  const { generateMetaForSharing, garden } = useCurrentMeta();

  const handleShare = async () => {
    try {
      // Get meta data for sharing
      const metaData = generateMetaForSharing(type);
      
      // Try to share using native API or copy to clipboard
      const success = await shareCurrentPage(
        title || metaData.title,
        description || metaData.description
      );

      if (success) {
        setIsShared(true);
        setTimeout(() => setIsShared(false), 2000);
      }
    } catch (error) {
      console.error("Failed to share:", error);
    }
  };

  const getButtonText = () => {
    if (isShared) return "Shared!";
    if (!showLabel) return "";
    return isShareSupported ? "Share" : "Copy Link";
  };

  const getIcon = () => {
    if (isShared) return <RiCheckLine className="w-4 h-4" />;
    if (isShareSupported) return <RiShareLine className="w-4 h-4" />;
    return <RiLinkM className="w-4 h-4" />;
  };

  const getAriaLabel = () => {
    if (type === "garden") return `Share ${garden?.name || "garden"}`;
    if (type === "work") return `Share work from ${garden?.name || "garden"}`;
    return "Share this content";
  };

  return (
    <Button
      onClick={handleShare}
      variant={isShared ? "primary" : variant}
      size={size}
      className={`transition-all duration-200 ${isShared ? "bg-green-600" : ""} ${className}`}
      leadingIcon={getIcon()}
      label={getButtonText()}
      aria-label={getAriaLabel()}
      disabled={isShared}
    />
  );
};

// Quick share hook for programmatic sharing
export const useQuickShare = () => {
  const { shareCurrentPage, generateShareableLink } = useShareLink();
  const { generateMetaForSharing } = useCurrentMeta();

  const quickShare = async (type: "garden" | "work", options?: {
    title?: string;
    description?: string;
    customPath?: string;
  }) => {
    try {
      const metaData = generateMetaForSharing(type);
      
      if (options?.customPath) {
        const shareableLink = generateShareableLink(options.customPath);
        // Update URL temporarily for sharing
        const originalUrl = window.location.href;
        window.history.pushState({}, "", shareableLink);
        
        const success = await shareCurrentPage(
          options.title || metaData.title,
          options.description || metaData.description
        );
        
        // Restore original URL
        window.history.pushState({}, "", originalUrl);
        return success;
      } else {
        return await shareCurrentPage(
          options?.title || metaData.title,
          options?.description || metaData.description
        );
      }
    } catch (error) {
      console.error("Quick share failed:", error);
      return false;
    }
  };

  return { quickShare };
};

export default ShareButton;