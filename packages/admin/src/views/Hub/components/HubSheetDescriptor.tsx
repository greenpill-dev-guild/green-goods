import {
  adminRoutes,
  useLeftSheetConfig,
  type LeftSheetConfig,
  type Work,
} from "@green-goods/shared";
import { useMemo } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { SubmitWorkPanel } from "@/views/Garden/SubmitWork";
import { WorkDetailPanel } from "@/views/Garden/WorkDetail";
import { SUBMIT_WORK_CONTENT_ID, type ActivityEvent } from "../hub.utils";
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
  onNavigateToBase: () => void;
  onClose: () => void;
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
  onNavigateToBase,
  onClose,
}: HubSheetDescriptorProps) {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();

  const sheetDescriptor = useMemo(() => {
    if (routeSheetContentId === SUBMIT_WORK_CONTENT_ID) {
      return {
        title: formatMessage({ id: "app.admin.work.submit.title", defaultMessage: "Submit Work" }),
        content: <SubmitWorkPanel layout="sheet" onSuccess={onNavigateToBase} onCancel={onClose} />,
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
            onSuccess={onNavigateToBase}
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
            onOpenMintFlow={() => navigate(adminRoutes.hubCertifyCreate())}
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
    navigate,
    onClose,
    onNavigateToBase,
    activeWorkDetailId,
    routeSheetContentId,
    routeWorkId,
    selectedCertification,
    selectedHistoryEvent,
    selectedWork,
  ]);

  const leftSheetConfig = useMemo<LeftSheetConfig | null>(
    () =>
      sheetDescriptor
        ? { title: sheetDescriptor.title, content: sheetDescriptor.content, onClose }
        : null,
    [sheetDescriptor, onClose]
  );
  useLeftSheetConfig(leftSheetConfig);

  return null;
}
