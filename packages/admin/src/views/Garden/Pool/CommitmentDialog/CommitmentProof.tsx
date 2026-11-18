import { AddressDisplay } from "@green-goods/shared/components/AddressDisplay";
import { AudioPlayer } from "@green-goods/shared/components/Audio/AudioPlayer";
import {
  type EvidenceAttributionRow,
  type ResolvedEvidence,
  useCommitmentEvidence,
} from "@green-goods/shared/commitment-pooling";
import { RiExternalLinkLine } from "@remixicon/react";
import { type IntlShape, useIntl } from "react-intl";
import { AdminCardTitle } from "@/components/AdminCard";
import { EvidenceDocumentList, EvidencePhotoGrid } from "@/components/Evidence/EvidenceMedia";

export interface CommitmentProofProps {
  /** The proof attached to the promise, as the indexer recorded each attachment. */
  attributions: readonly EvidenceAttributionRow[];
  /** The chain's own count, so proof that cannot be read is said out loud. */
  recordedCount: number;
}

/** "Added today, 10:24 AM, by 0x12…": who attached the proof, and when. */
function caption(intl: IntlShape, item: ResolvedEvidence) {
  const at = new Date(item.createdAt * 1000);
  const who = item.attacher ?? item.contributor;
  return intl.formatMessage(
    { id: "app.commitment.evidence.added" },
    {
      day: at.toDateString() === new Date().toDateString() ? "today" : "other",
      date: intl.formatDate(at, { month: "short", day: "numeric" }),
      time: intl.formatTime(at, { hour: "numeric", minute: "2-digit" }),
      by: who ? "yes" : "no",
      who: who ? (
        <AddressDisplay
          address={who}
          showCopyButton={false}
          interactive={false}
          className="inline-flex type-meta"
        />
      ) : null,
    }
  );
}

/** One proof, drawn as the work view draws work: photos, voice notes, then documents. */
function ProofItem({ item }: { item: ResolvedEvidence }) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const contents = item.isLoading ? null : item.document;
  const media = contents?.media ?? [];
  const photos = item.mediaUrls.filter((_, index) => media[index]?.kind !== "video");
  const videos = item.mediaUrls.filter((_, index) => media[index]?.kind === "video");
  const photoName = (index: number) =>
    formatMessage({ id: "app.confirm.evidence.photo" }, { index: index + 1 });

  return (
    <li className="space-y-3 border-t border-stroke-soft pt-3 first:border-t-0 first:pt-0">
      {photos.length > 0 ? (
        <EvidencePhotoGrid sources={photos} photoLabel={photoName} photoAlt={photoName} />
      ) : null}
      {videos.map((url) => (
        // eslint-disable-next-line jsx-a11y/media-has-caption -- a member's own recording has no caption track
        <video
          key={url}
          src={url}
          controls
          playsInline
          preload="metadata"
          className="w-full rounded-lg border border-stroke-soft bg-bg-weak"
        />
      ))}
      {contents
        ? item.audioUrls.map((url) => (
            <AudioPlayer key={url} src={url} compact={false} className="w-full" />
          ))
        : null}
      {contents?.documents?.length ? (
        <EvidenceDocumentList
          label={formatMessage({ id: "admin.work.documents", defaultMessage: "Documents" })}
          documents={contents.documents.map((document) => ({
            cid: document.cid,
            name: document.name,
            type: document.mime,
            size: document.size,
          }))}
        />
      ) : null}
      {contents?.note ? (
        <p className="whitespace-pre-line break-words type-body text-text-strong">
          {contents.note}
        </p>
      ) : null}
      {contents?.links?.length ? (
        <ul className="space-y-1">
          {contents.links.map((link) => (
            <li key={link.url} className="min-w-0">
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                title={link.url}
                className="inline-flex max-w-full items-center gap-1 type-label-sm text-primary-dark underline-offset-4 hover:underline"
              >
                <span className="truncate">{link.label ?? link.url}</span>
                <RiExternalLinkLine className="h-4 w-4 shrink-0" aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      <div>
        <p className="type-meta text-text-sub">{caption(intl, item)}</p>
        {item.isLoading ? (
          <p role="status" className="type-meta text-text-soft">
            {formatMessage({ id: "app.confirm.evidence.loading" })}
          </p>
        ) : !item.document ? (
          <p className="type-meta text-text-sub">
            {formatMessage({ id: "app.confirm.evidence.unreadable" })}
          </p>
        ) : null}
      </div>
    </li>
  );
}

/**
 * What the promise's proof holds, newest first, so a steward reads the proof itself
 * rather than a count of it. Each proof shows its photos, voice notes and documents
 * as the work view shows a work's, with its note, its links, and who added it when.
 * A promise with no proof renders nothing: its facts already say "none yet".
 */
export function CommitmentProof({ attributions, recordedCount }: CommitmentProofProps) {
  const { formatMessage } = useIntl();
  const { evidence: rows } = useCommitmentEvidence(attributions);
  // The indexer keeps one row per contributor a proof credits, while the chain counts the
  // proof once: one proof is one item here, whoever it credits.
  const seen = new Set<string>();
  const evidence = rows.filter((row) => !seen.has(row.cid) && Boolean(seen.add(row.cid)));

  if (recordedCount === 0 && evidence.length === 0) return null;
  const unreadable = Math.max(0, recordedCount - evidence.length);
  const title = formatMessage({
    id: "hub.garden.pool.commitment.fact.proof",
    defaultMessage: "Proof",
  });

  return (
    <section className="space-y-2" aria-label={title} data-component="CommitmentProof">
      <AdminCardTitle as="h4">{title}</AdminCardTitle>
      {evidence.length > 0 ? (
        <ol className="space-y-3">
          {evidence.map((item) => (
            <ProofItem key={item.cid} item={item} />
          ))}
        </ol>
      ) : null}
      {unreadable > 0 ? (
        <p className="type-meta text-text-sub">
          {formatMessage({ id: "app.confirm.evidence.missing" }, { count: unreadable })}
        </p>
      ) : null}
    </section>
  );
}
