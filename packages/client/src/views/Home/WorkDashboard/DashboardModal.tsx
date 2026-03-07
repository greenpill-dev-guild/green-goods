import { cn, useTimeout } from "@green-goods/shared";
import { RiCloseLine } from "@remixicon/react";
import React, { useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";

interface DashboardModalProps {
  className?: string;
  onClose?: () => void;
  children: React.ReactNode;
}

export const DashboardModal: React.FC<DashboardModalProps> = ({ className, onClose, children }) => {
  const intl = useIntl();
  const [isClosing, setIsClosing] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const { set: scheduleTimeout } = useTimeout();

  useEffect(() => {
    document.documentElement.classList.add("modal-open");
    return () => {
      document.documentElement.classList.remove("modal-open");
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      const focusable = dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    dialog.addEventListener("keydown", handleKeyDown);
    const closeBtn = dialog.querySelector<HTMLElement>('[data-testid="modal-drawer-close"]');
    closeBtn?.focus();

    return () => dialog.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    scheduleTimeout(() => {
      onClose?.();
    }, 300);
  };

  return (
    <div
      role="presentation"
      className={cn(
        "fixed inset-0 bg-black/30 backdrop-blur-sm z-[20000] flex items-end justify-center",
        isClosing ? "modal-backdrop-exit" : "modal-backdrop-enter"
      )}
      data-testid="modal-drawer-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          handleClose();
        }
      }}
      tabIndex={-1}
    >
      <div
        ref={dialogRef}
        className={cn(
          "bg-bg-white-0 rounded-t-3xl shadow-2xl w-full overflow-hidden flex flex-col h-modal",
          isClosing ? "modal-slide-exit" : "modal-slide-enter",
          className
        )}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
        }}
        role="dialog"
        aria-modal="true"
        data-testid="modal-drawer"
      >
        <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold truncate">
              {intl.formatMessage({
                id: "app.workDashboard.title",
                defaultMessage: "Work Dashboard",
              })}
            </h2>
            <p className="text-sm text-text-sub-600 truncate">
              {intl.formatMessage({
                id: "app.workDashboard.description",
                defaultMessage: "Track work submissions and reviews",
              })}
            </p>
          </div>
          <div className="flex items-center gap-2 ml-4">
            <button
              onClick={handleClose}
              className="btn-icon"
              data-testid="modal-drawer-close"
              aria-label="Close modal"
            >
              <RiCloseLine className="w-5 h-5 text-text-soft-400 focus:text-primary active:text-primary" />
            </button>
          </div>
        </div>

        {children}
      </div>
    </div>
  );
};
