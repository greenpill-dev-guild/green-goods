import React, { useState, useEffect } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { cn } from "../../../utils/cn";
import { StandardTabs, type StandardTab } from "../Tabs";
import { useUser } from "../../../providers/user";
import { useWorkApprovals } from "../../../hooks/useWorkApprovals";
import { RiCloseLine, RiUploadLine, RiTimeLine, RiCheckboxCircleLine } from "@remixicon/react";
import { UploadingTab } from "./Uploading";
import { PendingTab } from "./Pending";
import { CompletedTab } from "./Completed";

export interface WorkDashboardProps {
  className?: string;
  onClose?: () => void;
}

export const WorkDashboard: React.FC<WorkDashboardProps> = ({ className, onClose }) => {
  const intl = useIntl();
  const navigate = useNavigate();
  const { smartAccountAddress } = useUser();

  // Use the new hook for work approvals
  const { pendingApprovals, completedApprovals, isLoading, hasError, errorMessage } =
    useWorkApprovals(smartAccountAddress || undefined);

  // State management
  const [activeTab, setActiveTab] = useState<"uploading" | "pending" | "completed">("uploading");
  const [isClosing, setIsClosing] = useState(false);

  // Prevent background scrolling when modal is open
  useEffect(() => {
    document.documentElement.classList.add("modal-open");
    return () => {
      document.documentElement.classList.remove("modal-open");
    };
  }, []);

  // Filter work by categories
  // FIXED: Corrected the logic - pending work should come from pendingApprovals, not completedApprovals
  const uploadingWork = pendingApprovals.filter((work) =>
    ["pending", "syncing", "failed"].includes(work.status)
  );
  // For work approvals, "pending" doesn't make sense as a separate category from uploading
  // Since this is work approvals (user as reviewer), we'll show uploading and completed only
  const pendingWork: any[] = []; // Empty for now - could be used for approvals awaiting action
  const completedWork = completedApprovals.filter((work) =>
    ["approved", "rejected"].includes(work.status)
  );

  // Navigation handler
  const handleWorkClick = (work: any) => {
    try {
      // Validate work object has required properties
      if (!work?.gardenId || !work?.id) {
        console.error("Invalid work object for navigation:", work);
        return;
      }
      // Navigate to work view: /home/:gardenId/work/:workId
      navigate(`/home/${work.gardenId}/work/${work.id}`);
    } catch (error) {
      console.error("Error navigating to work:", error, work);
    }
  };

  // Enhanced tabs without counts (will be in content)
  const tabs: StandardTab[] = [
    {
      id: "uploading",
      label: intl.formatMessage({
        id: "app.workDashboard.tabs.uploading",
        defaultMessage: "Uploading",
      }),
      icon: <RiUploadLine className="w-4 h-4" />,
    },
    {
      id: "pending",
      label: intl.formatMessage({
        id: "app.workDashboard.tabs.pending",
        defaultMessage: "Pending",
      }),
      icon: <RiTimeLine className="w-4 h-4" />,
    },
    {
      id: "completed",
      label: intl.formatMessage({
        id: "app.workDashboard.tabs.completed",
        defaultMessage: "Completed",
      }),
      icon: <RiCheckboxCircleLine className="w-4 h-4" />,
    },
  ];

  const handleClose = () => {
    setIsClosing(true);
    // Start close animation, then call onClose after animation completes
    setTimeout(() => {
      onClose?.();
    }, 300); // Match the modal-slide-exit animation duration
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "uploading":
        return (
          <UploadingTab
            uploadingWork={uploadingWork}
            isLoading={isLoading}
            onWorkClick={handleWorkClick}
          />
        );
      case "pending":
        return (
          <PendingTab
            pendingWork={pendingWork}
            isLoading={isLoading}
            hasError={hasError}
            errorMessage={errorMessage}
            onWorkClick={handleWorkClick}
          />
        );
      case "completed":
        return (
          <CompletedTab
            completedWork={completedWork}
            isLoading={isLoading}
            hasError={hasError}
            errorMessage={errorMessage}
            onWorkClick={handleWorkClick}
          />
        );
      default:
        return (
          <UploadingTab
            uploadingWork={uploadingWork}
            isLoading={isLoading}
            onWorkClick={handleWorkClick}
          />
        );
    }
  };

  return (
    <div
      className={cn(
        "fixed inset-0 bg-black/20 backdrop-blur-sm z-[10001] flex items-end justify-center",
        isClosing ? "modal-backdrop-exit" : "modal-backdrop-enter"
      )}
      data-testid="modal-drawer-overlay"
      onClick={handleClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          handleClose();
        }
      }}
      tabIndex={-1}
    >
      <div
        className={cn(
          "bg-white rounded-t-3xl shadow-2xl w-full overflow-hidden flex flex-col",
          isClosing ? "modal-slide-exit" : "modal-slide-enter",
          className
        )}
        style={{ height: "85vh" }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
        }}
        role="dialog"
        aria-modal="true"
        data-testid="modal-drawer"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold truncate">
              {intl.formatMessage({
                id: "app.workDashboard.title",
                defaultMessage: "Work Dashboard",
              })}
            </h2>
            <p className="text-sm text-slate-600 truncate">
              {intl.formatMessage({
                id: "app.workDashboard.description",
                defaultMessage: "Track work submissions and reviews",
              })}
            </p>
          </div>
          <div className="flex items-center gap-2 ml-4">
            <button
              onClick={handleClose}
              className="btn-icon rounded-full"
              data-testid="modal-drawer-close"
              aria-label="Close modal"
            >
              <RiCloseLine className="w-5 h-5 focus:text-primary active:text-primary" />
            </button>
          </div>
        </div>

        {/* Standardized Tabs */}
        <StandardTabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={(tabId) => setActiveTab(tabId as "uploading" | "pending" | "completed")}
          isLoading={isLoading}
        />

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-hidden">{renderTabContent()}</div>
      </div>
    </div>
  );
};
