import { Button } from "@green-goods/shared/components/Button";
import { ImageWithFallback } from "@green-goods/shared/components/Display/ImageWithFallback";
import { Textarea } from "@green-goods/shared/components/Form/ControlPrimitives";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import {
  useGardenJoinRequestAvailability,
  useGardenJoinRequests,
  useJoinRequestCountUpdates,
} from "@green-goods/shared/hooks/garden/useGardenJoinRequests";
import { useGardenOperations } from "@green-goods/shared/hooks/garden/useGardenOperations";
import { useResolvedProfileAvatar } from "@green-goods/shared/hooks/profile/useProfileAvatar";
import {
  gardenJoinRequestErrorMessage,
  welcomeGardenJoinRequest,
} from "@green-goods/shared/modules/garden-join-requests";
import {
  GARDEN_JOIN_REQUEST_REASON_MAX_LENGTH,
  type GardenJoinRequestQueueItem,
} from "@green-goods/shared/public-contracts/join-requests";
import type { Address } from "@green-goods/shared/types/domain";
import { formatAddress, formatEnsNameForDisplay } from "@green-goods/shared/utils/app/text";
import { isCancelledTxError } from "@green-goods/shared/utils/errors/tx-error-classifier";
import { RiCheckLine, RiCloseLine, RiGroupLine, RiUserLine } from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";

/**
 * A steward's join-request queue in the Gardeners section. Reading it takes a signature, and the
 * read hands back a count grant this browser keeps, so Home's Needs Your Attention row and bell
 * can say how many wait without asking for one (PRD-1381); each answer asks for that count again.
 */
