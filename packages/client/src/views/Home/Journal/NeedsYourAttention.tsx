import {
  type CommitmentReadModel,
  useCommitmentMetadata,
} from "@green-goods/shared/commitment-pooling";
import { ItemRow } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import { IconButton } from "@green-goods/shared/components/IconButton";
import { useOnlineStatus } from "@green-goods/shared/hooks/app/useOnlineStatus";
import { useActions } from "@green-goods/shared/hooks/blockchain/useBaseLists";
import {
  type StewardDuties,
  useOpenStewardDuty,
} from "@green-goods/shared/hooks/garden/useStewardDuties";
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
import { type IntlShape, useIntl } from "react-intl";
import { formatAgo } from "@/components/Cards/Work/pendingCopy";
import { JournalSection } from "./JournalSection";

type StewardDuty = StewardDuties["duties"][number];

/** The titles a row names before its count says the rest. */
const NAMED = 2;

const DUTY_ICONS = {
  review: RiTaskLine,
  takeUp: RiUserAddLine,
  confirm: RiShieldCheckLine,
} satisfies Record<StewardDuty["kind"], unknown>;

/**
 * What a duty says, the same on its Needs Your Attention row and on the Highlights carousel's
 * duty card: its count as the title ("2 submissions to review") and its kind as the pill.
 */
export function describeStewardDuty(intl: IntlShape, duty: StewardDuty) {
  const message = (id: string) => intl.formatMessage({ id }, { count: duty.count });
  switch (duty.kind) {
    case "review":
      return {
        title: message("app.home.attention.review"),
        pill: message("app.pending.pill.toReview"),
      };
    case "takeUp":
      return {
        title: message("app.home.attention.takeUp"),
        pill: message("app.pending.pill.toReview"),
      };
    case "confirm":
      return {
        title: message("app.home.attention.confirm"),
        pill: message("app.commitments.tab.toConfirm"),
      };
  }
}

export interface NeedsYourAttentionProps {
  garden: Garden;
  /** The active garden's duties, read once by HomeJournal (`useStewardDuties(garden)`). */
  duties: StewardDuties;
}

/**
 * Needs Your Attention (PWA Home step 19, DL-127): the queues in the active garden the account
 * can act on, one row each with its count, each opening its exact queue (`useOpenStewardDuty`).
 * It appears only with something to show: a queue that waits, or a read that failed and may
 * hide one. Join requests stay in Gardeners, since their queue can be read only through a
 * signature.
 */
export function NeedsYourAttention({ garden, duties: stewardDuties }: NeedsYourAttentionProps) {
  const intl = useIntl();
  const isOnline = useOnlineStatus();
  const { duties, isError, refetch } = stewardDuties;
  const openDuty = useOpenStewardDuty(garden.id);
  const { data: actions = [] } = useActions();
  const promises = useMemo(
    () =>
      duties.flatMap((duty) =>
        duty.kind === "takeUp" ? [duty.commitment] : duty.kind === "confirm" ? duty.commitments : []
      ),
    [duties]
  );
  const { byCID } = useCommitmentMetadata(promises);

  if (duties.length === 0 && !isError) return null;

  const message = (id: string) => intl.formatMessage({ id });
  const promiseTitle = (commitment: CommitmentReadModel) =>
    (commitment.metadataCID && byCID.get(commitment.metadataCID.trim())?.title) ||
    message("app.commitments.row.untitled");
  const workTitle = (work: Work) =>
    toWorkDisplayTitle(work.title, "") ||
    findActionByUID(actions, work.actionUID)?.title ||
    message("app.workCard.untitledWork");

  // The work waiting longest leads, with how long it has waited; a promise row names its promise.
  const detailsOf = (duty: StewardDuty): [string] | [string, string] => {
    switch (duty.kind) {
      case "review":
        return [
          duty.works.slice(0, NAMED).map(workTitle).join(", "),
          formatAgo(intl, duty.works[0].createdAt * 1000),
        ];
      case "takeUp":
        return [promiseTitle(duty.commitment), formatAgo(intl, duty.newestAt * 1000)];
      case "confirm":
        return [duty.commitments.slice(0, NAMED).map(promiseTitle).join(", ")];
    }
  };

  return (
    <JournalSection
      data-component="HomeNeedsYourAttention"
      title={message("app.home.attention.title")}
    >
      {duties.map((duty) => {
        const { title, pill } = describeStewardDuty(intl, duty);
        const Icon = DUTY_ICONS[duty.kind];
        return (
          <li key={duty.kind === "takeUp" ? `takeUp:${duty.commitment.commitmentId}` : duty.kind}>
            <ItemRow
              lead={{ kind: "icon", icon: <Icon aria-hidden="true" /> }}
              title={title}
              status={{ label: pill, tone: "warning" }}
              details={detailsOf(duty)}
              onOpen={() => openDuty(duty)}
            />
          </li>
        );
      })}
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
