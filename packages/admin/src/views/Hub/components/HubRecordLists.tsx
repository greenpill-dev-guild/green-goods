import { EmptyStateShell } from "@green-goods/shared/components/Canvas/EmptyStateShell";
import { ItemRow, ItemRowSkeleton } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import type { EASGardenAssessment } from "@green-goods/shared/types/eas-responses";
import type { HypercertRecord } from "@green-goods/shared/types/hypercerts";
import { formatReportingPeriod, normalizeTimestamp } from "@green-goods/shared/utils/time";
import { RiErrorWarningLine, RiFileList3Line, RiMedalLine, RiSearchLine } from "@remixicon/react";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { AdminButton } from "@/components/AdminButton";
import { assessmentDomainLabelId } from "../assessmentDisplay";

// The Hub's two record tabs (DL-082): the garden's assessments and its minted
// hypercerts, each record the shared item row (step 16) that opens it. Both
// list records rather than work waiting on someone, so a row carries no status
// pill and the lists differ only in what a row says: its date, then its domain
// or how many works it bundles.

export type HubAssessmentListItem = Pick<
  EASGardenAssessment,
  "id" | "title" | "description" | "domain" | "startDate" | "endDate" | "createdAt"
>;

export type HubHypercertListItem = Pick<
  HypercertRecord,
  "id" | "title" | "description" | "workScopes" | "mintedAt" | "attestationCount"
>;

interface HubRecordListStateProps {
  isLoading: boolean;
  hasDataError: boolean;
  /** The search as typed, shown back when it matches nothing. */
  searchQuery: string;
  onClearSearch: () => void;
  /** Where the tab's create flow opens; omitted for a reader who cannot create. */
  createHref?: string;
}

interface HubRecordGridProps extends Omit<HubRecordListStateProps, "createHref"> {
  isEmpty: boolean;
  /** What the tab says when the garden has none of its records yet. */
  empty: ReactNode;
  children: ReactNode;
}

function HubRecordGrid({
  isLoading,
  hasDataError,
  searchQuery,
  onClearSearch,
  isEmpty,
  empty,
  children,
}: HubRecordGridProps) {
  const { formatMessage } = useIntl();

  if (hasDataError) {
    return (
      <EmptyStateShell>
        <EmptyState
          tone="error"
          icon={<RiErrorWarningLine />}
          title={formatMessage({
            id: "cockpit.hub.error.title",
            defaultMessage: "Hub data could not be loaded",
          })}
          description={formatMessage({
            id: "cockpit.hub.error.description",
            defaultMessage: "Refresh the workspace and try again.",
          })}
        />
      </EmptyStateShell>
    );
  }

  if (isLoading) {
    return (
      // eslint-disable-next-line jsx-a11y/no-redundant-roles -- hub-workbench-grid sets list-style:none + display:grid, which drop implicit list semantics; the explicit role restores them
      <ul className="hub-workbench-grid" role="list" aria-busy="true">
        {[0, 1, 2].map((index) => (
          <li key={`hub-record-skeleton-${index}`} aria-hidden="true">
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
            { id: "cockpit.hub.noMatch", defaultMessage: 'Nothing matching "{query}"' },
            { query: searchQuery }
          )}
          action={
            <AdminButton variant="text" size="sm" onClick={onClearSearch}>
              {formatMessage({ id: "cockpit.hub.clearSearch", defaultMessage: "Clear Search" })}
            </AdminButton>
          }
        />
      </EmptyStateShell>
    );
  }

  if (isEmpty) {
    return <EmptyStateShell>{empty}</EmptyStateShell>;
  }

  return (
    // eslint-disable-next-line jsx-a11y/no-redundant-roles -- hub-workbench-grid sets list-style:none + display:grid, which drop implicit list semantics; the explicit role restores them
    <ul className="hub-workbench-grid" role="list">
      {children}
    </ul>
  );
}

function CreateRecordLink({ href, label }: { href: string; label: string }) {
  return (
    <AdminButton size="sm" variant="tonal" asChild>
      <Link to={href}>{label}</Link>
    </AdminButton>
  );
}

export interface HubAssessmentListProps extends HubRecordListStateProps {
  items: HubAssessmentListItem[];
  selectedAssessmentId: string | undefined;
  onOpenAssessment: (assessmentId: string) => void;
}

/** The Assessments tab: every assessment of the garden, each opening its record. */
export function HubAssessmentList({
  items,
  selectedAssessmentId,
  onOpenAssessment,
  createHref,
  ...state
}: HubAssessmentListProps) {
  const intl = useIntl();
  const { formatMessage, formatDate } = intl;
  const assessmentLabel = formatMessage({
    id: "app.garden.admin.assessmentFallback",
    defaultMessage: "Assessment",
  });

  return (
    <HubRecordGrid
      {...state}
      isEmpty={items.length === 0}
      empty={
        <EmptyState
          icon={<RiFileList3Line className="h-6 w-6" />}
          title={formatMessage({
            id: "cockpit.hub.assessments.empty.title",
            defaultMessage: "No assessments yet",
          })}
          description={formatMessage({
            id: "cockpit.hub.assessments.empty.description",
            defaultMessage:
              "An assessment records where the garden stands and what it aims for over a reporting period. Write one when a period opens. It is optional and never holds up a season.",
          })}
          action={
            createHref ? (
              <CreateRecordLink
                href={createHref}
                label={formatMessage({
                  id: "cockpit.hub.action.createAssessment",
                  defaultMessage: "Create Assessment",
                })}
              />
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
    </HubRecordGrid>
  );
}

export interface HubHypercertListProps extends HubRecordListStateProps {
  items: HubHypercertListItem[];
  onOpenHypercert: (hypercertId: string) => void;
}

/** The Hypercerts tab: every hypercert the garden has minted, each opening its record. */
export function HubHypercertList({
  items,
  onOpenHypercert,
  createHref,
  ...state
}: HubHypercertListProps) {
  const { formatMessage, formatDate } = useIntl();

  return (
    <HubRecordGrid
      {...state}
      isEmpty={items.length === 0}
      empty={
        <EmptyState
          icon={<RiMedalLine className="h-6 w-6" />}
          title={formatMessage({
            id: "app.hypercerts.list.empty.title",
            defaultMessage: "No hypercerts yet",
          })}
          description={formatMessage({
            id: "cockpit.hub.hypercerts.empty.description",
            defaultMessage:
              "A hypercert bundles the garden's approved work into a certificate funders can hold. Create one when a reporting period closes.",
          })}
          action={
            createHref ? (
              <CreateRecordLink
                href={createHref}
                label={formatMessage({
                  id: "cockpit.hub.action.createHypercert",
                  defaultMessage: "Create Hypercert",
                })}
              />
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
    </HubRecordGrid>
  );
}
