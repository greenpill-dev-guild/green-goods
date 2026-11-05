import { Alert } from "@green-goods/shared/components/Alert";
import { Button } from "@green-goods/shared/components/Button";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import {
  useGardenJoinRequestAvailability,
  useGardenJoinRequests,
} from "@green-goods/shared/hooks/garden/useGardenJoinRequests";
import { useGardenOperations } from "@green-goods/shared/hooks/garden/useGardenOperations";
import {
  gardenJoinRequestErrorMessage,
  welcomeGardenJoinRequest,
} from "@green-goods/shared/modules/garden-join-requests";
import {
  GARDEN_JOIN_REQUEST_REASON_MAX_LENGTH,
  type GardenJoinRequestCountGrant,
  type GardenJoinRequestKind,
  type GardenJoinRequestQueueItem,
} from "@green-goods/shared/public-contracts/join-requests";
import type { Address } from "@green-goods/shared/types/domain";
import { formatEnsNameForDisplay } from "@green-goods/shared/utils/app/text";
import { isCancelledTxError } from "@green-goods/shared/utils/errors/tx-error-classifier";
import { RiCheckLine, RiCloseLine, RiInbox2Line } from "@remixicon/react";
import { Fragment, useEffect, useState } from "react";
import { useIntl } from "react-intl";
import { AdminCard, AdminCardTitle } from "@/components/AdminCard";
import { AdminReasonDialog } from "@/components/AdminReasonDialog";
import { EnsAddressText } from "@/components/EnsAddressText";

type JoinRequestsReadHandler = (kind: GardenJoinRequestKind, waiting: number) => void;
type CountGrantHandler = (grant: GardenJoinRequestCountGrant) => void;

export function CommunityJoinRequests({
  gardenAddress,
  onRead,
  onCountGrant,
}: {
  gardenAddress: Address;
  /** Told how many wait in a queue after each read, for the Members tab's badge (DL-134). */
  onRead: JoinRequestsReadHandler;
  /** Handed the grant a signed read returns, so the badge can read the count on arrival. */
  onCountGrant: CountGrantHandler;
}) {
  // Keyed by garden: one garden's check never stands for another garden's queue.
  return (
    <Fragment key={gardenAddress}>
      <CommunityJoinRequestQueue
        gardenAddress={gardenAddress}
        kind="garden_membership"
        onRead={onRead}
        onCountGrant={onCountGrant}
      />
      <CommunityJoinRequestQueue
        gardenAddress={gardenAddress}
        kind="steward_access"
        onRead={onRead}
        onCountGrant={onCountGrant}
      />
    </Fragment>
  );
}

