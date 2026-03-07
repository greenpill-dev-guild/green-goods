import {
  type Action,
  formatDate,
  type Garden,
  type Work,
  type WorkMetadata,
} from "@green-goods/shared";
import { RiFileList3Line, RiTimeLine, RiUserLine } from "@remixicon/react";
import { useIntl } from "react-intl";

import { AddressDisplay } from "@/components/AddressDisplay";

interface WorkSubmissionDetailsProps {
  work: Work;
  garden: Garden;
  action: Action | undefined;
  metadata: Partial<WorkMetadata> | null;
}

export function WorkSubmissionDetails({
  work,
  garden,
  action,
  metadata,
}: WorkSubmissionDetailsProps): React.ReactNode {
  const { formatMessage } = useIntl();

  return (
    <section className="rounded-lg border border-stroke-soft bg-bg-white p-4 shadow-sm sm:p-6">
      <h3 className="text-sm font-semibold text-text-strong">
        {formatMessage({ id: "app.work.detail.submissionDetails" })}
      </h3>

      <div className="mt-4 space-y-3">
        <DetailRow
          icon={<RiFileList3Line className="h-4 w-4" />}
          label={formatMessage({ id: "app.work.detail.action" })}
          value={
            <span>
              {action?.title ?? `Action #${work.actionUID}`}
              {action?.slug && (
                <span className="ml-1.5 text-xs text-text-soft">({action.slug})</span>
              )}
            </span>
          }
        />

        <DetailRow
          icon={<RiFileList3Line className="h-4 w-4" />}
          label={formatMessage({ id: "app.work.detail.garden" })}
          value={garden.name}
        />

        <DetailRow
          icon={<RiUserLine className="h-4 w-4" />}
          label={formatMessage({ id: "app.work.detail.gardener" })}
          value={<AddressDisplay address={work.gardenerAddress} />}
        />

        <DetailRow
          icon={<RiTimeLine className="h-4 w-4" />}
          label={formatMessage({ id: "app.work.detail.submitted" })}
          value={formatDate(work.createdAt)}
        />

        {metadata && <MetadataEntries metadata={metadata} />}

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

interface DetailRowProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}

function DetailRow({ icon, label, value }: DetailRowProps): React.ReactNode {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex-shrink-0 text-text-soft">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-text-soft">{label}</p>
        <div className="mt-0.5 text-sm text-text-strong">{value}</div>
      </div>
    </div>
  );
}

interface MetadataEntriesProps {
  metadata: Partial<WorkMetadata>;
}

function MetadataEntries({ metadata }: MetadataEntriesProps): React.ReactNode {
  const entries: Array<{ label: string; value: string }> = [];

  if (metadata.timeSpentMinutes) {
    entries.push({ label: "Time Spent", value: `${metadata.timeSpentMinutes} min` });
  }

  if (metadata.actionSlug) {
    entries.push({ label: "Action Slug", value: metadata.actionSlug });
  }

  if (metadata.tags && metadata.tags.length > 0) {
    entries.push({ label: "Tags", value: metadata.tags.join(", ") });
  }

  if (metadata.details) {
    for (const [key, val] of Object.entries(metadata.details)) {
      if (val !== null && val !== undefined && val !== "") {
        const label = key
          .replace(/([A-Z])/g, " $1")
          .replace(/^./, (s) => s.toUpperCase())
          .trim();
        entries.push({
          label,
          value: Array.isArray(val) ? val.join(", ") : String(val),
        });
      }
    }
  }

  if (entries.length === 0) return null;

  return (
    <>
      {entries.map((entry) => (
        <div key={entry.label} className="flex items-start gap-3">
          <div className="mt-0.5 flex-shrink-0 text-text-soft">
            <RiFileList3Line className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-text-soft">{entry.label}</p>
            <p className="mt-0.5 text-sm text-text-strong">{entry.value}</p>
          </div>
        </div>
      ))}
    </>
  );
}