export function GardenJoinRequestsQueue({ gardenAddress }: { gardenAddress: Address }) {
  const { formatMessage } = useIntl();
  const isAvailable = useGardenJoinRequestAvailability();
  const join = useGardenJoinRequests(gardenAddress);
  const { keepCountGrant, readCountAgain } = useJoinRequestCountUpdates(gardenAddress);
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
      .then((response) => {
        setLoaded(true);
        if (response.countGrant) keepCountGrant(response.countGrant);
      })
      .catch(() => undefined);
  }

  async function welcome(request: GardenJoinRequestQueueItem) {
    setActiveId(request.id);
    setNotice(undefined);
    setLocalError(undefined);
    try {
      const resolution = await welcomeGardenJoinRequest({
        request,
        assignRole: operations.addGardener,
        resolveRequest: join.resolveRequest,
        failureMessage: formatMessage({
          id: "app.garden.joinQueue.membershipAddFailed",
          defaultMessage: "Membership could not be added.",
        }),
      });
      readCountAgain();
      setNotice(
        resolution.pendingOnchainMembership
          ? formatMessage({
              id: "app.garden.joinQueue.membershipPending",
              defaultMessage:
                "The membership transaction was sent. Confirm again in a moment, once the new role shows.",
            })
          : formatMessage({
              id: "app.garden.joinQueue.welcomed",
              defaultMessage: "The gardener was welcomed.",
            })
      );
    } catch (caught) {
      // Declining the signature is a choice, not a failure; the request stays in the queue.
      if (isCancelledTxError(caught)) return;
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
      readCountAgain();
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

  if (!isAvailable) return null;

  return (
    <section
      aria-labelledby="garden-join-requests-title"
      className="mb-6 space-y-3 rounded-[var(--radius-xl)] border border-stroke-soft-200 bg-bg-weak-50 p-4"
    >
      <div>
        {/* The queue's one control sits on its title's line at the compact size (DESIGN.pwa.md). */}
        <div className="flex min-h-8 items-center justify-between gap-3">
          <h2 id="garden-join-requests-title" className="type-title-md text-text-strong-950">
            {formatMessage({
              id: "app.garden.joinQueue.title",
              defaultMessage: "Join Requests",
            })}
          </h2>
          <Button
            type="button"
            emphasis="secondary"
            size="compact"
            className="shrink-0"
            loading={join.queueState.isLoading}
            onClick={() => void load()}
          >
            {formatMessage({
              id: loaded ? "app.common.refresh" : "app.garden.joinQueue.load",
              defaultMessage: loaded ? "Refresh" : "Check Requests",
            })}
          </Button>
        </div>
        <p className="mt-1 type-body text-text-sub-600">
          {formatMessage({
            id: "app.garden.joinQueue.description",
            defaultMessage: "Review people who asked to join this garden.",
          })}
        </p>
      </div>

      <div aria-live="polite">
        {notice ? (
          <p className="rounded-[var(--radius-md)] bg-bg-white-0 p-3 type-body">{notice}</p>
        ) : null}
        {join.rateLimitedRecently ? (
          <p
            role="status"
            className="rounded-[var(--radius-md)] bg-warning-lighter p-3 type-body text-warning-dark"
          >
            {formatMessage({
              id: "app.garden.joinQueue.rateLimitedNotice",
              defaultMessage: "Some join requests were rate-limited recently.",
            })}
          </p>
        ) : null}
        {error || localError ? (
          <p
            role="alert"
            className="rounded-[var(--radius-md)] bg-error-lighter p-3 type-body text-error-dark"
          >
            {error ? formatMessage(gardenJoinRequestErrorMessage(error)) : localError}
          </p>
        ) : null}
      </div>

      {loaded && join.queue.length === 0 && !join.queueState.isLoading ? (
        <EmptyState
          placement="list"
          icon={<RiGroupLine />}
          title={formatMessage({
            id: "app.garden.joinQueue.empty",
            defaultMessage: "There are no pending join requests.",
          })}
        />
      ) : null}

      <div className="space-y-3">
        {join.queue.map((request) => (
          <article
            key={request.id}
            className="space-y-3 rounded-[var(--radius-lg)] bg-bg-white-0 p-4 shadow-sm"
          >
            <JoinRequestPerson request={request} />
            {request.note ? (
              <p className="whitespace-pre-wrap type-body text-text-sub-600">{request.note}</p>
            ) : null}
            {declining?.id === request.id ? (
              <form className="space-y-3" onSubmit={declineRequest}>
                <label className="block space-y-1.5">
                  <span className="type-label">
                    {formatMessage({
                      id: "app.garden.joinQueue.declineReason",
                      defaultMessage: "Reason for declining",
                    })}
                  </span>
                  <Textarea
                    required
                    maxLength={GARDEN_JOIN_REQUEST_REASON_MAX_LENGTH}
                    rows={3}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    tone="danger"
                    size="compact"
                    type="submit"
                    disabled={!reason.trim()}
                    loading={activeId === request.id}
                  >
                    {formatMessage({
                      id: "app.garden.joinQueue.confirmDecline",
                      defaultMessage: "Decline Request",
                    })}
                  </Button>
                  <Button
                    emphasis="secondary"
                    size="compact"
                    type="button"
                    onClick={() => {
                      setDeclining(undefined);
                      setReason("");
                    }}
                  >
                    {formatMessage({ id: "app.common.cancel", defaultMessage: "Cancel" })}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="compact"
                  leadingIcon={<RiCheckLine className="h-4 w-4" />}
                  loading={activeId === request.id || operations.isLoading}
                  onClick={() => void welcome(request)}
                >
                  {formatMessage({
                    id: "app.garden.joinQueue.welcome",
                    defaultMessage: "Welcome",
                  })}
                </Button>
                <Button
                  type="button"
                  emphasis="secondary"
                  size="compact"
                  leadingIcon={<RiCloseLine className="h-4 w-4" />}
                  onClick={() => setDeclining(request)}
                >
                  {formatMessage({
                    id: "app.garden.joinQueue.decline",
                    defaultMessage: "Decline",
                  })}
                </Button>
              </div>
            )}
          </article>
        ))}
      </div>

      {join.nextCursor ? (
        <Button
          type="button"
          emphasis="secondary"
          size="compact"
          loading={join.queueState.isLoading}
          onClick={() => void load(join.nextCursor)}
        >
          {formatMessage({ id: "app.common.loadMore", defaultMessage: "Load More" })}
        </Button>
      ) : null}
    </section>
  );
}

/** The app's own picture for someone who has no photo, as the Gardeners list shows it. */
const DEFAULT_AVATAR = "/images/avatar.png";

/**
 * Who asked, read as a person reads in the Gardeners list: their photo, their name, then their
 * short address and the day they asked, each on its own line so neither drops at 375px; the
 * time of day shows on hover. The name takes the roster row's card title (15px in the app), under
 * the queue's 18px section heading.
 */
function JoinRequestPerson({ request }: { request: GardenJoinRequestQueueItem }) {
  const { formatDate, formatMessage } = useIntl();
  // The queue's rows read their photos together, on the batch route, as the roster's rows do.
  const avatar = useResolvedProfileAvatar(request.accountAddress, DEFAULT_AVATAR, undefined, {
    list: true,
  });
  // A request sent under a Green Goods name reads as the username alone.
  const name = formatEnsNameForDisplay(request.displayName) ?? request.displayName;
  const requestedAt = new Date(request.requestedAt);
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        className="relative block size-14 shrink-0 overflow-hidden rounded-full bg-bg-soft-200"
        aria-hidden="true"
      >
        <ImageWithFallback
          src={avatar.avatarUri ?? DEFAULT_AVATAR}
          alt=""
          fallbackIcon={RiUserLine}
          className="absolute inset-0 h-full w-full object-cover"
          fallbackClassName="absolute inset-0 h-full w-full"
        />
      </span>
      <div className="flex min-w-0 flex-col">
        <h3 className="truncate type-card-title text-text-strong-950" title={name}>
          {name}
        </h3>
        <p
          className="truncate font-mono type-meta text-text-sub-600"
          title={request.accountAddress}
        >
          {formatAddress(request.accountAddress)}
        </p>
        <time
          dateTime={request.requestedAt}
          title={formatDate(requestedAt, { dateStyle: "medium", timeStyle: "short" })}
          className="truncate type-meta text-text-sub-600"
        >
          {formatMessage(
            { id: "app.garden.joinQueue.requestedAt", defaultMessage: "Requested {date}" },
            { date: formatDate(requestedAt, { dateStyle: "medium" }) }
          )}
        </time>
      </div>
    </div>
  );
}
