import { AddressDisplay, DialogShell, EmptyState } from "@green-goods/shared";
import { RiDeleteBinLine, RiUserLine } from "@remixicon/react";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";

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
    <DialogShell
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      size="xl"
      title={title}
      description={formatMessage(
        { id: "app.admin.garden.members.count" },
        { count: members.length }
      )}
      icon={icon}
      iconContainerClassName={`${colors.iconBg} ${colors.iconText}`}
      preventClose={isLoading}
    >
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
                  <AddressDisplay address={member} className="text-sm font-medium sm:text-base" />
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
    </DialogShell>
  );
}
