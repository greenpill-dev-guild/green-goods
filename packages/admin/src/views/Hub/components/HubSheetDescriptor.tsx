import {
  Alert,
  type AdminHubRouteContext,
  adminRoutes,
  SheetBody,
  useRouteBackedLeftSheetConfig,
  type ActivityEvent,
  type Work,
} from "@green-goods/shared";
import { useCallback, useMemo } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { WorkDetailPanel } from "@/views/Garden/WorkDetail";
import { HubCertificationInspector } from "./HubCertificationInspector";
import { HubHistoryInspector } from "./HubHistoryInspector";

interface HubSheetDescriptorProps {
  routeSheetContentId: string | null;
  routeWorkId: string | undefined;
  routeCertificationId: string | undefined;
  routeHistoryEventId: string | undefined;
  activeWorkDetailId: string | null;
  selectedWork: Work | undefined;
  selectedCertification:
    | {
        id: string;
        title?: string | null;
        description?: string | null;
        assessmentType?: string | null;
        createdAt: number;
      }
    | undefined;
  selectedHistoryEvent: ActivityEvent | undefined;
  isResolvingSelection: boolean;
  canManage: boolean;
  hubContext: AdminHubRouteContext;
  closeTo: string;
  onNavigateToBase: () => void;
  onBeforeClose: () => void;
}

function SheetResolutionState({
  isResolving,
  loadingLabel,
  message,
}: {
  isResolving: boolean;
  loadingLabel: string;
  message: string;
}) {
  if (isResolving) {
    return (
      <SheetBody padded={true}>
        <div className="space-y-4" aria-busy="true" role="status">
          <span className="sr-only">{loadingLabel}</span>
          <div className="h-32 rounded-[var(--radius-lg)] bg-bg-soft skeleton-shimmer" />
          <div className="h-20 rounded-[var(--radius-lg)] bg-bg-soft skeleton-shimmer" />
          <div className="h-40 rounded-[var(--radius-lg)] bg-bg-soft skeleton-shimmer" />
        </div>
      </SheetBody>
    );
  }

  return (
    <SheetBody padded={true}>
      <Alert variant="warning">{message}</Alert>
    </SheetBody>
  );
}

/**
 * Resolves which content to show in the Hub left sheet based on route and selection state.
 * Calls useLeftSheetConfig internally — render this component inside HubView.
 */
export function HubSheetDescriptor({
  routeWorkId,
  routeCertificationId,
  routeHistoryEventId,
  activeWorkDetailId,
  selectedWork,
  selectedCertification,
  selectedHistoryEvent,
  isResolvingSelection,
  canManage,
  hubContext,
  closeTo,
  onNavigateToBase,
  onBeforeClose,
}: HubSheetDescriptorProps) {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const handlePanelClose = useCallback(() => {
    onBeforeClose();
    onNavigateToBase();
  }, [onBeforeClose, onNavigateToBase]);

  const sheetDescriptor = useMemo(() => {
    // Submit Work is no longer a Hub inspector sheet — it owns its own route
    // (/hub/work/submit → submitWorkView). This descriptor only resolves the
    // read/review inspectors (work detail, certification, history).
    const resolvedWorkDetailId = routeWorkId ?? activeWorkDetailId;

    if (resolvedWorkDetailId) {
      return {
        title:
          selectedWork?.title ??
          formatMessage({ id: "app.work.detail.reviewTitle", defaultMessage: "Review Work" }),
        content: (
          <WorkDetailPanel
            workId={resolvedWorkDetailId}
            layout="sheet"
            onSuccess={handlePanelClose}
          />
        ),
      };
    }

    if (routeCertificationId || selectedCertification) {
      return {
        title:
          selectedCertification?.title ??
          formatMessage({
            id: "app.garden.admin.assessmentFallback",
            defaultMessage: "Assessment",
          }),
        content: selectedCertification ? (
          <HubCertificationInspector
            assessment={selectedCertification}
            canMint={canManage}
            onOpenMintFlow={() => navigate(adminRoutes.hubCertifyCreate(hubContext))}
          />
        ) : (
          <SheetResolutionState
            isResolving={isResolvingSelection}
            loadingLabel={formatMessage({
              id: "cockpit.hub.sheet.resolving",
              defaultMessage: "Loading selection...",
            })}
            message={formatMessage({
              id: "cockpit.hub.sheet.assessmentNotFound",
              defaultMessage: "Assessment could not be found.",
            })}
          />
        ),
      };
    }

    if (routeHistoryEventId || selectedHistoryEvent) {
      return {
        title:
          selectedHistoryEvent?.title ??
          formatMessage({ id: "cockpit.hub.tab.history", defaultMessage: "History" }),
        content: selectedHistoryEvent ? (
          <HubHistoryInspector event={selectedHistoryEvent} />
        ) : (
          <SheetResolutionState
            isResolving={isResolvingSelection}
            loadingLabel={formatMessage({
              id: "cockpit.hub.sheet.resolving",
              defaultMessage: "Loading selection...",
            })}
            message={formatMessage({
              id: "cockpit.hub.sheet.historyNotFound",
              defaultMessage: "History event could not be found.",
            })}
          />
        ),
      };
    }

    return null;
  }, [
    canManage,
    formatMessage,
    handlePanelClose,
    hubContext,
    isResolvingSelection,
    navigate,
    activeWorkDetailId,
    routeCertificationId,
    routeHistoryEventId,
    routeWorkId,
    selectedCertification,
    selectedHistoryEvent,
    selectedWork,
  ]);

  const routeBackedSheetConfig = useMemo(
    () =>
      sheetDescriptor
        ? {
            title: sheetDescriptor.title,
            content: sheetDescriptor.content,
            closeTo,
            onBeforeClose,
            // Hub deep-link sheets carry forms and media evidence — the
            // default left-sheet width cramps them (QA refinement pass).
            width: "wide" as const,
          }
        : null,
    [closeTo, onBeforeClose, sheetDescriptor]
  );
  useRouteBackedLeftSheetConfig(routeBackedSheetConfig);

  return null;
}
