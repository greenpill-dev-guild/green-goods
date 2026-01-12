import * as Dialog from "@radix-ui/react-dialog";
import { RiCloseLine, RiDeleteBinLine, RiUserLine } from "@remixicon/react";
import type { ReactNode } from "react";
import { AddressDisplay } from "../AddressDisplay";

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

/**
 * Modal for displaying and managing garden members (gardeners or operators).
 * Uses Radix Dialog for accessibility and proper focus management.
 */
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
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-150" />
        <Dialog.Content
          className="fixed z-50 w-full max-w-2xl overflow-hidden bg-bg-white shadow-2xl focus:outline-none bottom-0 left-1/2 -translate-x-1/2 rounded-t-2xl sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom sm:data-[state=closed]:slide-out-to-bottom-0 sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95 duration-300"
          style={{ maxHeight: "90vh" }}
          onPointerDownOutside={(e) => {
            if (isLoading) e.preventDefault();
          }}
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
                <Dialog.Title className="truncate text-lg font-semibold text-text-strong sm:text-xl">
                  {title}
                </Dialog.Title>
                <Dialog.Description className="text-xs text-text-soft sm:text-sm">
                  {members.length} {members.length === 1 ? "member" : "members"}
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-text-soft transition hover:bg-bg-soft active:scale-95"
                aria-label="Close modal"
              >
                <RiCloseLine className="h-5 w-5" />
              </button>
            </Dialog.Close>
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
                        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-error-dark transition hover:bg-error-lighter active:scale-95 disabled:opacity-50/20"
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
            <div className="h-1 w-12 rounded-full bg-stroke-sub" />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
