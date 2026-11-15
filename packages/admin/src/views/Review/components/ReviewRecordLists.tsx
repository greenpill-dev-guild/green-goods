import { Button } from "@green-goods/shared/components/Button";
import { EmptyStateShell } from "@green-goods/shared/components/Canvas/EmptyStateShell";
import { ItemRow, ItemRowSkeleton } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import type { ReviewOlderRecords } from "@green-goods/shared/hooks/admin-ui/review/review.workbenchModel";
import type { EASGardenAssessment } from "@green-goods/shared/types/eas-responses";
import type { HypercertRecord } from "@green-goods/shared/types/hypercerts";
import { formatReportingPeriod, normalizeTimestamp } from "@green-goods/shared/utils/time";
import { RiErrorWarningLine, RiFileList3Line, RiMedalLine, RiSearchLine } from "@remixicon/react";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { assessmentDomainLabelId } from "../assessmentDisplay";
import { ReviewShowOlder, ReviewShowOlderButton } from "./ReviewShowOlder";

// Review's two record tabs (DL-082): the garden's assessments and its minted
// hypercerts, each record the shared item row (step 16) that opens it. Both
// list records rather than work waiting on someone, so a row carries no status
// pill and the lists differ only in what a row says: its date, then its domain
// or how many works it bundles.

export type ReviewAssessmentListItem = Pick<
  EASGardenAssessment,
  "id" | "title" | "description" | "domain" | "startDate" | "endDate" | "createdAt"
>;

export type ReviewHypercertListItem = Pick<
  HypercertRecord,
  "id" | "title" | "description" | "workScopes" | "mintedAt" | "attestationCount"
>;

interface ReviewRecordListStateProps {
  isLoading: boolean;
  hasDataError: boolean;
  /** The search as typed, shown back when it matches nothing. */
  searchQuery: string;
  onClearSearch: () => void;
  /** Where the tab's create flow opens; omitted for a reader who cannot create. */
  createHref?: string;
}

interface ReviewRecordGridProps extends Omit<ReviewRecordListStateProps, "createHref"> {
  isEmpty: boolean;
  /** What the tab says when the garden has none of its records yet. */
  empty: ReactNode;
  /** The garden's next page of older records, with what the tab calls it. */
  older?: { records: ReviewOlderRecords; label: string; notLoaded: string };
  children: ReactNode;
}

function ReviewRecordGrid({
  isLoading,
  hasDataError,
  searchQuery,
  onClearSearch,
  isEmpty,
  empty,
  older,
  children,
}: ReviewRecordGridProps) {
  const { formatMessage } = useIntl();

  if (hasDataError) {
    return (
      <EmptyStateShell>
        <EmptyState
          tone="error"
          icon={<RiErrorWarningLine />}
          title={formatMessage({
            id: "hub.review.error.title",
            defaultMessage: "Review data could not be loaded",
          })}
          description={formatMessage({
            id: "hub.review.error.description",
            defaultMessage: "Refresh the workspace and try again.",
          })}
        />
      </EmptyStateShell>
    );
  }

  if (isLoading) {
    return (
      // eslint-disable-next-line jsx-a11y/no-redundant-roles -- review-workbench-grid sets list-style:none + display:grid, which drop implicit list semantics; the explicit role restores them
      <ul className="review-workbench-grid" role="list" aria-busy="true">
        {[0, 1, 2].map((index) => (
          <li key={`review-record-skeleton-${index}`} aria-hidden="true">
            <ItemRowSkeleton lead="icon" />
          </li>
        ))}
      </ul>
    );
  }

  // A search that finds nothing says so; "none yet" is true only of the whole list.
  if (isEmpty && searchQuery) {
    return (
      <EmptyStateShell>
        <EmptyState
          icon={<RiSearchLine className="h-6 w-6" />}
          title={formatMessage(
            { id: "hub.review.noMatch", defaultMessage: 'Nothing matching "{query}"' },
            { query: searchQuery }
          )}
          description={older?.notLoaded}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {older ? <ReviewShowOlderButton older={older.records} label={older.label} /> : null}
              <Button type="button" emphasis="tertiary" size="compact" onClick={onClearSearch}>
                {formatMessage({ id: "hub.review.clearSearch", defaultMessage: "Clear Search" })}
              </Button>
            </div>
          }
        />
      </EmptyStateShell>
    );
  }

  if (isEmpty) {
    return <EmptyStateShell>{empty}</EmptyStateShell>;
  }

  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/no-redundant-roles -- review-workbench-grid sets list-style:none + display:grid, which drop implicit list semantics; the explicit role restores them */}
      <ul className="review-workbench-grid" role="list">
        {children}
      </ul>
      {older ? (
        <ReviewShowOlder older={older.records} label={older.label} notLoaded={older.notLoaded} />
      ) : null}
    </>
  );
}

function CreateRecordLink({ href, label }: { href: string; label: string }) {
  return (
    <Button emphasis="secondary" size="compact" asChild>
      <Link to={href}>{label}</Link>
    </Button>
  );
}

