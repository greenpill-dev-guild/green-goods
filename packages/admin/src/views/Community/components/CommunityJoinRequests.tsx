import { Alert } from "@green-goods/shared/components/Alert";
import {
  useGardenJoinRequestAvailability,
  useGardenJoinRequests,
} from "@green-goods/shared/hooks/garden/useGardenJoinRequests";
import { useGardenOperations } from "@green-goods/shared/hooks/garden/useGardenOperations";
import { gardenJoinRequestErrorMessage } from "@green-goods/shared/modules/garden-join-requests";
import {
  GARDEN_JOIN_REQUEST_REASON_MAX_LENGTH,
  type GardenJoinRequestQueueItem,
  type GardenJoinRequestKind,
} from "@green-goods/shared/public-contracts/join-requests";
import type { Address } from "@green-goods/shared/types/domain";
import { formatEnsNameForDisplay } from "@green-goods/shared/utils/app/text";
import { isCancelledTxError } from "@green-goods/shared/utils/errors/tx-error-classifier";
import { RiCheckLine, RiCloseLine, RiInbox2Line } from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { AdminCard, AdminCardTitle } from "@/components/AdminCard";
import { AdminReasonDialog } from "@/components/AdminReasonDialog";
import { EnsAddressText } from "@/components/EnsAddressText";

export function CommunityJoinRequests({ gardenAddress }: { gardenAddress: Address }) {
  return (
    <>
      <CommunityJoinRequestQueue gardenAddress={gardenAddress} kind="garden_membership" />
      <CommunityJoinRequestQueue gardenAddress={gardenAddress} kind="steward_access" />
    </>
  );
}

function CommunityJoinRequestQueue({
  gardenAddress,
  kind,
}: {
  gardenAddress: Address;
  kind: GardenJoinRequestKind;
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
      const assignRole = stewardRequest ? operations.addSteward : operations.addGardener;
      const transaction = await assignRole(request.accountAddress, {
        trackMemberAnalytics: false,
      });
      if (!transaction.success) {
        if (isCancelledTxError(transaction.error)) return;
        throw new Error(
          transaction.error?.message ??
            formatMessage({
              id: stewardRequest
                ? "cockpit.community.stewardRequests.assignFailed"
                : "app.garden.joinQueue.membershipAddFailed",
            })
        );
      }
      const resolution = await join.resolveRequest(request.id, {
        action: "welcome",
        expectedRevision: request.revision,
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
        className="space-y-4"
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
            <p className="mt-1 text-body-sm text-text-sub">
              {formatMessage({
                id: stewardRequest
                  ? "cockpit.community.stewardRequests.description"
                  : "cockpit.community.joinRequests.description",
              })}
            </p>
          </div>
          <AdminButton
            variant="outlined"
            size="sm"
            loading={join.queueState.isLoading}
            onClick={() => void load()}
          >
            {formatMessage({
              id: loaded ? "app.common.refresh" : "cockpit.community.joinRequests.load",
            })}
          </AdminButton>
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
          <div className="flex items-center gap-2 rounded-[var(--m3-shape-md)] bg-bg-soft p-4 text-body-sm text-text-sub">
            <RiInbox2Line className="h-5 w-5" />
            {formatMessage({
              id: stewardRequest
                ? "cockpit.community.stewardRequests.empty"
                : "cockpit.community.joinRequests.empty",
            })}
          </div>
        ) : null}

        <AdminCard variant="outlined" density="none" className="divide-y divide-stroke-soft">
          {queue.map((request) => (
            <article
              key={request.id}
              className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between"
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
                    className="mt-1 block text-body-sm text-text-sub"
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
                  <p className="max-w-2xl whitespace-pre-wrap text-body-sm text-text-sub">
                    {request.note}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <AdminButton
                  variant="filled"
                  size="sm"
                  leadingIcon={<RiCheckLine />}
                  loading={activeId === request.id || operations.isLoading}
                  onClick={() => void welcome(request)}
                >
                  {formatMessage({
                    id: stewardRequest
                      ? "cockpit.community.stewardRequests.approve"
                      : "cockpit.community.joinRequests.welcome",
                  })}
                </AdminButton>
                <AdminButton
                  variant="outlined"
                  size="sm"
                  leadingIcon={<RiCloseLine />}
                  disabled={Boolean(activeId)}
                  onClick={() => {
                    setDeclineError(undefined);
                    setDeclining(request);
                  }}
                >
                  {formatMessage({ id: "cockpit.community.joinRequests.decline" })}
                </AdminButton>
              </div>
            </article>
          ))}
        </AdminCard>

        {join.nextCursor ? (
          <AdminButton
            variant="text"
            size="sm"
            loading={join.queueState.isLoading}
            onClick={() => void load(join.nextCursor)}
          >
            {formatMessage({ id: "app.common.loadMore" })}
          </AdminButton>
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
