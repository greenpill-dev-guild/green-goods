import {
  type AdminHubRouteContext,
  adminRoutes,
  SUBMIT_WORK_CONTENT_ID,
  useRouteBackedLeftSheetConfig,
  type ActivityEvent,
  type Work,
} from "@green-goods/shared";
import { useCallback, useMemo } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { SubmitWorkPanel } from "@/views/Garden/SubmitWork";
import { WorkDetailPanel } from "@/views/Garden/WorkDetail";
import { HubCertificationInspector } from "./HubCertificationInspector";
import { HubHistoryInspector } from "./HubHistoryInspector";

interface HubSheetDescriptorProps {
  routeSheetContentId: string | null;
  routeWorkId: string | undefined;
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
  canManage: boolean;
  hubContext: AdminHubRouteContext;
  closeTo: string;
  onNavigateToBase: () => void;
  onBeforeClose: () => void;
}

/**
 * Resolves which content to show in the Hub left sheet based on route and selection state.
 * Calls useLeftSheetConfig internally — render this component inside HubView.
 */
export function HubSheetDescriptor({
  routeSheetContentId,
  routeWorkId,
  activeWorkDetailId,
  selectedWork,
  selectedCertification,
  selectedHistoryEvent,
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
    if (routeSheetContentId === SUBMIT_WORK_CONTENT_ID) {
      return {
        title: formatMessage({ id: "app.admin.work.submit.title", defaultMessage: "Submit Work" }),
        content: (
          <SubmitWorkPanel
            layout="sheet"
            onSuccess={handlePanelClose}
            onCancel={handlePanelClose}
          />
        ),
      };
    }

    const resolvedWorkDetailId = routeWorkId ?? activeWorkDetailId;

    if (selectedWork && resolvedWorkDetailId) {
      return {
        title:
          selectedWork.title ??
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

    if (selectedCertification) {
      return {
        title:
          selectedCertification.title ??
          formatMessage({
            id: "app.garden.admin.assessmentFallback",
            defaultMessage: "Assessment",
          }),
        content: (
          <HubCertificationInspector
            assessment={selectedCertification}
            canMint={canManage}
            onOpenMintFlow={() => navigate(adminRoutes.hubCertifyCreate(hubContext))}
          />
        ),
      };
    }

    if (selectedHistoryEvent) {
      return {
        title: selectedHistoryEvent.title,
        content: <HubHistoryInspector event={selectedHistoryEvent} />,
      };
    }

    return null;
  }, [
    canManage,
    formatMessage,
    handlePanelClose,
    hubContext,
    navigate,
    activeWorkDetailId,
    routeSheetContentId,
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
          }
        : null,
    [closeTo, onBeforeClose, sheetDescriptor]
  );
  useRouteBackedLeftSheetConfig(routeBackedSheetConfig);

  return null;
}