export interface ReviewAssessmentListProps extends ReviewRecordListStateProps {
  items: ReviewAssessmentListItem[];
  selectedAssessmentId: string | undefined;
  onOpenAssessment: (assessmentId: string) => void;
}

/** The Assessments tab: every assessment of the garden, each opening its record. */
export function ReviewAssessmentList({
  items,
  selectedAssessmentId,
  onOpenAssessment,
  createHref,
  ...state
}: ReviewAssessmentListProps) {
  const intl = useIntl();
  const { formatMessage, formatDate } = intl;
  const assessmentLabel = formatMessage({
    id: "app.garden.admin.assessmentFallback",
    defaultMessage: "Assessment",
  });

  return (
    <ReviewRecordGrid
      {...state}
      isEmpty={items.length === 0}
      empty={
        <EmptyState
          icon={<RiFileList3Line className="h-6 w-6" />}
          title={formatMessage({
            id: "hub.review.assessments.empty.title",
            defaultMessage: "No assessments yet",
          })}
          description={formatMessage({
            id: "hub.review.assessments.empty.description",
            defaultMessage:
              "An assessment records where the garden stands and what it aims for over a reporting period. Write one when a period opens. It is optional and never holds up a season.",
          })}
          action={
            createHref ? (
              <span className="lg:hidden">
                <CreateRecordLink
                  href={createHref}
                  label={formatMessage({
                    id: "hub.review.action.createAssessment",
                    defaultMessage: "Create Assessment",
                  })}
                />
              </span>
            ) : undefined
          }
        />
      }
    >
      {items.map((assessment) => {
        const title = assessment.title?.trim() || assessmentLabel;
        // The date a record covers, or the day it was recorded when it covers none.
        const date =
          formatReportingPeriod(intl, assessment.startDate, assessment.endDate) ??
          formatDate(normalizeTimestamp(assessment.createdAt), { dateStyle: "medium" });
        const domainLabelId = assessmentDomainLabelId(assessment.domain);
        return (
          <li key={assessment.id} className="min-w-0">
            <ItemRow
              lead={{ kind: "icon", icon: <RiFileList3Line /> }}
              title={title}
              details={domainLabelId ? [date, formatMessage({ id: domainLabelId })] : [date]}
              selected={selectedAssessmentId === assessment.id}
              onOpen={() => onOpenAssessment(assessment.id)}
            />
          </li>
        );
      })}
    </ReviewRecordGrid>
  );
}

export interface ReviewHypercertListProps extends ReviewRecordListStateProps {
  items: ReviewHypercertListItem[];
  onOpenHypercert: (hypercertId: string) => void;
  /** The garden's next page of older hypercerts, while it has more than the list holds. */
  older?: ReviewOlderRecords;
}

/** The Hypercerts tab: every hypercert the garden has minted, each opening its record. */
export function ReviewHypercertList({
  items,
  onOpenHypercert,
  createHref,
  older,
  ...state
}: ReviewHypercertListProps) {
  const { formatMessage, formatDate } = useIntl();

  return (
    <ReviewRecordGrid
      {...state}
      older={
        older
          ? {
              records: older,
              label: formatMessage({
                id: "hub.review.hypercerts.showOlder",
                defaultMessage: "Show Older Hypercerts",
              }),
              notLoaded: formatMessage({
                id: "hub.review.hypercerts.olderNotLoaded",
                defaultMessage: "Older hypercerts aren't loaded yet.",
              }),
            }
          : undefined
      }
      isEmpty={items.length === 0}
      empty={
        <EmptyState
          icon={<RiMedalLine className="h-6 w-6" />}
          title={formatMessage({
            id: "app.hypercerts.list.empty.title",
            defaultMessage: "No hypercerts yet",
          })}
          description={formatMessage({
            id: "hub.review.hypercerts.empty.description",
            defaultMessage:
              "A hypercert bundles the garden's approved work into a certificate funders can hold. Create one when a reporting period closes.",
          })}
          action={
            createHref ? (
              <span className="lg:hidden">
                <CreateRecordLink
                  href={createHref}
                  label={formatMessage({
                    id: "hub.review.action.createHypercert",
                    defaultMessage: "Create Hypercert",
                  })}
                />
              </span>
            ) : undefined
          }
        />
      }
    >
      {items.map((hypercert) => {
        const minted = hypercert.mintedAt
          ? formatDate(hypercert.mintedAt * 1000, { dateStyle: "medium" })
          : formatMessage({
              id: "app.hypercerts.list.dateUnknown",
              defaultMessage: "Date unavailable",
            });
        const works = formatMessage(
          { id: "app.hypercerts.list.workCount" },
          { count: hypercert.attestationCount ?? 0 }
        );
        return (
          <li key={hypercert.id} className="min-w-0">
            <ItemRow
              lead={{ kind: "icon", icon: <RiMedalLine /> }}
              title={
                hypercert.title?.trim() ||
                formatMessage({
                  id: "app.hypercerts.list.fallbackTitle",
                  defaultMessage: "Untitled hypercert",
                })
              }
              details={[minted, works]}
              onOpen={() => onOpenHypercert(hypercert.id)}
            />
          </li>
        );
      })}
    </ReviewRecordGrid>
  );
}
