import { RiCloseLine, RiDeleteBinLine, RiUserLine } from "@remixicon/react";
import { type ReactNode, useEffect } from "react";
import { AddressDisplay } from "../UI/AddressDisplay";

type MembersModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  members: string[];
  canManage: boolean;
  onRemove?: (member: string) => Promise<void>;
  isLoading?: boolean;
  icon?: ReactNode;
  colorScheme?: "blue" | "green";
};

export function MembersModal({
  isOpen,
  onClose,
  title,
  members,
  canManage,
  onRemove,
  isLoading = false,
  icon,
  colorScheme = "blue",
}: MembersModalProps) {
  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const colorClasses = {
    blue: {
      iconBg: "bg-information-lighter",
      iconText: "text-information-base",
    },
    green: {
      iconBg: "bg-success-lighter",
      iconText: "text-success-base",
    },
  };

  const colors = colorClasses[colorScheme];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="members-modal-title"
      tabIndex={-1}
    >
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-t-2xl bg-bg-white shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="document"
        style={{ maxHeight: "90vh" }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-stroke-soft bg-bg-white px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {icon && (
              <div
                className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${colors.iconBg} ${colors.iconText} sm:h-10 sm:w-10`}
              >
                {icon}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2
                id="members-modal-title"
                className="truncate text-lg font-semibold text-text-strong sm:text-xl"
              >
                {title}
              </h2>
              <p className="text-xs text-text-soft sm:text-sm">
                {members.length} {members.length === 1 ? "member" : "members"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-text-soft transition hover:bg-bg-soft active:scale-95"
            aria-label="Close modal"
          >
            <RiCloseLine className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-4 sm:p-6" style={{ maxHeight: "calc(90vh - 80px)" }}>
          {members.length === 0 ? (
            <div className="py-12 text-center">
              <div
                className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${colors.iconBg}`}
              >
                {icon || <RiUserLine className={`h-8 w-8 ${colors.iconText}`} />}
              </div>
              <p className="text-sm text-text-soft">No members found</p>
            </div>
          ) : (
            <div className="space-y-2 sm:space-y-3">
              {members.map((member: string, index: number) => (
                <div
                  key={`${member}-${index}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-stroke-soft bg-bg-weak p-3 transition hover:border-stroke-sub hover:bg-bg-soft/40 sm:p-4"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div
                      className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${colors.iconBg}`}
                    >
                      <RiUserLine className={`h-5 w-5 ${colors.iconText}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <AddressDisplay
                        address={member}
                        className="text-sm font-medium sm:text-base"
                      />
                      <p className="text-xs text-text-soft">Member #{index + 1}</p>
                    </div>
                  </div>
                  {canManage && onRemove && (
                    <button
                      type="button"
                      onClick={async () => {
                        await onRemove(member);
                      }}
                      disabled={isLoading}
                      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-red-600 transition hover:bg-red-50 active:scale-95 disabled:opacity-50/20"
                      aria-label={`Remove ${member}`}
                    >
                      <RiDeleteBinLine className="h-5 w-5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mobile drag indicator */}
        <div className="flex justify-center pb-2 pt-1 sm:hidden">
          <div className="h-1 w-12 rounded-full bg-gray-300" />
        </div>
      </div>
    </div>
  );
}
