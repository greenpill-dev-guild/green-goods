import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { usePromiseGroupController } from "@green-goods/shared/hooks/client-ui/pool/usePromiseGroupController";
import { formatCommitmentUnits } from "@green-goods/shared/i18n/commitmentUnits";
import { useEffect, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { type ClaimContext, ClaimContextSheet } from "../Commitment/ClaimContextSheet";
import { CommitmentDetailState } from "../Commitment/CommitmentDetailShell";
import { JoinToAct } from "../Commitment/JoinToAct";
import { GROUP_ACT_LABEL, PromiseGroupPage } from "./PromiseGroupPage";
import { TakeUpOneSheet } from "./TakeUpOneSheet";

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
  const [sheetOpen, setSheetOpen] = useState(false);
  // On the protocol pool the person chooses who takes it up before the sheet.
  const [contextOpen, setContextOpen] = useState(false);
  const [context, setContext] = useState<ClaimContext | null>(null);
  const { state: takeUpState, reset } = controller.takeUp;
  const back = () => navigate(-1);
  const openCopy = (commitmentId: bigint) =>
    navigate(`/home/${gardenAddress}/commitments/${commitmentId.toString()}`);

  // The act landed, or is on its way from this phone: the copy's own page is next.
  const doneCopy = takeUpState.step === "done" ? takeUpState.copyId : null;
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
  const inFlight = takeUpState.step === "checking" || takeUpState.step === "sending";
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
        counts={controller.counts}
        availabilityKnown={controller.availabilityKnown}
        cap={controller.cap}
        yours={controller.yours}
        bar={controller.bar}
        isPending={inFlight}
        isOnline={controller.isOnline}
        queueUnreadable={controller.queueUnreadable}
        join={
          controller.isMember === false ? (
            <JoinToAct garden={controller.garden} isOnline={controller.isOnline} />
          ) : null
        }
        onBack={back}
        onRefresh={controller.refresh}
        onRun={() => (controller.claimNeedsContext ? setContextOpen(true) : setSheetOpen(true))}
        onOpenCopy={openCopy}
      />
      {controller.bar && controller.claimNeedsContext ? (
        <ClaimContextSheet
          open={contextOpen}
          onOpenChange={setContextOpen}
          memberGardens={controller.claimGardens.member}
          stewardedGardens={controller.claimGardens.stewarded}
          approvalGated={controller.bar.act === "askToTakeUp"}
          isPending={false}
          continueLabel={formatMessage({ id: "app.common.continue" })}
          onContinue={(chosen) => {
            setContext(chosen);
            setContextOpen(false);
            setSheetOpen(true);
          }}
        />
      ) : null}
      {controller.bar ? (
        <TakeUpOneSheet
          open={sheetOpen}
          onClose={closeSheet}
          approvalGated={controller.bar.act === "askToTakeUp"}
          actLabelId={GROUP_ACT_LABEL[controller.bar.act]}
          title={title}
          terms={[units, due].filter(Boolean).join(" · ") || null}
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
