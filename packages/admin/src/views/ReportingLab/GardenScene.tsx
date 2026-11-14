/**
 * Garden reporting lab, walkthrough (proposed): what every Garden screen shares. The
 * cockpit's frame and the Garden header with its stats, actions and tabs; the report scope
 * the tab reads; the review queue and the alert the shipped rule raises from it; and the
 * records dialog, which a tab's content opens through `openRecords`.
 */
import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import { useMemo, useState, type ReactNode } from "react";
import { useIntl } from "react-intl";
import type { GardenAlert } from "@/views/Garden/components/GardenAlertsCard";
import { monthOf } from "./dates";
import { formatAmount, fundingSummary } from "./funding";
import { LabCanvas } from "./LabCanvas";
import { labGardens } from "./labShell";
import type { MediaSet, ReportDataset, ViewerRole } from "./model";
import { RecordsDialog, type RecordsRequest } from "./RecordsDialog";
import { type ReviewHealth, reviewHealth } from "./reviewHealth";
import { GardenFrame, type GardenView } from "./SceneFrames";
import { reviewAlerts } from "./sceneData";
import { defaultScope, referenceDay, type ReportScope, type ReportView } from "./scope";

/** The report scope each tab starts on: its month and filters. */
const TAB_REPORT: Record<GardenView, ReportView> = {
  health: "review",
  pool: "season",
  activity: "calendar",
  impact: "outputs",
};

/** The walkthrough is a steward's; the records dialog shows them the review action. */
const STEWARD: ViewerRole = "steward";

export interface GardenSceneTools {
  scope: ReportScope;
  setScope: (patch: Partial<ReportScope>) => void;
  open: RecordsRequest | null;
  openRecords: (request: RecordsRequest | null) => void;
  health: ReviewHealth;
  alerts: GardenAlert[];
  gardeners: number;
}

interface GardenSceneProps {
  dataset: ReportDataset;
  media: MediaSet;
  view: GardenView;
  /** The records dialog the screen opens on, read against the tab's starting scope. */
  opening?: (scope: ReportScope, locale: string) => RecordsRequest | null;
  children: (tools: GardenSceneTools) => ReactNode;
}

export function GardenScene({ dataset, media, view, opening, children }: GardenSceneProps) {
  const { formatMessage, locale } = useIntl();
  const { garden } = dataset;
  const [scope, setScope] = useState<ReportScope>(() => defaultScope(dataset, TAB_REPORT[view]));
  const [open, setOpen] = useState<RecordsRequest | null>(
    () => opening?.(defaultScope(dataset, TAB_REPORT[view]), locale) ?? null
  );
  const health = useMemo(
    () => reviewHealth(dataset, dataset.records, dataset.reference, monthOf(referenceDay(dataset))),
    [dataset]
  );
  const alerts = reviewAlerts(health, formatMessage, () => undefined);
  const gardeners = garden.accounts.filter((account) => account.kind === "person").length;

  return (
    <LabCanvas workspace="garden" gardens={labGardens(media, garden)} gardenId={garden.id}>
      <GardenFrame view={view} gardenerCount={gardeners} impactCount={0} alertCount={alerts.length}>
        {children({
          scope,
          setScope: (patch) => setScope((current) => ({ ...current, ...patch })),
          open,
          openRecords: setOpen,
          health,
          alerts,
          gardeners,
        })}
      </GardenFrame>
      <RecordsDialog
        request={open}
        onClose={() => setOpen(null)}
        dataset={dataset}
        media={media}
        role={STEWARD}
      />
    </LabCanvas>
  );
}

/** Key Metrics as the Garden tabs show them: pending work, assessments, gardeners, endowment. */
export function GardenKeyMetrics({
  dataset,
  health,
  gardeners,
}: {
  dataset: ReportDataset;
  health: ReviewHealth;
  gardeners: number;
}) {
  const { formatMessage, locale } = useIntl();
  const { garden } = dataset;
  const endowments = fundingSummary(garden, dataset.reference, monthOf(referenceDay(dataset)))
    .assets.map((asset) => {
      const held = asset.accounts
        .filter((account) => account.account === "endowment")
        .reduce((sum, account) => sum + account.balance, 0);
      return held > 0 ? formatAmount(held, asset.asset, locale) : null;
    })
    .filter(Boolean)
    .join(" · ");
  return (
    <FactList frame="inset">
      <FactRow
        label={formatMessage({ id: "app.garden.detail.keyMetrics.pendingWork" })}
        value={health.pending.length}
      />
      <FactRow
        label={formatMessage({ id: "app.garden.detail.keyMetrics.assessments30d" })}
        value={0}
      />
      <FactRow
        label={formatMessage({ id: "app.garden.detail.keyMetrics.activeGardeners" })}
        value={gardeners}
      />
      <FactRow
        label={formatMessage({ id: "app.garden.detail.keyMetrics.treasury" })}
        value={endowments || "0"}
      />
    </FactList>
  );
}
