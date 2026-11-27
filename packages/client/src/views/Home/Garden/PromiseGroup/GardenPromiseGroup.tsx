import { useServiceAccess } from "@green-goods/shared/commitment-pooling";
import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { usePrimaryAddress } from "@green-goods/shared/hooks/auth/usePrimaryAddress";
import { useGoodDollarPrice } from "@green-goods/shared/hooks/blockchain/useGoodDollarPrice";
import {
  type PromiseGroupController,
  usePromiseGroupController,
} from "@green-goods/shared/hooks/client-ui/pool/usePromiseGroupController";
import { formatCommitmentUnits } from "@green-goods/shared/i18n/commitmentUnits";
import { getNetworkContracts } from "@green-goods/shared/utils/blockchain/contracts";
import { useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import {
  groupRewardsOf,
  promiseRewardText,
  rewardsNeedPrice,
} from "@/components/Features/Commitments";
import { type ClaimContext, ClaimContextSheet } from "../Commitment/ClaimContextSheet";
import { CommitmentDetailState } from "../Commitment/CommitmentDetailShell";
import { JoinToAct, MembershipCheckFailed } from "../Commitment/JoinToAct";
import { serviceReadOutcome } from "../Commitment/serviceBooking";
import { GROUP_ACT_LABEL, type PromiseGroupBar, PromiseGroupPage } from "./PromiseGroupPage";
import { TakeUpOneSheet } from "./TakeUpOneSheet";

/**
 * A group of service offers is booked from a copy's own page, never taken up: the chain refuses
 * the ordinary take-up on a service offer (`ServiceClaimPathRequired`, PRD-1587). A request that
 * only carries a voucher reward is still taken up, its reward agreed on the copy's page. Until
 * the copy's service read can say, or when it failed, the act waits, since it may be an offer.
 */
function groupBar(
  bar: PromiseGroupController["bar"],
  service: ReturnType<typeof serviceReadOutcome>,
  serviceOffer: boolean
): PromiseGroupBar | null {
  if (!bar || service === "ordinary") return bar;
  if (service === "service") return serviceOffer ? { act: "book", hold: bar.hold } : bar;
  return { ...bar, hold: "unknown" };
}

/** A group of promises, opened from its row on the Promises tab (PRD-1029 c2–c9). */
export function GardenPromiseGroup() {
  const intl = useIntl();
  const { formatMessage, formatDate } = intl;
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const { id: gardenAddress, groupId } = useParams<{ id: string; groupId: string }>();
  const controller = usePromiseGroupController({
    chainId: DEFAULT_CHAIN_ID,
    routeGarden: gardenAddress,
    displayGroupId: groupId,
    copyId: search.get("copy"),
  });
  // Terms are set on each copy, so the copy the act would choose, the one the chain checks, decides.
  const viewer = usePrimaryAddress();
  const readId = controller.choice ?? controller.sample?.commitmentId ?? null;
  const serviceKey = useMemo(
    () =>
      viewer && readId !== null
        ? {
            sourceChainId: DEFAULT_CHAIN_ID,
            coreModule: getNetworkContracts(DEFAULT_CHAIN_ID).commitmentPoolingModule,
            commitmentId: readId,
            buyer: viewer,
          }
        : null,
    [viewer, readId]
  );
  const serviceAccess = useServiceAccess(serviceKey);
  const service = serviceReadOutcome(serviceAccess);
  const [sheetOpen, setSheetOpen] = useState(false);
  // On the protocol pool the person chooses who takes it up before the sheet.
  const [contextOpen, setContextOpen] = useState(false);
  const [context, setContext] = useState<ClaimContext | null>(null);
  const { state: takeUpState, reset } = controller.takeUp;
  // Today's G$ price is read only for a reward whose dollars can't be read from its record.
  const { rewards, open } = controller.group
    ? groupRewardsOf(controller.group.children, controller.metadata, controller.dueClock)
    : { rewards: [], open: false };
  const price = useGoodDollarPrice({ enabled: rewardsNeedPrice(rewards) });
  const back = () => navigate(-1);
  const openCopy = (commitmentId: bigint) =>
    navigate(`/home/${gardenAddress}/commitments/${commitmentId.toString()}`);

  // The copy's page owns reward review as well as recovery of an admitted take-up.
  const doneCopy =
    takeUpState.step === "done" || takeUpState.step === "review" ? takeUpState.copyId : null;
  useEffect(() => {
    if (doneCopy === null) return;
    setSheetOpen(false);
    reset();
    navigate(`/home/${gardenAddress}/commitments/${doneCopy.toString()}`);
  }, [doneCopy, gardenAddress, navigate, reset]);

  if (
    controller.status !== "ready" ||
    !controller.group ||
    !controller.sample ||
    !controller.counts
  ) {
    const kind = controller.status === "ready" ? "notFound" : controller.status;
    return (
      <CommitmentDetailState
        kind={kind}
        onBack={back}
        onRetry={kind === "error" ? controller.refresh : undefined}
      />
    );
  }

  const { sample } = controller;
  const units = sample.unitLabel
    ? formatCommitmentUnits(intl, sample.targetUnits, sample.unitLabel)
    : null;
  const title =
    controller.metadata?.title ?? units ?? formatMessage({ id: "app.commitments.row.untitled" });
  const due = sample.dueDate
    ? `${formatMessage({ id: "app.commitment.people.due" })} ${formatDate(
        new Date(Number(sample.dueDate) * 1000),
        { month: "short", day: "numeric", year: "numeric" }
      )}`
    : null;
  // With no copy left to take up, each copy's payout stands apart, so the page gives amounts alone.
  const reward = promiseRewardText({
    intl,
    rewards,
    price: price.state,
    payout: open ? "afterKept" : "unstated",
  });
  const inFlight = takeUpState.step === "checking" || takeUpState.step === "sending";
  const bar = groupBar(controller.bar, service, serviceAccess.data?.knownService === true);
  const closeSheet = () => {
    if (inFlight) return;
    setSheetOpen(false);
    setContext(null);
    reset();
  };

  return (
    <>
      <PromiseGroupPage
        title={title}
        sample={sample}
        note={controller.metadata?.note ?? null}
        reward={reward}
        counts={controller.counts}
        // A failed service read leaves unknown only whether the act can go, so only an act waits.
        availabilityKnown={
          controller.availabilityKnown && !(controller.bar && service === "failed")
        }
        cap={controller.cap}
        yours={controller.yours}
        bar={bar}
        isPending={inFlight}
        isOnline={controller.isOnline}
        queueUnreadable={controller.queueUnreadable}
        join={
          controller.isMember === false ? (
            <JoinToAct garden={controller.garden} isOnline={controller.isOnline} />
          ) : controller.membershipUnavailable ? (
            // The read the act turns on failed: say so and offer it again, not an empty bar.
            <MembershipCheckFailed onRetry={controller.refresh} />
          ) : null
        }
        onBack={back}
        onRefresh={() => {
          controller.refresh();
          void serviceAccess.refetch();
        }}
        onRun={() => {
          if (bar?.act === "book") return openCopy(controller.choice ?? sample.commitmentId);
          if (controller.claimNeedsContext) return setContextOpen(true);
          setSheetOpen(true);
        }}
        onOpenCopy={openCopy}
      />
      {bar && bar.act !== "book" && controller.claimNeedsContext ? (
        <ClaimContextSheet
          open={contextOpen}
          onOpenChange={setContextOpen}
          memberGardens={controller.claimGardens.member}
          stewardedGardens={controller.claimGardens.stewarded}
          approvalGated={bar.act === "askToTakeUp"}
          isPending={false}
          continueLabel={formatMessage({ id: "app.common.continue" })}
          onContinue={(chosen) => {
            setContext(chosen);
            setContextOpen(false);
            setSheetOpen(true);
          }}
        />
      ) : null}
      {bar && bar.act !== "book" ? (
        <TakeUpOneSheet
          open={sheetOpen}
          onClose={closeSheet}
          approvalGated={bar.act === "askToTakeUp"}
          actLabelId={GROUP_ACT_LABEL[bar.act]}
          title={title}
          terms={[units, due].filter(Boolean).join(" · ") || null}
          reward={reward}
          state={takeUpState}
          onTakeUp={() => controller.takeUp.start(context)}
          onTakeUpNext={controller.takeUp.confirm}
          onRetry={controller.takeUp.retry}
          onRefresh={() => {
            controller.refresh();
            reset();
          }}
        />
      ) : null}
    </>
  );
}

export default GardenPromiseGroup;
