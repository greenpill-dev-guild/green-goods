import {
  type CommitmentReadModel,
  useCommitmentMetadata,
} from "@green-goods/shared/commitment-pooling";
import { ItemRow } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import { IconButton } from "@green-goods/shared/components/IconButton";
import { useNavigateToTop } from "@green-goods/shared/hooks/app/useNavigateToTop";
import { useOnlineStatus } from "@green-goods/shared/hooks/app/useOnlineStatus";
import { useActions } from "@green-goods/shared/hooks/blockchain/useBaseLists";
import {
  type StewardDuties,
  useStewardDuties,
} from "@green-goods/shared/hooks/garden/useStewardDuties";
import { useUIStore } from "@green-goods/shared/stores/useUIStore";
import type { Garden, Work } from "@green-goods/shared/types/domain";
import { findActionByUID } from "@green-goods/shared/utils/action/parsers";
import { toWorkDisplayTitle } from "@green-goods/shared/utils/work/workTitles";
import {
  RiErrorWarningLine,
  RiRefreshLine,
  RiShieldCheckLine,
  RiTaskLine,
  RiUserAddLine,
} from "@remixicon/react";
import { useMemo } from "react";
import { useIntl } from "react-intl";
import { formatAgo } from "@/components/Cards/Work/pendingCopy";
import { JournalSection } from "./JournalSection";

type StewardDuty = StewardDuties["duties"][number];

/** The titles a row names before its count says the rest. */
const NAMED = 2;

/**
 * Needs Your Attention (PWA Home step 19, DL-127): the queues in the active garden the account
 * can act on, one row each with its count, each opening its exact queue. Work to review opens
 * the garden's work, Pending first, until the Work sheet over Home lands (DL-128); a promise's
 * take-up requests open its page, where the claim panel decides them; promises to confirm open
 * the Promises sheet on To confirm. It appears only with something to show: a queue that waits,
 * or a read that failed and may hide one. Join requests stay in Gardeners, since their queue can
 * be read only through a signature.
 */
export function NeedsYourAttention({ garden }: { garden: Garden }) {
  const intl = useIntl();
  const navigate = useNavigateToTop();
  const isOnline = useOnlineStatus();
  const { duties, isError, refetch } = useStewardDuties(garden);
  const { data: actions = [] } = useActions();
  const openCommitmentsSheet = useUIStore((state) => state.openCommitmentsSheet);
  const promises = useMemo(
    () =>
      duties.flatMap((duty) =>
        duty.kind === "takeUp" ? [duty.commitment] : duty.kind === "confirm" ? duty.commitments : []
      ),
    [duties]
  );
  const { byCID } = useCommitmentMetadata(promises);

  if (duties.length === 0 && !isError) return null;

  const message = (id: string, values?: Record<string, number>) =>
    intl.formatMessage({ id }, values);
  const promiseTitle = (commitment: CommitmentReadModel) =>
    (commitment.metadataCID && byCID.get(commitment.metadataCID.trim())?.title) ||
    message("app.commitments.row.untitled");
  const workTitle = (work: Work) =>
    toWorkDisplayTitle(work.title, "") ||
    findActionByUID(actions, work.actionUID)?.title ||
    message("app.workCard.untitledWork");
  const toReview = { label: message("app.pending.pill.toReview"), tone: "warning" as const };

  const row = (duty: StewardDuty) => {
    switch (duty.kind) {
      case "review":
        return (
          <ItemRow
            lead={{ kind: "icon", icon: <RiTaskLine aria-hidden="true" /> }}
            title={message("app.home.attention.review", { count: duty.count })}
            status={toReview}
            // The work waiting longest leads, with how long it has waited.
            details={[
              duty.works.slice(0, NAMED).map(workTitle).join(", "),
              formatAgo(intl, duty.works[0].createdAt * 1000),
            ]}
            onOpen={() => navigate(`/home/${garden.id}`)}
          />
        );
      case "takeUp":
        return (
          <ItemRow
            lead={{ kind: "icon", icon: <RiUserAddLine aria-hidden="true" /> }}
            title={message("app.home.attention.takeUp", { count: duty.count })}
            status={toReview}
            details={[promiseTitle(duty.commitment), formatAgo(intl, duty.newestAt * 1000)]}
            onOpen={() =>
              navigate(`/home/${garden.id}/commitments/${duty.commitment.commitmentId.toString()}`)
            }
          />
        );
      case "confirm":
        return (
          <ItemRow
            lead={{ kind: "icon", icon: <RiShieldCheckLine aria-hidden="true" /> }}
            title={message("app.home.attention.confirm", { count: duty.count })}
            status={{ label: message("app.commitments.tab.toConfirm"), tone: "warning" }}
            details={[duty.commitments.slice(0, NAMED).map(promiseTitle).join(", ")]}
            onOpen={() => openCommitmentsSheet({ tab: "to-confirm" })}
          />
        );
    }
  };

  return (
    <JournalSection
      data-component="HomeNeedsYourAttention"
      title={message("app.home.attention.title")}
    >
      {duties.map((duty) => (
        <li key={duty.kind === "takeUp" ? `takeUp:${duty.commitment.commitmentId}` : duty.kind}>
          {row(duty)}
        </li>
      ))}
      {isError ? (
        <li>
          <ItemRow
            lead={{ kind: "icon", icon: <RiErrorWarningLine aria-hidden="true" /> }}
            title={message("app.home.attention.error.title")}
            details={[message("app.home.attention.error.detail")]}
            action={
              // The queues are read from the network; they read again once it is back.
              isOnline ? (
                <IconButton
                  onClick={refetch}
                  aria-label={message("app.common.tryAgain")}
                  icon={<RiRefreshLine aria-hidden="true" />}
                />
              ) : undefined
            }
          />
        </li>
      ) : null}
    </JournalSection>
  );
}
