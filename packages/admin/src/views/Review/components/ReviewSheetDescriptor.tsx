import { Alert } from "@green-goods/shared/components/Alert";
import { SheetBody } from "@green-goods/shared/components/Canvas/SheetBody";
import { resolveReviewSheetSelection } from "@green-goods/shared/hooks/admin-ui/review/review.workbenchModel";
import type { Work } from "@green-goods/shared/types/domain";
import {
  type AdminReviewRouteContext,
  adminRoutes,
} from "@green-goods/shared/utils/navigation/admin-routes";
import { toWorkDisplayTitle } from "@green-goods/shared/utils/work/workTitles";
import { useCallback, useMemo } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { useRouteBackedLeftSheetConfig } from "@/components/Layout";
import { WorkDetailPanel } from "@/views/Garden/WorkDetail";
import { localizeCanonicalActionTitle } from "@/components/Action/actionDisplay";
import {
  ReviewAssessmentInspector,
  type ReviewAssessmentRecord,
} from "./ReviewAssessmentInspector";

interface ReviewSheetDescriptorProps {
  routeSheetContentId: string | null;
  routeWorkId: string | undefined;
  routeCertificationId: string | undefined;
  activeWorkDetailId: string | null;
  selectedWork: Work | undefined;
  /** On a Review day: works whose decisions could not be read, so none can be decided yet. */
  unknownWorkIds?: ReadonlySet<string>;
  /** On a Review day whose statuses are not read yet, or could not be read: none is known. */
  dayStatusUnread?: boolean;
  selectedCertification: ReviewAssessmentRecord | undefined;
  isResolvingSelection: boolean;
  canManage: boolean;
  chainId: number;
  reviewContext: AdminReviewRouteContext;
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
 * Resolves which content to show in Review's left sheet based on route and selection state.
 * Calls useLeftSheetConfig internally — render this component inside ReviewView.
 */
export function ReviewSheetDescriptor({
  routeWorkId,
  routeCertificationId,
  activeWorkDetailId,
  selectedWork,
  unknownWorkIds,
  dayStatusUnread = false,
  selectedCertification,
  isResolvingSelection,
  canManage,
  chainId,
  reviewContext,
  closeTo,
  onNavigateToBase,
  onBeforeClose,
}: ReviewSheetDescriptorProps) {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const handlePanelClose = useCallback(() => {
    onBeforeClose();
    onNavigateToBase();
  }, [onBeforeClose, onNavigateToBase]);

  const sheetSelection = useMemo(
    () =>
      resolveReviewSheetSelection({
        routeWorkId,
        routeCertificationId,
        activeWorkDetailId,
        hasSelectedCertification: Boolean(selectedCertification),
      }),
    [activeWorkDetailId, routeCertificationId, routeWorkId, selectedCertification]
  );

  const sheetDescriptor = useMemo(() => {
    // The create flows are not inspector sheets: ReviewFlowDialogs opens them from
    // their route items. This descriptor only resolves the read/review inspectors: a work's detail and an assessment's record, whose
    // selection keeps the "certification" name of the stage it used to open from.
    if (sheetSelection?.kind === "work") {
      return {
        title: localizeCanonicalActionTitle(
          toWorkDisplayTitle(
            selectedWork?.title,
            formatMessage({ id: "app.work.detail.reviewTitle", defaultMessage: "Review Work" })
          ),
          formatMessage
        ),
        content: (
          <WorkDetailPanel
            workId={sheetSelection.id}
            statusUnread={
              dayStatusUnread ||
              (unknownWorkIds?.has(sheetSelection.id) ?? false) ||
              // On a day, a work the day's latest read no longer lists is not vouched for.
              (unknownWorkIds !== undefined && selectedWork?.id !== sheetSelection.id)
            }
            // On a day, the day's own read of the work, which can be fresher than the garden's.
            decidedWork={
              unknownWorkIds && selectedWork?.id === sheetSelection.id ? selectedWork : undefined
            }
            layout="sheet"
            onSuccess={handlePanelClose}
          />
        ),
      };
    }

    if (sheetSelection?.kind === "certification") {
      return {
        title:
          selectedCertification?.title?.trim() ||
          formatMessage({
            id: "app.garden.admin.assessmentFallback",
            defaultMessage: "Assessment",
          }),
        content: selectedCertification ? (
          <ReviewAssessmentInspector
            assessment={selectedCertification}
            chainId={chainId}
            canMint={canManage}
            onOpenMintFlow={() => navigate(adminRoutes.reviewCertifyCreate(reviewContext))}
          />
        ) : (
          <SheetResolutionState
            isResolving={isResolvingSelection}
            loadingLabel={formatMessage({
              id: "hub.review.sheet.resolving",
              defaultMessage: "Loading selection...",
            })}
            message={formatMessage({
              id: "hub.review.sheet.assessmentNotFound",
              defaultMessage: "Assessment could not be found.",
            })}
          />
        ),
      };
    }

    return null;
  }, [
    canManage,
    chainId,
    formatMessage,
    handlePanelClose,
    reviewContext,
    isResolvingSelection,
    navigate,
    sheetSelection,
    selectedCertification,
    selectedWork,
    unknownWorkIds,
    dayStatusUnread,
  ]);

  const routeBackedSheetConfig = useMemo(
    () =>
      sheetDescriptor
        ? {
            title: sheetDescriptor.title,
            content: sheetDescriptor.content,
            closeTo,
            onBeforeClose,
            // Review deep-link inspectors carry forms and media evidence — render
            // at the richer `lg` dialog tier (QA refinement pass). `review` tone
            // keeps the steward-blue accent inside the portaled dialog.
            size: "lg" as const,
            tone: "review" as const,
          }
        : null,
    [closeTo, onBeforeClose, sheetDescriptor]
  );
  useRouteBackedLeftSheetConfig(routeBackedSheetConfig);

  return null;
}
