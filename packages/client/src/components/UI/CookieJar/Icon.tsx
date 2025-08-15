import { RiWalletLine } from "@remixicon/react";
import React, { useState } from "react";
import { useIntl } from "react-intl";
import { cn } from "@/utils/cn";
import { CookieJarDashboard } from "./Dashboard";

interface CookieJarIconProps {
  className?: string;
  jarAddress?: string;
}

export const CookieJarIcon: React.FC<CookieJarIconProps> = ({ className, jarAddress }) => {
  const intl = useIntl();
  const [showDashboard, setShowDashboard] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowDashboard(true)}
        className={cn(
          "relative p-1 rounded-lg border transition-all duration-200",
          "hover:shadow-lg hover:scale-105 active:scale-95",
          "flex items-center justify-center w-8 h-8 tap-target-lg",
          "focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-600 active:border-emerald-600",
          "bg-white border-slate-200 text-slate-500",
          className
        )}
        aria-label={intl.formatMessage({
          id: "app.cookieJar.openButton",
          defaultMessage: "Open cookie jar",
        })}
        data-testid="cookie-jar-icon"
      >
        <RiWalletLine className="w-4 h-4" />
      </button>

      {showDashboard && (
        <CookieJarDashboard jarAddress={jarAddress} onClose={() => setShowDashboard(false)} />
      )}
    </>
  );
};
