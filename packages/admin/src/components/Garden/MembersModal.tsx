import * as Dialog from "@radix-ui/react-dialog";
import { RiCloseLine, RiDeleteBinLine, RiUserLine } from "@remixicon/react";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import { EmptyState } from "@/components/ui/EmptyState";
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
  colorScheme?: "info" | "success" | "warning" | "feature" | "primary" | "neutral";
};

const COLOR_CLASSES = {
  info: {
    iconBg: "bg-information-lighter",
    iconText: "text-information-base",
  },
  success: {
    iconBg: "bg-success-lighter",
    iconText: "text-success-base",
  },
  warning: {
    iconBg: "bg-warning-lighter",
    iconText: "text-warning-base",
  },
  feature: {
    iconBg: "bg-feature-lighter",
    iconText: "text-feature-dark",
  },
  primary: {
    iconBg: "bg-primary-lighter",
    iconText: "text-primary-base",
  },
  neutral: {
    iconBg: "bg-bg-weak",
    iconText: "text-text-soft",
  },
} as const;

/**
 * Modal for displaying and managing garden members by role.
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
  colorScheme = "info",
}: MembersModalProps) {
  const { formatMessage } = useIntl();
  const colors = COLOR_CLASSES[colorScheme];

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-150" />
        <Dialog.Content
          className="fixed z-50 w-full max-w-2xl max-h-[90vh] overflow-hidden bg-bg-white shadow-2xl focus:outline-none bottom-0 left-1/2 -translate-x-1/2 rounded-t-2xl sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom sm:data-[state=closed]:slide-out-to-bottom-0 sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95 duration-300"
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
                <Dialog.Title
                  className="truncate text-lg font-semibold text-text-strong sm:text-xl"
                  title={title}
                >
                  {title}
                </Dialog.Title>
                <Dialog.Description className="text-xs text-text-soft sm:text-sm">
                  {formatMessage(
                    { id: "app.admin.garden.members.count" },
                    { count: members.length }
                  )}
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-text-soft transition hover:bg-bg-soft active:scale-95"
                aria-label={formatMessage({ id: "app.common.close" })}
              >
                <RiCloseLine className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[calc(90vh-80px)] p-4 sm:p-6">
            {members.length === 0 ? (
              <EmptyState
                icon={icon || <RiUserLine className="h-6 w-6" />}
                title={formatMessage({ id: "app.admin.garden.members.empty" })}
              />
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
                      </div>
                    </div>
                    {canManage && onRemove && (
                      <button
                        type="button"
                        onClick={async () => {
                          await onRemove(member);
                        }}
                        disabled={isLoading}
                        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-error-dark transition hover:bg-error-lighter active:scale-95 disabled:opacity-50"
                        aria-label={formatMessage({ id: "app.admin.garden.members.remove" })}
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
          <div className="flex justify-center pb-2 pt-1 sm:hidden" aria-hidden="true">
            <div className="h-1 w-12 rounded-full bg-stroke-sub" />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
