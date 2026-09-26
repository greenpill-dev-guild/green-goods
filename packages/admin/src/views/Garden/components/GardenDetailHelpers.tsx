import type { TabBadgeSeverity, TabBadgeState } from "@green-goods/shared/types/garden-detail";
import { RiAlertLine, RiArrowRightSLine, RiCloseLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { AdminCard, AdminCardBody, AdminCardTitle } from "@/components/AdminCard";
import { ALERT_LABEL_CLASSES, BADGE_TONE_CLASSES } from "./gardenDetail.constants";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Review time reads in days, then weeks past two weeks (DL-044). */
export function formatReviewTime(
  latencyMs: number | null,
  formatMessage: ReturnType<typeof useIntl>["formatMessage"]
): string {
  if (latencyMs === null) return formatMessage({ id: "app.garden.detail.metric.notAvailable" });
  const days = latencyMs / DAY_MS;
  if (days < 1) return formatMessage({ id: "app.garden.detail.metric.underADay" });
  if (days <= 14) {
    return formatMessage({ id: "app.garden.detail.metric.daysValue" }, { days: Math.round(days) });
  }
  return formatMessage(
    { id: "app.garden.detail.metric.weeksValue" },
    { weeks: Math.round(days / 7) }
  );
}

export function TabBadge({ badge }: { badge: TabBadgeState }) {
  if (badge.severity === "none" || !badge.count) {
    return null;
  }

  return (
    <span
      className={`ml-2 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-label-sm font-semibold ${BADGE_TONE_CLASSES[badge.severity]}`}
    >
      {badge.count}
    </span>
  );
}

interface SectionStateProps {
  title: string;
  description: string;
  closeLabel: string;
  onClose: () => void;
}

export function SectionStateCard({ title, description, closeLabel, onClose }: SectionStateProps) {
  return (
    <AdminCard density="none" className="border-l-2 border-l-information-dark">
      <AdminCardBody className="flex items-start justify-between gap-3">
        <div>
          <AdminCardTitle>{title}</AdminCardTitle>
          <p className="mt-1 body-sm text-text-sub">{description}</p>
        </div>
        <AdminButton variant="text" size="sm" onClick={onClose} aria-label={closeLabel}>
          <RiCloseLine className="h-4 w-4" />
        </AdminButton>
      </AdminCardBody>
    </AdminCard>
  );
}

interface AlertRowProps {
  severity: Exclude<TabBadgeSeverity, "none">;
  label: string;
  actionLabel: string;
  onAction: () => void;
}

export function AlertRow({ severity, label, actionLabel, onAction }: AlertRowProps) {
  return (
    <AdminCard
      variant="outlined"
      density="compact"
      className="flex items-start justify-between gap-3"
    >
      <div className="flex min-w-0 items-start gap-2">
        <RiAlertLine className={`mt-0.5 h-4 w-4 flex-shrink-0 ${ALERT_LABEL_CLASSES[severity]}`} />
        <p className="body-sm text-text-sub">{label}</p>
      </div>
      <AdminButton type="button" variant="text" size="sm" onClick={onAction} className="gap-1 px-0">
        {actionLabel}
        <RiArrowRightSLine className="h-4 w-4" />
      </AdminButton>
    </AdminCard>
  );
}
