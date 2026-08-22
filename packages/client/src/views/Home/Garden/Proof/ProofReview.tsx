import { type Address, AddressDisplay, Alert, type CommitmentReadModel } from "@green-goods/shared";
import { useIntl } from "react-intl";

export interface ProofReviewProps {
  commitment: CommitmentReadModel;
  title: string;
  mediaCount: number;
  audioCount: number;
  note: string;
  links: string[];
  credited: Address[];
  isOnline: boolean;
}

/**
 * The proof's cast decides what the review says it will do.
 *
 * On an offer or garden work it feeds what the confirmer will see; on a
 * request the asker is the one who confirms; on a service it is the proof
 * itself that carries the commitment; on a steward-recorded commitment the
 * steward who recorded it reads it. Each says the consequence, not the form.
 */
function consequenceId(commitment: CommitmentReadModel): string {
  if (commitment.recordedBy && commitment.recordedBy !== commitment.creator) {
    return "app.proof.review.consequenceCaptured";
  }
  if (commitment.direction === "REQUEST") return "app.proof.review.consequenceRequest";
  if (commitment.commitmentType === "SUPPORT_SERVICE") return "app.proof.review.consequenceSupport";
  return "app.proof.review.consequenceOffer";
}

export function ProofReview({
  commitment,
  title,
  mediaCount,
  audioCount,
  note,
  links,
  credited,
  isOnline,
}: ProofReviewProps) {
  const { formatMessage } = useIntl();

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-medium text-text-strong-950">
        {formatMessage({ id: "app.proof.review.legend" })}
      </h1>

      <section className="rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-white-0 p-4">
        <p className="truncate text-sm font-medium text-text-strong-950" title={title}>
          {title}
        </p>
        <dl className="mt-3 space-y-3 text-sm">
          <div>
            <dt className="text-xs text-text-soft-400">
              {formatMessage({ id: "app.proof.review.attached" })}
            </dt>
            <dd className="mt-0.5 text-text-strong-950">
              {formatMessage(
                { id: "app.proof.review.attachedCounts" },
                { media: mediaCount, audio: audioCount, links: links.length }
              )}
            </dd>
          </div>
          {note.trim() ? (
            <div>
              <dt className="text-xs text-text-soft-400">
                {formatMessage({ id: "app.proof.details.noteLabel" })}
              </dt>
              <dd className="mt-0.5 whitespace-pre-wrap text-text-sub-600">{note.trim()}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-xs text-text-soft-400">
              {formatMessage({ id: "app.proof.details.credit" })}
            </dt>
            <dd className="mt-1 flex flex-wrap gap-2">
              {credited.map((address) => (
                <span
                  key={address}
                  className="rounded-full border border-stroke-soft-200 px-2 py-0.5 text-xs text-text-strong-950"
                >
                  <AddressDisplay address={address} />
                </span>
              ))}
            </dd>
          </div>
        </dl>
      </section>

      <p className="text-sm leading-relaxed text-text-sub-600">
        {formatMessage({ id: consequenceId(commitment) })}
      </p>

      {!isOnline ? (
        <Alert variant="warning" className="p-3">
          {formatMessage({ id: "app.proof.review.offline" })}
        </Alert>
      ) : null}

      <p className="text-xs text-text-soft-400">
        {formatMessage({ id: "app.proof.review.queues" })}
      </p>
    </div>
  );
}
