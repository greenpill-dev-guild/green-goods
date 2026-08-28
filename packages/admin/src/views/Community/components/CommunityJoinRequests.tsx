import { Alert } from "@green-goods/shared/components/Alert";
import { useGardenJoinRequests } from "@green-goods/shared/hooks/garden/useGardenJoinRequests";
import { useGardenOperations } from "@green-goods/shared/hooks/garden/useGardenOperations";
import {
  GARDEN_JOIN_REQUEST_REASON_MAX_LENGTH,
  type GardenJoinRequestQueueItem,
} from "@green-goods/shared/public-contracts/join-requests";
import type { Address } from "@green-goods/shared/types/domain";
import { RiCheckLine, RiCloseLine, RiInbox2Line } from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { AdminCard } from "@/components/AdminCard";
import { AdminReasonDialog } from "@/components/AdminReasonDialog";
import { EnsAddressText } from "@/components/EnsAddressText";

export function CommunityJoinRequests({ gardenAddress }: { gardenAddress: Address }) {
  const { formatMessage } = useIntl();
  const join = useGardenJoinRequests(gardenAddress);
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
      const transaction = await operations.addGardener(request.accountAddress, {
        trackMemberAnalytics: false,
      });
      if (!transaction.success) {
        throw new Error(
          transaction.error?.message ??
            formatMessage({ id: "app.garden.joinQueue.membershipAddFailed" })
        );
      }
      const resolution = await join.resolveRequest(request.id, {
        action: "welcome",
        expectedRevision: request.revision,
      });
      setNotice(
        resolution.pendingOnchainMembership
          ? formatMessage({ id: "cockpit.community.joinRequests.membershipPending" })
          : formatMessage({ id: "cockpit.community.joinRequests.welcomed" })
      );
    } catch (caught) {
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

  return (
    <>
      <AdminCard variant="elevated" className="space-y-4" data-testid="community-join-requests">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-title-md font-semibold text-[rgb(var(--m3-on-surface))]">
              {formatMessage({ id: "cockpit.community.joinRequests.title" })}
            </h3>
            <p className="mt-1 text-body-sm text-[rgb(var(--m3-on-surface-variant))]">
              {formatMessage({ id: "cockpit.community.joinRequests.description" })}
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
          {error || localError ? (
            <Alert variant="error">{error?.message ?? localError}</Alert>
          ) : null}
        </div>

        {loaded && join.queue.length === 0 && !join.queueState.isLoading ? (
          <div className="flex items-center gap-2 rounded-[var(--m3-shape-md)] bg-[rgb(var(--m3-surface-container))] p-4 text-body-sm text-[rgb(var(--m3-on-surface-variant))]">
            <RiInbox2Line className="h-5 w-5" />
            {formatMessage({ id: "cockpit.community.joinRequests.empty" })}
          </div>
        ) : null}

        <AdminCard variant="outlined" density="none" className="divide-y divide-stroke-soft">
          {join.queue.map((request) => (
            <article
              key={request.id}
              className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0 space-y-2">
                <div>
                  <h4 className="text-title-sm font-semibold text-[rgb(var(--m3-on-surface))]">
                    {request.displayName}
                  </h4>
                  <EnsAddressText address={request.accountAddress} />
                </div>
                {request.note ? (
                  <p className="max-w-2xl whitespace-pre-wrap text-body-sm text-[rgb(var(--m3-on-surface-variant))]">
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
                  {formatMessage({ id: "cockpit.community.joinRequests.welcome" })}
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
        onError={(caught) =>
          setDeclineError(
            caught instanceof Error
              ? caught.message
              : formatMessage({ id: "cockpit.community.joinRequests.updateFailed" })
          )
        }
        title={formatMessage({ id: "cockpit.community.joinRequests.declineTitle" })}
        description={formatMessage(
          { id: "cockpit.community.joinRequests.declineDescription" },
          { name: declining?.displayName ?? "" }
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
