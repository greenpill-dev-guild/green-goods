/**
 * Garden reporting lab: the proposed Reports page inside the Garden workspace. One route
 * frame, one header with the shared toolbar, the chosen report, and one records dialog
 * every report opens, so a drill-down and the way back keep the steward's scope.
 */
import { Button } from "@green-goods/shared/components/Button";
import { MetaStrip } from "@green-goods/shared/components/Canvas/MetaStrip";
import { ItemRowSkeleton } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import { RiErrorWarningLine, RiLoader4Line } from "@remixicon/react";
import { type ReactNode, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { AdminCard } from "@/components/AdminCard";
import {
  CanvasRouteContent,
  CanvasRouteFrame,
  CanvasRouteHeader,
} from "@/components/Layout/CanvasRouteFrame";
import { ActivityCalendar } from "./ActivityCalendar";
import { formatDay } from "./dates";
import { EvidenceOutcomes } from "./EvidenceOutcomes";
import { FundingHistory } from "./FundingHistory";
import { VIEW_COPY } from "./labCopy";
import type { MediaSet, ReportDataset, ViewerRole } from "./model";
import { OutputTrends } from "./OutputTrends";
import { ParticipationView } from "./ParticipationView";
import { PlaceActivity } from "./PlaceActivity";
import { RecordsDialog, type RecordsRequest } from "./RecordsDialog";
import { ReportToolbar } from "./ReportToolbar";
import { ReportsOverview } from "./ReportsOverview";
import { ReviewHealthPanel } from "./ReviewHealthPanel";
import { referenceDay, type ReportScope, scopeRecords } from "./scope";
import { SeasonTimeline } from "./SeasonTimeline";

interface ReportsPageProps {
  dataset: ReportDataset;
  scope: ReportScope;
  onScopeChange: (patch: Partial<ReportScope>) => void;
  media: MediaSet;
  role: ViewerRole;
  onLoadOlder?: () => void;
  onRetry?: () => void;
}

export function ReportsPage({
  dataset,
  scope,
  onScopeChange,
  media,
  role,
  onLoadOlder,
  onRetry,
}: ReportsPageProps) {
  const { locale } = useIntl();
  const [request, setRequest] = useState<RecordsRequest | null>(null);
  const records = useMemo(() => scopeRecords(dataset, scope), [dataset, scope]);
  const copy = VIEW_COPY[scope.view];
  const asOf = formatDay(referenceDay(dataset), locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const shared = { dataset, scope, records, onOpenRecords: setRequest };

  let content: ReactNode;
  if (dataset.state === "loading") {
    content = (
      <AdminCard className="flex flex-col gap-3">
        <EmptyState
          busy
          icon={<RiLoader4Line className="h-6 w-6 animate-spin motion-reduce:animate-none" />}
          title="Reading this garden's records"
          description="Work, reviews and funding load together, so every report counts the same records."
          placement="list"
        />
        <ul className="flex flex-col gap-(--gg-list-gap)">
          {[0, 1, 2].map((index) => (
            <li key={index}>
              <ItemRowSkeleton edge="neutral" />
            </li>
          ))}
        </ul>
      </AdminCard>
    );
  } else if (dataset.state === "error") {
    content = (
      <AdminCard>
        <EmptyState
          tone="error"
          icon={<RiErrorWarningLine className="h-6 w-6" />}
          title="Records could not be read"
          description="Nothing was counted, so no report shows a number it cannot back. Check the connection and try again."
          action={
            onRetry ? (
              <Button type="button" size="sm" onClick={onRetry}>
                Try Again
              </Button>
            ) : undefined
          }
        />
      </AdminCard>
    );
  } else {
    switch (scope.view) {
      case "overview":
        content = (
          <ReportsOverview
            {...shared}
            media={media}
            onScopeChange={onScopeChange}
            onLoadOlder={onLoadOlder}
          />
        );
        break;
      case "calendar":
        content = (
          <ActivityCalendar {...shared} onScopeChange={onScopeChange} onLoadOlder={onLoadOlder} />
        );
        break;
      case "review":
        content = <ReviewHealthPanel {...shared} media={media} />;
        break;
      case "outputs":
        content = <OutputTrends {...shared} />;
        break;
      case "season":
        content = (
          <SeasonTimeline
            dataset={dataset}
            scope={scope}
            onScopeChange={onScopeChange}
            onOpenRecords={setRequest}
          />
        );
        break;
      case "places":
        content = <PlaceActivity {...shared} />;
        break;
      case "people":
        content = (
          <ParticipationView dataset={dataset} scope={scope} records={records} role={role} />
        );
        break;
      case "funding":
        content = <FundingHistory dataset={dataset} scope={scope} />;
        break;
      case "evidence":
        content = <EvidenceOutcomes dataset={dataset} media={media} onOpenRecords={setRequest} />;
        break;
    }
  }

  return (
    <CanvasRouteFrame data-component="ReportsPage" data-region="workspace-garden-reports">
      <CanvasRouteHeader
        variant="canvas"
        wrapperClassName="flex flex-col gap-3"
        eyebrow="Garden"
        title={copy.title}
        description={copy.question}
        metadata={
          <MetaStrip
            density="inline"
            items={[
              { id: "sample", label: "Sample data" },
              { id: "as-of", label: `As of ${asOf}` },
              { id: "zone", label: `Times in ${dataset.garden.zoneLabel}` },
            ]}
          />
        }
        toolbar={<ReportToolbar dataset={dataset} scope={scope} onScopeChange={onScopeChange} />}
      />
      <CanvasRouteContent className="flex flex-col gap-4 pt-2 sm:gap-5">
        {content}
      </CanvasRouteContent>
      <RecordsDialog
        request={request}
        onClose={() => setRequest(null)}
        dataset={dataset}
        media={media}
        role={role}
      />
    </CanvasRouteFrame>
  );
}
