import { Alert } from "@green-goods/shared/components/Alert";
import { EmptyStateShell } from "@green-goods/shared/components/Canvas/EmptyStateShell";
import { WorkbenchCard } from "@green-goods/shared/components/Canvas/WorkbenchCard";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import { useLocalizedEventTime } from "@green-goods/shared/hooks/app/useLocalizedRelativeTime";
import type { EASGardenAssessment } from "@green-goods/shared/types/eas-responses";
import type { HypercertRecord } from "@green-goods/shared/types/hypercerts";
import { RiFileList3Line, RiMedalLine, RiSearchLine } from "@remixicon/react";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { AdminButton } from "@/components/AdminButton";
import { assessmentDomainLabelId, formatReportingPeriod } from "../assessmentDisplay";
import { HubWorkbenchSkeletonRows } from "./HubWorkbenchSkeletonRows";

// The Hub's two record tabs (DL-082): the garden's assessments and its minted
// hypercerts. Both list records rather than work waiting on someone, so a
// card carries no status pill and the lists differ only in what a card says.

export type HubAssessmentListItem = Pick<
  EASGardenAssessment,
  "id" | "title" | "description" | "domain" | "startDate" | "endDate" | "createdAt"
>;

export type HubHypercertListItem = Pick<
  HypercertRecord,
  "id" | "title" | "description" | "workScopes" | "mintedAt"
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
        <Alert variant="error">
          {formatMessage({
            id: "cockpit.hub.error",
            defaultMessage: "Hub data could not be loaded. Refresh the workspace and try again.",
          })}
        </Alert>
      </EmptyStateShell>
    );
  }

  if (isLoading) {
    return <HubWorkbenchSkeletonRows count={3} variant="card" />;
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
  const { formatMessage } = intl;
  const formatEventTime = useLocalizedEventTime();
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
        const domainLabelId = assessmentDomainLabelId(assessment.domain);
        const title = assessment.title?.trim();
        const period = formatReportingPeriod(intl, assessment.startDate, assessment.endDate);
        const recordedWhen = formatEventTime(assessment.createdAt);
        const recorded = recordedWhen
          ? formatMessage(
              { id: "cockpit.hub.assessments.recorded", defaultMessage: "Recorded {when}" },
              { when: recordedWhen }
            )
          : null;
        return (
          <li key={assessment.id} className="min-w-0">
            <WorkbenchCard
              // An untitled assessment is titled "Assessment", so its eyebrow
              // names the domain or stays empty rather than say it twice.
              eyebrow={
                domainLabelId ? formatMessage({ id: domainLabelId }) : title ? assessmentLabel : ""
              }
              title={title || assessmentLabel}
              description={assessment.description ?? ""}
              meta={[period, recorded].filter((value): value is string => Boolean(value))}
              leadingIcon={RiFileList3Line}
              selected={selectedAssessmentId === assessment.id}
              onClick={() => onOpenAssessment(assessment.id)}
              // A button shrinks to its content inside the list item; fill the
              // column so a short record is as wide as its neighbours.
              className="w-full"
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
      {items.map((hypercert) => (
        <li key={hypercert.id} className="min-w-0">
          <WorkbenchCard
            eyebrow={
              hypercert.mintedAt
                ? formatMessage(
                    { id: "app.hypercerts.list.mintedOn", defaultMessage: "Minted on {date}" },
                    { date: formatDate(hypercert.mintedAt * 1000, { dateStyle: "medium" }) }
                  )
                : formatMessage({
                    id: "app.hypercerts.list.dateUnknown",
                    defaultMessage: "Date unavailable",
                  })
            }
            title={
              hypercert.title?.trim() ||
              formatMessage({
                id: "app.hypercerts.list.fallbackTitle",
                defaultMessage: "Untitled hypercert",
              })
            }
            description={hypercert.description ?? ""}
            // A card summarizes: the first few distinct scopes, the rest on the record.
            meta={[...new Set(hypercert.workScopes ?? [])].slice(0, 3)}
            leadingIcon={RiMedalLine}
            onClick={() => onOpenHypercert(hypercert.id)}
            className="w-full"
          />
        </li>
      ))}
    </HubRecordGrid>
  );
}
