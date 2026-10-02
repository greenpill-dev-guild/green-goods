import type { AgentReportingCeremony } from "@green-goods/shared/hooks/agent-reporting/useAgentReportingCeremony";
import { useState } from "react";
import { useIntl } from "react-intl";

/** The exact publication, line by line, as the Agent froze it. */
export function PublicationSummary({
  resource,
  evidenceUrl,
}: {
  resource: NonNullable<AgentReportingCeremony["resource"]>;
  evidenceUrl?: (assetId: string) => string;
}) {
  const intl = useIntl();
  const lines = resource.lines.filter((line) => line.value.trim() !== "");
  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-stroke-soft-200 bg-bg-weak-50">
      <div className="border-b border-stroke-soft-200 p-4 sm:p-5">
        <p className="break-words text-sm font-medium text-primary-on-surface">
          {resource.gardenLabel}
        </p>
        <p className="mt-1 break-words text-base font-semibold leading-6 text-text-strong-950">
          {resource.title}
        </p>
      </div>
      <dl className="divide-y divide-stroke-soft-200">
        {lines.map((line) => (
          <div
            key={line.label}
            className="grid min-w-0 gap-1 px-4 py-3 @[480px]:grid-cols-[9rem_minmax(0,1fr)] @[480px]:gap-4 sm:px-5"
          >
            <dt className="break-words text-sm text-text-sub-600">{line.label}</dt>
            <dd className="min-w-0 whitespace-pre-wrap [overflow-wrap:anywhere] text-sm leading-6 text-text-strong-950">
              {line.value}
            </dd>
          </div>
        ))}
      </dl>
      {resource.evidence.length > 0 ? (
        <div className="border-t border-stroke-soft-200 p-4 sm:p-5">
          <p className="text-sm font-medium text-text-strong-950">
            {intl.formatMessage(
              {
                id: "public.reporting.review.evidence",
                defaultMessage:
                  "{count, plural, one {# photo or file} other {# photos or files}} attached",
              },
              { count: resource.evidence.length }
            )}
          </p>
          {resource.kind === "draft" ? (
            <div className="mt-3 grid min-w-0 grid-cols-2 gap-3">
              {resource.evidence.map((asset, index) => (
                <EvidencePreview
                  key={asset.assetId}
                  mime={asset.mime}
                  index={index + 1}
                  src={
                    evidenceUrl?.(asset.assetId) ??
                    `/api/messaging/media/${encodeURIComponent(asset.assetId)}`
                  }
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Only sanitized draft images use the private session-scoped media route. */
function EvidencePreview({ src, mime, index }: { src: string; mime: string; index: number }) {
  const intl = useIntl();
  const [failed, setFailed] = useState(false);
  const image = /^image\/(jpeg|png|webp)$/.test(mime);
  const label = intl.formatMessage(
    { id: "public.reporting.review.attachment", defaultMessage: "Attachment {number}" },
    { number: index }
  );
  return (
    <figure className="min-w-0">
      {image && !failed ? (
        <img
          src={src}
          alt={label}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="aspect-square w-full rounded-xl bg-bg-white-0 object-contain"
        />
      ) : null}
      <figcaption className="mt-2 text-xs leading-5 text-text-sub-600">
        {image && failed
          ? intl.formatMessage({
              id: "public.reporting.review.previewUnavailable",
              defaultMessage: "Preview unavailable. The attachment is still included.",
            })
          : label}
      </figcaption>
    </figure>
  );
}
