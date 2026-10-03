import { AddressDisplay } from "@green-goods/shared/components/AddressDisplay";
import { Alert } from "@green-goods/shared/components/Alert";
import { SheetBody } from "@green-goods/shared/components/Canvas/SheetBody";
import { SheetFooter } from "@green-goods/shared/components/Canvas/SheetFooter";
import type { EASGardenAssessment } from "@green-goods/shared/types/eas-responses";
import { getEASExplorerUrl } from "@green-goods/shared/utils/eas/explorers";
import { formatReportingPeriod, normalizeTimestamp } from "@green-goods/shared/utils/time";
import {
  RiCalendarLine,
  RiExternalLinkLine,
  RiMapPinLine,
  RiPlantLine,
  RiTimeLine,
  RiUserLine,
} from "@remixicon/react";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { DetailRow } from "@/views/Garden/WorkDetail/helpers";
import { assessmentDomainLabelId } from "../assessmentDisplay";

export type HubAssessmentRecord = Pick<
  EASGardenAssessment,
  | "id"
  | "title"
  | "description"
  | "domain"
  | "startDate"
  | "endDate"
  | "location"
  | "authorAddress"
  | "createdAt"
>;

/**
 * An assessment's record as its attestation carries it: what it is about, the
 * period it covers, where, who wrote it and when. The challenge and the
 * outcomes live in the assessment's IPFS config, which the cockpit does not
 * read yet, so the record links to the attestation for the rest.
 */
export function HubAssessmentInspector({
  assessment,
  chainId,
  canMint,
  onOpenMintFlow,
}: {
  assessment: HubAssessmentRecord;
  chainId: number;
  canMint: boolean;
  onOpenMintFlow: () => void;
}) {
  const intl = useIntl();
  const { formatMessage, formatDate } = intl;
  const domainLabelId = assessmentDomainLabelId(assessment.domain);
  const period = formatReportingPeriod(intl, assessment.startDate, assessment.endDate);
  const recordedMs = normalizeTimestamp(assessment.createdAt);
  const location = assessment.location?.trim();

  return (
    <>
      <SheetBody padded={true} className="flex flex-col gap-4">
        {assessment.description ? (
          <p className="break-words body-sm text-text-sub">{assessment.description}</p>
        ) : null}

        <section className="surface-inset space-y-2 sm:p-6">
          {domainLabelId ? (
            <DetailRow
              icon={<RiPlantLine />}
              label={formatMessage({
                id: "app.admin.assessment.domainAction.domainTitle",
                defaultMessage: "Domain",
              })}
              value={formatMessage({ id: domainLabelId })}
            />
          ) : null}
          <DetailRow
            icon={<RiCalendarLine />}
            label={formatMessage({
              id: "app.garden.assessments.dateRange",
              defaultMessage: "Reporting period",
            })}
            value={
              period ??
              formatMessage({
                id: "app.garden.assessments.dateNotSet",
                defaultMessage: "Date not set",
              })
            }
          />
          {location ? (
            <DetailRow
              icon={<RiMapPinLine />}
              label={formatMessage({
                id: "app.admin.assessment.strategyKernel.locationLabel",
                defaultMessage: "Location",
              })}
              value={
                <span className="line-clamp-2 break-words" title={location}>
                  {location}
                </span>
              }
            />
          ) : null}
          <DetailRow
            icon={<RiUserLine />}
            label={formatMessage({
              id: "cockpit.hub.assessments.author",
              defaultMessage: "Written by",
            })}
            value={<AddressDisplay address={assessment.authorAddress} />}
          />
          {Number.isNaN(recordedMs) ? null : (
            <DetailRow
              icon={<RiTimeLine />}
              label={formatMessage({
                id: "cockpit.hub.assessments.recordedLabel",
                defaultMessage: "Recorded",
              })}
              value={
                <time dateTime={new Date(recordedMs).toISOString()}>
                  {formatDate(recordedMs, { dateStyle: "medium" })}
                </time>
              }
            />
          )}
        </section>

        <a
          href={getEASExplorerUrl(chainId, assessment.id)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 self-start rounded body-sm text-primary-dark transition hover:text-primary-darker focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--tone-focus-ring,var(--primary-base)))]"
        >
          {formatMessage({
            id: "app.admin.assessments.viewOnEas",
            defaultMessage: "View Assessment on EAS Explorer",
          })}
          <RiExternalLinkLine className="h-4 w-4" aria-hidden />
        </a>

        {canMint ? (
          <p className="body-sm text-text-sub">
            {formatMessage({
              id: "cockpit.hub.certify.stewardDescription",
              defaultMessage:
                "Create a hypercert from the garden's approved work. Choose this assessment there to narrow the work to its period and domain.",
            })}
          </p>
        ) : (
          <Alert variant="info">
            {formatMessage({
              id: "cockpit.hub.certify.readOnlyDescription",
              defaultMessage: "Only garden owners and stewards can create the hypercert.",
            })}
          </Alert>
        )}
      </SheetBody>

      {canMint ? (
        <SheetFooter>
          <AdminButton variant="filled" onClick={onOpenMintFlow} className="w-full justify-center">
            {formatMessage({
              id: "cockpit.hub.action.createHypercert",
              defaultMessage: "Create Hypercert",
            })}
          </AdminButton>
        </SheetFooter>
      ) : null}
    </>
  );
}
