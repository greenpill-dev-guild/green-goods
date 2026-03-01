import { RiAlertLine, RiArrowRightSLine, RiCloseLine, RiMore2Line } from "@remixicon/react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { TabAction, TabBadgeSeverity, TabBadgeState } from "./gardenDetail.types";
import { ALERT_LABEL_CLASSES, BADGE_TONE_CLASSES } from "./gardenDetail.constants";

export function TabBadge({ badge }: { badge: TabBadgeState }) {
  if (badge.severity === "none" || !badge.count) {
    return null;
  }

  return (
    <span
      className={`ml-2 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${BADGE_TONE_CLASSES[badge.severity]}`}
    >
      {badge.count}
    </span>
  );
}

export function ActionMenu({
  actions,
  triggerAriaLabel,
}: {
  actions: TabAction[];
  triggerAriaLabel: string;
}) {
  if (actions.length === 0) return null;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button size="sm" variant="secondary" aria-label={triggerAriaLabel}>
          <RiMore2Line className="h-4 w-4" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-52 rounded-lg border border-stroke-sub bg-bg-white p-1 shadow-xl"
        >
          {actions.map((action) => {
            if (action.to) {
              return (
                <DropdownMenu.Item key={action.key} asChild>
                  <Link
                    to={action.to}
                    className="flex cursor-pointer items-center rounded-md px-3 py-2 text-sm text-text-sub outline-none transition-colors hover:bg-bg-weak data-[highlighted]:bg-bg-weak"
                  >
                    {action.label}
                  </Link>
                </DropdownMenu.Item>
              );
            }

            return (
              <DropdownMenu.Item
                key={action.key}
                onSelect={(event) => {
                  event.preventDefault();
                  action.onSelect?.();
                }}
                className="flex cursor-pointer items-center rounded-md px-3 py-2 text-sm text-text-sub outline-none transition-colors hover:bg-bg-weak data-[highlighted]:bg-bg-weak"
              >
                {action.label}
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

interface TabActionCardProps {
  title: string;
  description: string;
  primaryAction: React.ReactNode;
  overflowActions: TabAction[];
  menuAriaLabel: string;
}

export function TabActionCard({
  title,
  description,
  primaryAction,
  overflowActions,
  menuAriaLabel,
}: TabActionCardProps) {
  return (
    <Card className="garden-tab-action-card">
      <Card.Body className="flex flex-wrap items-start justify-between gap-3 sm:items-center">
        <div className="min-w-0 flex-1">
          <h2 className="label-md text-text-strong sm:text-lg">{title}</h2>
          <p className="mt-1 text-sm text-text-sub">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          {primaryAction}
          <ActionMenu actions={overflowActions} triggerAriaLabel={menuAriaLabel} />
        </div>
      </Card.Body>
    </Card>
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
    <Card colorAccent="info">
      <Card.Body className="flex items-start justify-between gap-3">
        <div>
          <h3 className="label-md text-text-strong">{title}</h3>
          <p className="mt-1 text-sm text-text-sub">{description}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label={closeLabel}>
          <RiCloseLine className="h-4 w-4" />
        </Button>
      </Card.Body>
    </Card>
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
    <div className="flex items-start justify-between gap-3 rounded-lg border border-stroke-soft bg-bg-weak px-3 py-2.5">
      <div className="flex min-w-0 items-start gap-2">
        <RiAlertLine className={`mt-0.5 h-4 w-4 flex-shrink-0 ${ALERT_LABEL_CLASSES[severity]}`} />
        <p className="text-sm text-text-sub">{label}</p>
      </div>
      <button
        type="button"
        onClick={onAction}
        className="inline-flex items-center gap-1 text-xs font-medium text-primary-base hover:text-primary-darker"
      >
        {actionLabel}
        <RiArrowRightSLine className="h-4 w-4" />
      </button>
    </div>
  );
}
