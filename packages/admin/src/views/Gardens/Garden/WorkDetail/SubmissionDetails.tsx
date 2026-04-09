import { AddressDisplay, formatDate, type Work, type WorkMetadata } from "@green-goods/shared";
import { RiFileList3Line, RiTimeLine, RiUserLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { DetailRow, renderMetadataDetails } from "./helpers";

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
      <h3 className="text-sm font-semibold text-text-strong">
        {formatMessage({ id: "app.work.detail.submissionDetails" })}
      </h3>

      <div className="mt-4 space-y-3">
        {/* Action */}
        <DetailRow
          icon={<RiFileList3Line className="h-4 w-4" />}
          label={formatMessage({ id: "app.work.detail.action" })}
          value={
            <span>
              {actionTitle ?? `Action #${work.actionUID}`}
              {actionSlug && <span className="ml-1.5 text-xs text-text-soft">({actionSlug})</span>}
            </span>
          }
        />

        {/* Garden */}
        <DetailRow
          icon={<RiFileList3Line className="h-4 w-4" />}
          label={formatMessage({ id: "app.work.detail.garden" })}
          value={gardenName}
        />

        {/* Gardener */}
        <DetailRow
          icon={<RiUserLine className="h-4 w-4" />}
          label={formatMessage({ id: "app.work.detail.gardener" })}
          value={<AddressDisplay address={work.gardenerAddress} />}
        />

        {/* Submitted at */}
        <DetailRow
          icon={<RiTimeLine className="h-4 w-4" />}
          label={formatMessage({ id: "app.work.detail.submitted" })}
          value={formatDate(work.createdAt)}
        />

        {/* Metadata details (v2) */}
        {metadata && renderMetadataDetails(metadata)}

        {/* Gardener feedback */}
        {work.feedback && (
          <div className="mt-3 rounded-md bg-bg-weak p-3">
            <p className="text-xs font-medium text-text-soft">
              {formatMessage({ id: "app.work.detail.gardenerNotes" })}
            </p>
            <p className="mt-1 text-sm text-text-sub">{work.feedback}</p>
          </div>
        )}
      </div>
    </section>
  );
}
