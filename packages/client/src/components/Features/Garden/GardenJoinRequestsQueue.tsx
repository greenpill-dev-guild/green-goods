import { useGardenJoinRequests } from "@green-goods/shared/hooks/garden/useGardenJoinRequests";
import { useGardenOperations } from "@green-goods/shared/hooks/garden/useGardenOperations";
import {
  GARDEN_JOIN_REQUEST_REASON_MAX_LENGTH,
  type GardenJoinRequestQueueItem,
} from "@green-goods/shared/public-contracts";
import type { Address } from "@green-goods/shared/types/domain";
import { formatAddress } from "@green-goods/shared/utils/app/text";
import { RiCheckLine, RiCloseLine, RiGroupLine } from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";
import { Button } from "@/components/Actions";

export function GardenJoinRequestsQueue({ gardenAddress }: { gardenAddress: Address }) {
  const { formatMessage } = useIntl();
  const join = useGardenJoinRequests(gardenAddress);
  const operations = useGardenOperations(gardenAddress);
  const [loaded, setLoaded] = useState(false);
  const [activeId, setActiveId] = useState<string>();
  const [declining, setDeclining] = useState<GardenJoinRequestQueueItem>();
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState<string>();
  const [localError, setLocalError] = useState<string>();
  const error = join.queueState.error ?? join.mutationState.error;

  async function load(cursor?: string) {
    await join
      .loadQueue({ cursor, append: Boolean(cursor) })
      .then(() => setLoaded(true))
      .catch(() => undefined);
  }

  async function welcome(request: GardenJoinRequestQueueItem) {
    setActiveId(request.id);
    setNotice(undefined);
    setLocalError(undefined);
    try {
      const transaction = await operations.addGardener(request.accountAddress);
      if (!transaction.success) {
        throw new Error(transaction.error?.message ?? "Membership could not be added.");
      }
      const resolution = await join.resolveRequest(request.id, {
        action: "welcome",
        expectedRevision: request.revision,
      });
      setNotice(
        resolution.pendingOnchainMembership
          ? formatMessage({
              id: "app.garden.joinQueue.membershipPending",
              defaultMessage:
                "The membership transaction was submitted. Confirm again after it is visible on-chain.",
            })
          : formatMessage({
              id: "app.garden.joinQueue.welcomed",
              defaultMessage: "The gardener was welcomed.",
            })
      );
    } catch (caught) {
      setLocalError(
        caught instanceof Error
          ? caught.message
          : formatMessage({
              id: "app.garden.joinQueue.updateFailed",
              defaultMessage: "The request could not be updated.",
            })
      );
    } finally {
      setActiveId(undefined);
    }
  }

  async function declineRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!declining || !reason.trim()) return;
    setActiveId(declining.id);
    setNotice(undefined);
    setLocalError(undefined);
    try {
      await join.resolveRequest(declining.id, {
        action: "decline",
        expectedRevision: declining.revision,
        reason,
      });
      setDeclining(undefined);
      setReason("");
      setNotice(
        formatMessage({
          id: "app.garden.joinQueue.declined",
          defaultMessage: "The request was declined.",
        })
      );
    } catch {
      // The persistent hook error is rendered below.
    } finally {
      setActiveId(undefined);
    }
  }

  return (
    <section
      aria-labelledby="garden-join-requests-title"
      className="mb-6 space-y-3 rounded-[var(--radius-xl)] border border-stroke-soft-200 bg-bg-weak-50 p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="garden-join-requests-title" className="font-semibold text-text-strong-950">
            {formatMessage({
              id: "app.garden.joinQueue.title",
              defaultMessage: "Join requests",
            })}
          </h2>
          <p className="mt-1 text-sm text-text-sub-600">
            {formatMessage({
              id: "app.garden.joinQueue.description",
              defaultMessage: "Review people who asked to join this garden.",
            })}
          </p>
        </div>
        <Button
          label={formatMessage({
            id: loaded ? "app.common.refresh" : "app.garden.joinQueue.load",
            defaultMessage: loaded ? "Refresh" : "Check requests",
          })}
          variant="neutral"
          mode="stroke"
          size="small"
          isLoading={join.queueState.isLoading}
          onClick={() => void load()}
        />
      </div>

      <div aria-live="polite">
        {notice ? (
          <p className="rounded-[var(--radius-md)] bg-bg-white-0 p-3 text-sm">{notice}</p>
        ) : null}
        {error || localError ? (
          <p
            role="alert"
            className="rounded-[var(--radius-md)] bg-error-lighter p-3 text-sm text-error-dark"
          >
            {error?.message ?? localError}
          </p>
        ) : null}
      </div>

      {loaded && join.queue.length === 0 && !join.queueState.isLoading ? (
        <div className="flex items-center gap-2 rounded-[var(--radius-md)] bg-bg-white-0 p-3 text-sm text-text-sub-600">
          <RiGroupLine className="h-5 w-5" />
          {formatMessage({
            id: "app.garden.joinQueue.empty",
            defaultMessage: "There are no pending join requests.",
          })}
        </div>
      ) : null}

      <div className="space-y-3">
        {join.queue.map((request) => (
          <article
            key={request.id}
            className="space-y-3 rounded-[var(--radius-lg)] bg-bg-white-0 p-4 shadow-sm"
          >
            <div>
              <h3 className="font-semibold">{request.displayName}</h3>
              <p className="font-mono text-xs text-text-sub-600">
                {formatAddress(request.accountAddress)}
              </p>
              {request.note ? (
                <p className="mt-2 whitespace-pre-wrap text-sm text-text-sub-600">{request.note}</p>
              ) : null}
            </div>
            {declining?.id === request.id ? (
              <form className="space-y-3" onSubmit={declineRequest}>
                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold">
                    {formatMessage({
                      id: "app.garden.joinQueue.declineReason",
                      defaultMessage: "Reason for declining",
                    })}
                  </span>
                  <textarea
                    required
                    maxLength={GARDEN_JOIN_REQUEST_REASON_MAX_LENGTH}
                    rows={3}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    className="w-full rounded-[var(--radius-md)] border border-stroke-soft-200 bg-bg-white-0 px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="submit"
                    label={formatMessage({
                      id: "app.garden.joinQueue.confirmDecline",
                      defaultMessage: "Decline request",
                    })}
                    variant="error"
                    mode="filled"
                    size="small"
                    disabled={!reason.trim()}
                    isLoading={activeId === request.id}
                  />
                  <Button
                    type="button"
                    label={formatMessage({ id: "app.common.cancel", defaultMessage: "Cancel" })}
                    variant="neutral"
                    mode="stroke"
                    size="small"
                    onClick={() => {
                      setDeclining(undefined);
                      setReason("");
                    }}
                  />
                </div>
              </form>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button
                  label={formatMessage({
                    id: "app.garden.joinQueue.welcome",
                    defaultMessage: "Welcome",
                  })}
                  leadingIcon={<RiCheckLine className="h-4 w-4" />}
                  variant="primary"
                  mode="filled"
                  size="small"
                  isLoading={activeId === request.id || operations.isLoading}
                  onClick={() => void welcome(request)}
                />
                <Button
                  label={formatMessage({
                    id: "app.garden.joinQueue.decline",
                    defaultMessage: "Decline",
                  })}
                  leadingIcon={<RiCloseLine className="h-4 w-4" />}
                  variant="neutral"
                  mode="stroke"
                  size="small"
                  onClick={() => setDeclining(request)}
                />
              </div>
            )}
          </article>
        ))}
      </div>

      {join.nextCursor ? (
        <Button
          label={formatMessage({ id: "app.common.loadMore", defaultMessage: "Load more" })}
          variant="neutral"
          mode="stroke"
          size="small"
          isLoading={join.queueState.isLoading}
          onClick={() => void load(join.nextCursor)}
        />
      ) : null}
    </section>
  );
}
