import { AddressDisplay } from "@green-goods/shared/components/AddressDisplay";
import { type ResolvedEvidence } from "@green-goods/shared/commitment-pooling";
import { RiLink, RiMicLine } from "@remixicon/react";
import { useIntl } from "react-intl";

export interface EvidencePreviewProps {
  evidence: ResolvedEvidence[];
  isLoading: boolean;
  /**
   * The chain's own count of attached proof. When the readable rows fall
   * short of it, the gap is said out loud instead of claiming nothing was
   * attached — the two numbers must never contradict each other.
   */
  recordedCount?: number;
}

/**
 * What was submitted, read-only, before anyone is asked to confirm it.
 *
 * The sheet used to show a count. A count is not proof: the person deciding
 * on chain should see the words, the photos and the voice notes that were
 * attached, or know that a document could not be read.
 */
export function EvidencePreview({ evidence, isLoading, recordedCount = 0 }: EvidencePreviewProps) {
  const { formatMessage, formatDate } = useIntl();
  const unreadable = Math.max(0, recordedCount - evidence.length);
  if (evidence.length === 0) {
    return (
      <p className="text-xs text-text-sub-600">
        {unreadable > 0
          ? formatMessage({ id: "app.confirm.evidence.missing" }, { count: unreadable })
          : formatMessage({ id: "app.confirm.evidence.none" })}
      </p>
    );
  }
  return (
    <ul className="space-y-3" aria-label={formatMessage({ id: "app.confirm.evidence.list" })}>
      {evidence.map((item) => (
        <li
          key={item.cid}
          className="space-y-2 rounded-[var(--radius-lg)] border border-stroke-soft-200 p-3"
          data-component="EvidencePreviewItem"
        >
          <div className="flex items-center justify-between gap-2 text-xs text-text-sub-600">
            {item.contributor ? (
              <AddressDisplay address={item.contributor} showCopyButton={false} />
            ) : null}
            {item.createdAt > 0 ? (
              <span>{formatDate(new Date(item.createdAt * 1000), { dateStyle: "medium" })}</span>
            ) : null}
          </div>
          {item.isLoading || isLoading ? (
            <p className="text-xs text-text-soft-400" role="status">
              {formatMessage({ id: "app.confirm.evidence.loading" })}
            </p>
          ) : !item.document ? (
            <p className="text-xs text-text-sub-600">
              {formatMessage({ id: "app.confirm.evidence.unreadable" })}
            </p>
          ) : (
            <>
              {item.document.note ? (
                <p className="text-sm text-text-strong-950">{item.document.note}</p>
              ) : null}
              {item.mediaUrls.length > 0 ? (
                <ul className="grid grid-cols-3 gap-2">
                  {item.mediaUrls.map((url, index) => {
                    const media = item.document?.media?.[index];
                    return (
                      <li key={url} className="overflow-hidden rounded-[var(--radius-md)]">
                        {media?.kind === "video" ? (
                          /* eslint-disable-next-line jsx-a11y/media-has-caption -- user-generated content */
                          <video src={url} controls className="aspect-[4/3] w-full object-cover" />
                        ) : (
                          <img
                            src={url}
                            alt={formatMessage(
                              { id: "app.confirm.evidence.photo" },
                              { index: index + 1 }
                            )}
                            className="aspect-[4/3] w-full object-cover"
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
              {item.audioUrls.map((url, index) => (
                <div key={url} className="flex items-center gap-2">
                  <RiMicLine className="h-4 w-4 shrink-0 text-text-sub-600" aria-hidden="true" />
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption -- user-generated content */}
                  <audio
                    src={url}
                    controls
                    className="min-w-0 flex-1"
                    aria-label={formatMessage(
                      { id: "app.confirm.evidence.voiceNote" },
                      { index: index + 1 }
                    )}
                  />
                </div>
              ))}
              {(item.document.links ?? []).map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-xs text-primary underline-offset-2 hover:underline"
                >
                  <RiLink className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 truncate" title={link.url}>
                    {link.label ?? link.url}
                  </span>
                </a>
              ))}
            </>
          )}
        </li>
      ))}
      {unreadable > 0 ? (
        <li className="text-xs text-text-sub-600">
          {formatMessage({ id: "app.confirm.evidence.missing" }, { count: unreadable })}
        </li>
      ) : null}
    </ul>
  );
}
