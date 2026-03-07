import { cn } from "@green-goods/shared";
import { RiCheckLine, RiCloseLine } from "@remixicon/react";
import React from "react";
import { useIntl } from "react-intl";

type WorkSuccessFooterProps = {
  effectiveStatus: "approved" | "rejected";
};

export const WorkSuccessFooter: React.FC<WorkSuccessFooterProps> = ({ effectiveStatus }) => {
  const intl = useIntl();

  return (
    <div className="fixed left-0 right-0 bottom-0 z-[200]">
      <div className="bg-bg-white-0 border-t border-stroke-soft-200 p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <div className="max-w-screen-sm mx-auto flex items-center justify-center gap-2">
          {effectiveStatus === "approved" ? (
            <RiCheckLine className="w-5 h-5 text-success-base" />
          ) : (
            <RiCloseLine className="w-5 h-5 text-error-base" />
          )}
          <span
            className={cn(
              "text-sm font-medium",
              effectiveStatus === "approved" ? "text-success-base" : "text-error-base"
            )}
          >
            {effectiveStatus === "approved"
              ? intl.formatMessage({
                  id: "app.home.workApproval.approved",
                  defaultMessage: "Work Approved",
                })
              : intl.formatMessage({
                  id: "app.home.workApproval.rejected",
                  defaultMessage: "Work Rejected",
                })}
          </span>
        </div>
      </div>
    </div>
  );
};
