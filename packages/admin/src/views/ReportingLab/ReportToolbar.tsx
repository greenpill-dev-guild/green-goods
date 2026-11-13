/**
 * Garden reporting lab: the reports' shared toolbar. The month and the filters belong to
 * the steward's scope, so they hold while moving between reports; each report shows only
 * the filters it reads, and Clear Filters appears once one is set. Below 640px the filters
 * fold behind one Filters button that counts the active ones, so the report starts higher.
 */
import { Button } from "@green-goods/shared/components/Button";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { RiArrowLeftLine, RiEqualizerLine } from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";
import { AdminFilterChip } from "@/components/AdminFilterChip";
import { AdminSortSelect } from "@/components/AdminSortSelect";
import { formatMonth } from "./dates";
import { REPORT_ORDER, STATUS_COPY, VIEW_COPY } from "./labCopy";
import type { ReportDataset, StatusView } from "./model";
import {
  activeFilterCount,
  availableMonths,
  type ReportScope,
  type ReportView,
  VIEW_FILTERS,
} from "./scope";

interface ReportToolbarProps {
  dataset: ReportDataset;
  scope: ReportScope;
  onScopeChange: (patch: Partial<ReportScope>) => void;
}

const STATUS_CHIPS: readonly StatusView[] = ["pending", "approved", "rejected"];

export function ReportToolbar({ dataset, scope, onScopeChange }: ReportToolbarProps) {
  const { locale } = useIntl();
  const { garden } = dataset;
  const filters = VIEW_FILTERS[scope.view];
  const hasUnread = dataset.records.some((record) => !record.approvalReadable);
  const statuses = hasUnread ? [...STATUS_CHIPS, "unknown" as const] : STATUS_CHIPS;
  const [open, setOpen] = useState(false);
  const active = activeFilterCount(scope);
  const hasFilters =
    filters.action || filters.status || (filters.window && garden.windows.length > 0);
  const folded = cn("contents", !open && "max-sm:hidden");

  return (
    <div className="flex flex-wrap items-center gap-2" data-component="ReportToolbar">
      {scope.view === "overview" ? null : (
        <Button
          type="button"
          emphasis="tertiary"
          size="sm"
          onClick={() => onScopeChange({ view: "overview" })}
        >
          <RiArrowLeftLine aria-hidden className="h-[18px] w-[18px]" />
          All Reports
        </Button>
      )}
      <AdminSortSelect
        label="Report"
        value={scope.view}
        onChange={(value) => onScopeChange({ view: value as ReportView })}
        options={REPORT_ORDER.map((view) => ({ value: view, label: VIEW_COPY[view].title }))}
      />
      <AdminSortSelect
        label="Month"
        value={scope.month}
        onChange={(month) => onScopeChange({ month })}
        options={availableMonths(dataset).map((month) => ({
          value: month,
          label: formatMonth(month, locale),
        }))}
      />
      {hasFilters ? (
        <Button
          type="button"
          emphasis="secondary"
          size="sm"
          className="sm:hidden"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <RiEqualizerLine aria-hidden className="h-[18px] w-[18px]" />
          {active > 0 ? `Filters (${active})` : "Filters"}
        </Button>
      ) : null}
      <div className={folded}>
        {filters.action ? (
          <AdminSortSelect
            label="Action"
            value={scope.actionId}
            onChange={(actionId) => onScopeChange({ actionId })}
            options={[
              { value: "all", label: "All actions" },
              ...garden.actions.map((action) => ({ value: action.id, label: action.title })),
            ]}
          />
        ) : null}
        {filters.window && garden.windows.length > 0 ? (
          <AdminSortSelect
            label="Season"
            value={scope.windowId}
            onChange={(windowId) => onScopeChange({ windowId })}
            options={[
              { value: "all", label: "All dates" },
              ...garden.windows.map((window) => ({
                value: window.id,
                label: `${window.kind === "season" ? "Season" : "Campaign"}: ${window.name}`,
              })),
            ]}
          />
        ) : null}
        {filters.status ? (
          <div role="group" aria-label="Status" className="flex flex-wrap items-center gap-1.5">
            {statuses.map((status) => (
              <AdminFilterChip
                key={status}
                label={STATUS_COPY[status].label}
                selected={scope.status === status}
                onToggle={() => onScopeChange({ status: scope.status === status ? "all" : status })}
              />
            ))}
          </div>
        ) : null}
      </div>
      {active > 0 ? (
        <Button
          type="button"
          emphasis="tertiary"
          size="sm"
          onClick={() => onScopeChange({ actionId: "all", windowId: "all", status: "all" })}
        >
          Clear Filters
        </Button>
      ) : null}
    </div>
  );
}
