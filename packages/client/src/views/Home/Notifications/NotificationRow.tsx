import {
  selectCommitmentOtherParty,
  selectCommitmentSeat,
} from "@green-goods/shared/commitment-pooling";
import {
  ItemRow,
  type ItemRowDetail,
  type ItemRowLead,
  type ItemRowProps,
  type ItemRowTone,
} from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import { useLocalizedRelativeTime } from "@green-goods/shared/hooks/app/useLocalizedRelativeTime";
import { useEnsName } from "@green-goods/shared/hooks/blockchain/useEnsName";
import { useGreenGoodsEnsName } from "@green-goods/shared/hooks/ens/useGreenGoodsEnsName";
import type { GardenNotification } from "@green-goods/shared/hooks/garden/useGardenNotifications";
import { formatCommitmentUnits } from "@green-goods/shared/i18n/commitmentUnits";
import type { Address } from "@green-goods/shared/types/domain";
import { formatAddress } from "@green-goods/shared/utils/app/text";
import { toWorkDisplayTitle } from "@green-goods/shared/utils/work/workTitles";
import { RiHandHeartLine, RiSeedlingLine } from "@remixicon/react";
import { useIntl } from "react-intl";

export interface NotificationRowProps {
  notification: GardenNotification;
  /** The promise's own name, once its metadata has resolved; a work row ignores it. */
  promiseTitle?: string | null;
  onOpen: () => void;
}

/** The event as the row's one pill, and the tone its status edge takes. */
const EVENT: Record<GardenNotification["kind"], { labelId: string; tone: ItemRowTone }> = {
  workApproved: { labelId: "app.home.notifications.event.workApproved", tone: "success" },
  workRejected: { labelId: "app.home.notifications.event.workRejected", tone: "error" },
  workSubmitted: { labelId: "app.home.notifications.event.workSubmitted", tone: "warning" },
  promiseTakenUp: { labelId: "app.home.notifications.event.promiseTakenUp", tone: "success" },
  takeUpRequested: { labelId: "app.home.notifications.event.takeUpRequested", tone: "info" },
};

/** The other person in the event, when there is one: who submitted, took up or asked. */
function personOf(notification: GardenNotification): Address | null {
  switch (notification.kind) {
    case "workSubmitted":
      return notification.work.gardenerAddress;
    case "promiseTakenUp": {
      // The member made the promise; whoever took it up is the other party from their seat.
      const { commitment } = notification;
      const seat = selectCommitmentSeat({
        commitment,
        contributors: [],
        viewer: commitment.creator ?? undefined,
      });
      return selectCommitmentOtherParty({ commitment, seat });
    }
    case "takeUpRequested":
      // A garden's claim names the garden account as claimant; the steward who asked is the person.
      return notification.claim.requestedBy ?? notification.claim.claimant;
    default:
      return null;
  }
}

/**
 * One of the bell's events as the shared item row (DL-102, DL-130): the work's photo or the
 * promise's offer or request tile, the work's or the promise's name, the event as the one pill
 * with the status edge in its tone, and a detail line of who, then how long ago. A rejection
 * gives the review's feedback in the person's place, since the member is the person.
 */
export function NotificationRow({ notification, promiseTitle, onOpen }: NotificationRowProps) {
  const intl = useIntl();
  const { formatMessage, formatDate } = intl;
  const formatAge = useLocalizedRelativeTime({ style: "short" });
  const person = personOf(notification);
  // Named as the app names people: their Green Goods name, then ENS, then the short address.
  const { data: ensName } = useEnsName(person);
  const { data: greenGoodsName } = useGreenGoodsEnsName(person, { list: true });
  const personName = person
    ? formatAddress(person, { ensName: greenGoodsName || ensName, variant: "card" })
    : null;

  let lead: ItemRowLead;
  let title: string;
  let first: ItemRowDetail | null = personName;
  if ("work" in notification) {
    const { work } = notification;
    lead = { kind: "photo", src: work.media[0] };
    title = toWorkDisplayTitle(work.title, formatMessage({ id: "app.workCard.untitledWork" }));
    const feedback = work.reviewFeedback?.trim();
    if (notification.kind === "workRejected" && feedback) first = { text: feedback, tone: "error" };
    else if (notification.kind === "workApproved" && feedback) first = feedback;
  } else {
    const { commitment } = notification;
    const isRequest = commitment.direction === "REQUEST";
    lead = {
      kind: "icon",
      icon: isRequest ? <RiHandHeartLine /> : <RiSeedlingLine />,
      label: formatMessage({
        id: isRequest ? "app.commitments.row.request" : "app.commitments.row.offer",
      }),
    };
    // A promise is named by its member, counted by its units; the units stand in for a name.
    const units = commitment.unitLabel
      ? formatCommitmentUnits(intl, commitment.targetUnits, commitment.unitLabel)
      : null;
    title = promiseTitle ?? units ?? formatMessage({ id: "app.commitments.row.untitled" });
  }

  // How long ago, in the short form every detail line takes; the exact moment on hover.
  const atMs = notification.at * 1000;
  const age: ItemRowDetail = {
    text: formatAge(atMs),
    tone: "soft",
    dateTime: new Date(atMs).toISOString(),
    title: formatDate(atMs, { dateStyle: "medium", timeStyle: "short" }),
  };
  const details: ItemRowProps["details"] = first ? [first, age] : [age];
  const event = EVENT[notification.kind];

  return (
    <ItemRow
      data-component="NotificationRow"
      data-kind={notification.kind}
      lead={lead}
      title={title}
      status={{ label: formatMessage({ id: event.labelId }), tone: event.tone }}
      edge={event.tone}
      details={details}
      onOpen={onOpen}
    />
  );
}
