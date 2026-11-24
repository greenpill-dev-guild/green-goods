import { AddressDisplay } from "@green-goods/shared/components/AddressDisplay";
import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import type { Work, WorkMetadata } from "@green-goods/shared/types/domain";
import { formatDateTime } from "@green-goods/shared/utils/time";
import { RiFileList3Line, RiTimeLine, RiUserLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { renderMetadataDetails } from "./helpers";

interface SubmissionDetailsProps {
  work: Work;
  gardenName: string;
  actionTitle?: string;
  actionSlug?: string;
  metadata: Partial<WorkMetadata> | null;
}

export function SubmissionDetails({
  work,
  gardenName,
  actionTitle,
  actionSlug,
  metadata,
}: SubmissionDetailsProps) {
  const { formatMessage } = useIntl();

  return (
    <section className="surface-inset sm:p-6">
      <h3 className="type-body font-semibold text-text-strong">
        {formatMessage({ id: "app.work.detail.submissionDetails" })}
      </h3>

      <FactList frame="inset" className="mt-3">
        {/* Action */}
        <FactRow
          icon={<RiFileList3Line className="h-4 w-4" />}
          label={formatMessage({ id: "app.work.detail.action" })}
          value={
            <span>
              {actionTitle ?? `Action #${work.actionUID}`}
              {actionSlug && (
                <span className="ml-1.5 type-meta text-text-soft">({actionSlug})</span>
              )}
            </span>
          }
        />

        {/* Garden */}
        <FactRow
          icon={<RiFileList3Line className="h-4 w-4" />}
          label={formatMessage({ id: "app.work.detail.garden" })}
          value={gardenName}
        />

        {/* Gardener */}
        <FactRow
          icon={<RiUserLine className="h-4 w-4" />}
          label={formatMessage({ id: "app.work.detail.gardener" })}
          value={<AddressDisplay address={work.gardenerAddress} />}
        />

        {/* Submitted at */}
        <FactRow
          icon={<RiTimeLine className="h-4 w-4" />}
          label={formatMessage({ id: "app.work.detail.submitted" })}
          // Explicit, so the fallback without Temporal also drops seconds.
          value={formatDateTime(work.createdAt, { dateStyle: "medium", timeStyle: "short" })}
        />

        {/* Metadata details (v2) */}
        {metadata && renderMetadataDetails(metadata)}
      </FactList>

      {/* Gardener feedback */}
      {work.feedback && (
        <div className="mt-3 rounded-md bg-bg-weak p-3">
          <p className="type-label-sm text-text-soft">
            {formatMessage({ id: "app.work.detail.gardenerNotes" })}
          </p>
          <p className="mt-1 type-body text-text-sub">{work.feedback}</p>
        </div>
      )}
    </section>
  );
}
