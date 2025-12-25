import { RiCheckLine } from "@remixicon/react";
import React, { useEffect } from "react";

export interface SuccessOverlayProps {
  /** Whether to show the overlay */
  show: boolean;
  /** Success message to display */
  message?: string;
  /** Callback when animation completes (after delay) */
  onComplete?: () => void;
  /** Delay before calling onComplete (ms) */
  delay?: number;
}

/**
 * Full-screen success overlay with animation.
 * Provides clear visual feedback for successful actions.
 */
export const SuccessOverlay: React.FC<SuccessOverlayProps> = ({
  show,
  message = "Success!",
  onComplete,
  delay = 1500,
}) => {
  useEffect(() => {
    if (show && onComplete) {
      const timer = setTimeout(onComplete, delay);
      return () => clearTimeout(timer);
    }
  }, [show, onComplete, delay]);

  if (!show) return null;

  return (
    <div className="success-overlay" role="status" aria-live="polite">
      <div className="success-overlay-content">
        <div className="success-overlay-icon">
          <RiCheckLine className="w-12 h-12 text-white" />
        </div>
        <p className="success-overlay-message">{message}</p>
      </div>
    </div>
  );
};

export default SuccessOverlay;