function CommunityJoinRequestQueue({
  gardenAddress,
  kind,
  onRead,
  onCountGrant,
}: {
  gardenAddress: Address;
  kind: GardenJoinRequestKind;
  onRead: JoinRequestsReadHandler;
  onCountGrant: CountGrantHandler;
}) {
  const { formatDate, formatMessage } = useIntl();
  const stewardRequest = kind === "steward_access";
  const isAvailable = useGardenJoinRequestAvailability(kind);
  const join = useGardenJoinRequests(gardenAddress, { kind });
  const queue = join.queue.filter((request) => (request.kind ?? "garden_membership") === kind);
  const operations = useGardenOperations(gardenAddress);
  const [loaded, setLoaded] = useState(false);
  const [activeId, setActiveId] = useState<string>();
  const [declining, setDeclining] = useState<GardenJoinRequestQueueItem>();
  const [declineError, setDeclineError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [localError, setLocalError] = useState<string>();
  const error = join.queueState.error ?? join.mutationState.error;
  const waiting = queue.length;

  // Only a finished read can say how many wait. With another page left to load,
  // this is how many the steward has seen so far.
  useEffect(() => {
    if (loaded) onRead(kind, waiting);
  }, [kind, loaded, onRead, waiting]);

  async function load(cursor?: string) {
    await join
      .loadQueue({ cursor, append: Boolean(cursor) })
      .then((response) => {
        setLoaded(true);
        if (response.countGrant) onCountGrant(response.countGrant);
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
        assignRole: stewardRequest ? operations.addSteward : operations.addGardener,
        resolveRequest: join.resolveRequest,
        failureMessage: formatMessage({
          id: stewardRequest
            ? "cockpit.community.stewardRequests.assignFailed"
            : "app.garden.joinQueue.membershipAddFailed",
        }),
      });
      const pendingRole = stewardRequest
        ? resolution.pendingOnchainRole === true
        : resolution.pendingOnchainMembership;
      setNotice(
        formatMessage({
          id: stewardRequest
            ? pendingRole
              ? "cockpit.community.stewardRequests.pending"
              : "cockpit.community.stewardRequests.confirmed"
            : pendingRole
              ? "cockpit.community.joinRequests.membershipPending"
              : "cockpit.community.joinRequests.welcomed",
        })
      );
    } catch (caught) {
      // Declining the signature is a choice, not a failure; the request stays in the queue.
      if (isCancelledTxError(caught)) return;
      setLocalError(
        caught instanceof Error
          ? caught.message
          : formatMessage({ id: "cockpit.community.joinRequests.updateFailed" })
      );
    } finally {
      setActiveId(undefined);
    }
  }

  async function decline(reason: string) {
    if (!declining) return;
    setActiveId(declining.id);
    setNotice(undefined);
    setLocalError(undefined);
    try {
      await join.resolveRequest(declining.id, {
        action: "decline",
        expectedRevision: declining.revision,
        reason,
      });
      setDeclineError(undefined);
      setDeclining(undefined);
      setNotice(formatMessage({ id: "cockpit.community.joinRequests.declined" }));
    } finally {
      setActiveId(undefined);
    }
  }

  if (!isAvailable) return null;

  return (
    <>
      <AdminCard
        variant="elevated"
        className="@container space-y-4"
        data-testid={stewardRequest ? "community-steward-requests" : "community-join-requests"}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <AdminCardTitle>
              {formatMessage({
                id: stewardRequest
                  ? "cockpit.community.stewardRequests.title"
                  : "cockpit.community.joinRequests.title",
              })}
            </AdminCardTitle>
            <p className="mt-1 type-meta text-text-sub">
              {formatMessage({
                id: stewardRequest
                  ? "cockpit.community.stewardRequests.description"
                  : "cockpit.community.joinRequests.description",
              })}
            </p>
            {stewardRequest ? null : (
              <p className="mt-1 type-meta text-text-sub">
                {formatMessage({ id: "cockpit.community.joinRequests.countNotice" })}
              </p>
            )}
          </div>
          <Button
            type="button"
            className="ml-auto"
            emphasis="secondary"
            size="compact"
            loading={join.queueState.isLoading}
            onClick={() => void load()}
          >
            {formatMessage({
              id: loaded ? "app.common.refresh" : "cockpit.community.joinRequests.load",
            })}
          </Button>
        </div>

        <div aria-live="polite" className="space-y-2">
          {notice ? <Alert variant="success">{notice}</Alert> : null}
          {join.rateLimitedRecently ? (
            <Alert variant="warning">
              {formatMessage({ id: "app.garden.joinQueue.rateLimitedNotice" })}
            </Alert>
          ) : null}
          {error || localError ? (
            <Alert variant="error">
              {error ? formatMessage(gardenJoinRequestErrorMessage(error)) : localError}
              {localError ? (
                <p className="mt-2">
                  {formatMessage({ id: "cockpit.community.joinRequests.assignmentRecovery" })}
                </p>
              ) : null}
            </Alert>
          ) : null}
        </div>

        {loaded && queue.length === 0 && !join.queueState.isLoading ? (
          <EmptyState
            placement="list"
            icon={<RiInbox2Line />}
            title={formatMessage({
              id: stewardRequest
                ? "cockpit.community.stewardRequests.empty"
                : "cockpit.community.joinRequests.empty",
            })}
          />
        ) : null}

        <AdminCard variant="outlined" density="none" className="divide-y divide-stroke-soft">
          {queue.map((request) => (
            <article
              key={request.id}
              className="flex flex-col gap-3 px-4 py-4 @[560px]:flex-row @[560px]:items-start @[560px]:justify-between"
            >
              <div className="min-w-0 space-y-2">
                <div>
                  {/* A request sent under a Green Goods name reads as the username alone. */}
                  <AdminCardTitle as="h4">
                    {formatEnsNameForDisplay(request.displayName) ?? request.displayName}
                  </AdminCardTitle>
                  <EnsAddressText address={request.accountAddress} />
                  <time
                    dateTime={request.requestedAt}
                    className="mt-1 block type-meta text-text-sub"
                  >
                    {formatMessage(
                      { id: "cockpit.community.joinRequests.requestedAt" },
                      {
                        date: formatDate(new Date(request.requestedAt), {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }),
                      }
                    )}
                  </time>
                </div>
                {request.note ? (
                  <p className="max-w-2xl whitespace-pre-wrap type-meta text-text-sub">
                    {request.note}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  emphasis="secondary"
                  size="compact"
                  leadingIcon={<RiCloseLine className="h-4 w-4" aria-hidden="true" />}
                  disabled={Boolean(activeId)}
                  onClick={() => {
                    setDeclineError(undefined);
                    setDeclining(request);
                  }}
                >
                  {formatMessage({ id: "cockpit.community.joinRequests.decline" })}
                </Button>
                <Button
                  type="button"
                  emphasis="primary"
                  size="compact"
                  leadingIcon={<RiCheckLine className="h-4 w-4" aria-hidden="true" />}
                  loading={activeId === request.id || operations.isLoading}
                  onClick={() => void welcome(request)}
                >
                  {formatMessage({
                    id: stewardRequest
                      ? "cockpit.community.stewardRequests.approve"
                      : "cockpit.community.joinRequests.welcome",
                  })}
                </Button>
              </div>
            </article>
          ))}
        </AdminCard>

        {join.nextCursor ? (
          <Button
            type="button"
            emphasis="tertiary"
            size="compact"
            loading={join.queueState.isLoading}
            onClick={() => void load(join.nextCursor)}
          >
            {formatMessage({ id: "app.common.loadMore" })}
          </Button>
        ) : null}
      </AdminCard>

      <AdminReasonDialog
        isOpen={Boolean(declining)}
        onClose={() => {
          setDeclineError(undefined);
          setDeclining(undefined);
        }}
        onConfirm={decline}
        onError={(caught) => {
          if (isCancelledTxError(caught)) return;
          setDeclineError(
            caught instanceof Error
              ? caught.message
              : formatMessage({ id: "cockpit.community.joinRequests.updateFailed" })
          );
        }}
        title={formatMessage({
          id: stewardRequest
            ? "cockpit.community.stewardRequests.declineTitle"
            : "cockpit.community.joinRequests.declineTitle",
        })}
        description={formatMessage(
          { id: "cockpit.community.joinRequests.declineDescription" },
          { name: formatEnsNameForDisplay(declining?.displayName) ?? "" }
        )}
        confirmLabel={formatMessage({ id: "cockpit.community.joinRequests.confirmDecline" })}
        reasonLabel={formatMessage({ id: "cockpit.community.joinRequests.reason" })}
        maxReasonLength={GARDEN_JOIN_REQUEST_REASON_MAX_LENGTH}
        variant="danger"
        tone="community"
        isLoading={Boolean(activeId)}
      >
        {declineError ? <Alert variant="error">{declineError}</Alert> : null}
      </AdminReasonDialog>
    </>
  );
}
