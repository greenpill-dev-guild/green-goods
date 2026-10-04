import { Alert } from "@green-goods/shared/components/Alert";
import { usePoolConsoleController } from "@green-goods/shared/hooks/admin-ui/pool/usePoolConsoleController";
import {
  type SeedCopyBuilder,
  selectSeedSetCapacity,
  useSeedTray,
  useSeedTrayRoom,
} from "@green-goods/shared/hooks/admin-ui/pool/useSeedTray";
import { useDirtyClose } from "@green-goods/shared/hooks/admin-ui/useDirtyClose";
import { useActions, useGardens } from "@green-goods/shared/hooks/blockchain/useBaseLists";
import { useGoodDollarPrice } from "@green-goods/shared/hooks/blockchain/useGoodDollarPrice";
import {
  buildCommitmentCreationPayload,
  useCommitmentComposerForm,
  useCommitmentComposerSession,
} from "@green-goods/shared/hooks/commitment-pooling/useCommitmentComposerForm";
import { useCommitmentJobs } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentJobs";
import { useComposeAgainValues } from "@green-goods/shared/hooks/commitment-pooling/useComposeAgainValues";
import { useProtocolPool } from "@green-goods/shared/hooks/commitment-pooling/useProtocolPool";
import { useSettlementAccount } from "@green-goods/shared/hooks/commitment-pooling/useSettlementQueries";
import { useStepFocus } from "@green-goods/shared/hooks/utils/useStepFocus";
import { useTimeout } from "@green-goods/shared/hooks/utils/useTimeout";
import type { Address } from "@green-goods/shared/types/domain";
import { msUntilActionWindowChange } from "@green-goods/shared/utils/action/window";
import { type ReactNode, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useFieldArray } from "react-hook-form";
import { useIntl } from "react-intl";
import { ADMIN_FLOW_DIALOG_CLASS, AdminDialog } from "@/components/AdminDialog";
import { DiscardChangesDialog } from "@/components/DiscardChangesDialog";
import { ActionFlowShell } from "@/components/Layout/ActionFlowShell";
import { FlowStepHeader } from "@/components/Layout/FlowStepHeader";
import { cycleName } from "../poolPresentation";
import { GardenPoolTarget } from "../PoolTarget";
import { SeedFlowFooter } from "./SeedFlowFooter";
import { SeedStepHowMuch } from "./SeedStepHowMuch";
import { SeedStepProof } from "./SeedStepProof";
import { SeedStepReview } from "./SeedStepReview";
import { SeedStepWhat } from "./SeedStepWhat";
import {
  needsGoodDollarPrice,
  priceUnavailableReason,
  rewardAmountAtCreate,
  withoutExternalReward,
} from "./seedReward";
import { seedStatusView } from "./seedStatus";
import {
  buildSeedCycleOptions,
  buildSeedStepConfigs,
  closedSeedActionMessage,
  closedSeedActions,
  type SeedFieldError,
  seedBlockedReason,
  seedErrorText,
  seedMembers,
  STEPS,
  type StepId,
  stepFieldsFor,
} from "./seedStepModel";

export interface SeedCommitmentDialogProps {
  open: boolean;
  chainId: number;
  garden: Address;
  onClose: () => void;
  /** A commitment in this pool to start from (Seed More Like This, as a new group). */
  fromCommitmentId?: bigint | null;
}

/**
 * Seed Promises: the steward's flow for creating one or many separate promises
 * in the pool (PRD-1022 screens 01–12). Each answer can make several copies,
 * each taken up, proven and confirmed on its own; a wallet that can bundle is
 * asked once per ten, any other once per copy.
 */
export function SeedCommitmentDialog({
  open,
  chainId,
  garden,
  onClose,
  fromCommitmentId = null,
}: SeedCommitmentDialogProps) {
  const { formatMessage } = useIntl();
  const noteId = useId();
  // The Promises tab stays mounted behind this flow and owns the visit.
  const pool = usePoolConsoleController({ chainId, garden, visit: "join" });
  // Seeding into the protocol pool (the Green Goods Community Garden's own):
  // requests default to steward review. The pool says which it is, so the
  // context holds wherever the flow is opened from.
  const protocolContext = pool.pool?.poolType === "PROTOCOL";
  const protocolPool = useProtocolPool({ chainId });
  const settlement = useSettlementAccount({ chainId, garden });
  const { data: actions = [] } = useActions(chainId);
  const { data: gardens } = useGardens(chainId);
  const [windowNow, setWindowNow] = useState(() => Date.now());
  const now = Math.max(windowNow, Date.now());
  const { set: setWindowTimer, clear: clearWindowTimer } = useTimeout();
  useEffect(() => {
    if (!open) return clearWindowTimer;
    const delay = msUntilActionWindowChange(actions, Date.now());
    if (delay !== null) setWindowTimer(() => setWindowNow(Date.now()), delay);
    return clearWindowTimer;
  }, [open, actions, windowNow, setWindowTimer, clearWindowTimer]);
  const jobs = useCommitmentJobs({ chainId });
  const [stepIndex, setStepIndex] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const stepRef = useStepFocus<HTMLDivElement>(stepIndex);

  // The season and the protocol pool arrive with their queries, so these are
  // not all known on a cold load; useCommitmentComposerSession carries the late
  // ones onto the untouched fields. Seeding more like an earlier promise starts
  // from its answers, which arrive late the same way.
  const again = useComposeAgainValues({
    chainId,
    fromCommitmentId,
    composer: "steward",
    viewer: jobs.viewer,
    poolId: pool.poolId,
  });
  const initial = useMemo(
    () => ({
      kind: "SEASON_CAMPAIGN" as const,
      direction: "OFFER" as const,
      cycleId: pool.model.season ? pool.model.season.cycleId.toString() : "0",
      claimMode: (protocolContext ? "APPROVAL_GATED" : "OPEN") as "APPROVAL_GATED" | "OPEN",
      protocolFallbackEnabled: protocolPool.isRegistered,
      ...withoutExternalReward(again),
    }),
    [pool.model.season, protocolContext, protocolPool.isRegistered, again]
  );
  const form = useCommitmentComposerForm(initial);
  const requirements = useFieldArray({ control: form.control, name: "requirements" });
  const values = form.watch();
  const protocolRegistered = protocolPool.isRegistered;
  // Parking a row before the season and the protocol pool land would send it
  // with no cycle, or with the fallback off, when the steward chose neither.
  const poolDefaultsPending = pool.isLoading || protocolPool.isLoading;
  const settlementActive = Boolean(settlement.detail?.account?.active);
  const price = useGoodDollarPrice({ enabled: open && settlementActive });
  // The rate read just before this Create: each copy's G$ amount is fixed from it.
  const createPrice = useRef<bigint | null>(null);

  // A copy of an answer, built once at its first Create and sent as it is by
  // every retry: its own id, the set's deadline and group, and G$ converted
  // from the dollars at the rate read for this Create.
  const buildCopy: SeedCopyBuilder = (row, copy) => {
    if (pool.poolId === undefined || !jobs.viewer) throw new Error("No pool or viewer to seed as");
    if (closedSeedActions(row, actions, chainId, Date.now()).length > 0)
      throw new Error("A required action has closed before this promise could be created");
    const answers = protocolRegistered ? row : { ...row, protocolFallbackEnabled: false };
    return buildCommitmentCreationPayload({
      values: { ...answers, considerationAmount: rewardAmountAtCreate(row, createPrice.current) },
      clientCommitmentId: copy.clientCommitmentId,
      poolId: pool.poolId,
      creator: jobs.viewer,
      gardenAddress: garden,
      nowSeconds: Math.floor(Date.now() / 1000),
      dueDate: copy.dueDate,
      ...(copy.displayGroup ? { displayGroup: copy.displayGroup } : {}),
      allowGatedOffers: true,
    });
  };
  const tray = useSeedTray({ form, chainId, owner: jobs.viewer, buildCopy });

  const unlockedRows = [
    ...(tray.currentLocked ? [] : [values]),
    ...tray.others.filter((row) => !tray.isLocked(row.clientCommitmentId)).map((row) => row.values),
  ];
  const priceNeeded = needsGoodDollarPrice(unlockedRows);
  const closedActionMessage = closedSeedActionMessage({
    rows: unlockedRows,
    actions,
    chainId,
    now,
    formatMessage,
  });
  const room = useSeedTrayRoom({
    chainId,
    poolId: pool.poolId,
    cap: pool.pool?.providerOpenCommitmentCap,
    viewer: jobs.viewer,
    pendingCreates: pool.pendingCreates,
  });
  const capacity = selectSeedSetCapacity({
    room,
    rows: [...tray.others.map((row) => row.values), values],
    placed: tray.placedOffers,
  });
  const cap = pool.pool ? Number(pool.pool.providerOpenCommitmentCap) : null;
  const members = useMemo(
    () => seedMembers(gardens?.find((entry) => entry.id.toLowerCase() === garden.toLowerCase())),
    [gardens, garden]
  );

  const grouped = [values, ...tray.others.map((row) => row.values)].some(
    (row) => (row.count ?? 1) > 1
  );
  const status = seedStatusView({
    mode: tray.mode,
    isSending: tray.isSending,
    copies: tray.copies,
    pass: tray.pass,
    total: tray.size,
    grouped,
    formatMessage,
  });
  const busy = tray.isSending;
  const finished = status.phase === "created" || status.phase === "finishLater";
  // Closing loses only answers that exist nowhere else: a copy left in the
  // queue is finished from the Promises tab.
  const answersAtStake =
    !finished &&
    (tray.copies === null ||
      tray.copies.some((copy) => copy.status === "not-sent" && copy.jobId === null));

  const dirtyClose = useDirtyClose({
    isDirty:
      open &&
      answersAtStake &&
      (form.formState.isDirty || tray.others.length > 0 || tray.copies !== null),
    onClose,
    blockRouteChange: true,
    preventRouteChange: busy,
  });

  const restart = () => {
    setStepIndex(0);
    setSubmitError(null);
    tray.restart();
  };
  // This dialog stays mounted while `open` toggles, so a cancelled or seeded
  // attempt would otherwise be resumed — and created a second time.
  useCommitmentComposerSession({
    form,
    open,
    sessionKey: `${chainId}:${garden}:${fromCommitmentId ?? "new"}`,
    initial,
    onRestart: restart,
  });

  const cycleOptions = useMemo(
    () =>
      buildSeedCycleOptions({
        season: pool.model.season,
        campaigns: pool.model.campaigns,
        cycleNames: pool.cycleNames,
        formatMessage,
      }),
    [pool.model.season, pool.model.campaigns, pool.cycleNames, formatMessage]
  );
  const stepConfigs = useMemo(() => buildSeedStepConfigs(formatMessage), [formatMessage]);
  const currentStep = STEPS[stepIndex] ?? "review";
  const isLast = stepIndex === STEPS.length - 1;
  const title = formatMessage({
    id: "cockpit.garden.pool.seed.promisesTitle",
    defaultMessage: "Seed Promises",
  });

  const goNext = useCallback(async () => {
    const valid = await form.trigger(stepFieldsFor(currentStep, form.getValues("kind")));
    if (valid && !closedSeedActions(form.getValues(), actions, chainId, Date.now()).length)
      setStepIndex((index) => index + 1);
  }, [form, currentStep, actions, chainId]);

  const create = async () => {
    setSubmitError(null);
    if (pool.poolId === undefined || !jobs.viewer) {
      setSubmitError(
        formatMessage({
          id: "cockpit.garden.pool.seed.noPoolOrViewer",
          defaultMessage: "Sign in and choose a garden with a pool before seeding.",
        })
      );
      return;
    }
    if (priceNeeded) {
      try {
        createPrice.current = (await price.readNow()).price;
      } catch {
        setSubmitError(
          priceUnavailableReason({ status: "unavailable", reason: "missing" }, formatMessage)
        );
        return;
      }
    }
    const outcome = await tray.sendAll();
    if (outcome === "invalid") setStepIndex(0);
    if (outcome === "blocked") {
      setSubmitError(
        formatMessage({
          id: "cockpit.garden.pool.seed.blocked.build",
          defaultMessage:
            "One of these couldn't be prepared, so nothing was sent. Check its answers, then try again.",
        })
      );
    }
  };

  // Both moves hand the form another answer, which starts again from the first
  // step. Answers that break a rule move nothing, and the first step is where they show.
  const startRow = async (move: () => Promise<void>) => {
    setSubmitError(null);
    await move();
    setStepIndex(0);
  };

  const errorOf: SeedFieldError = (field) => {
    const message = form.formState.errors[field]?.message as string | undefined;
    return message === undefined ? undefined : seedErrorText(message, formatMessage);
  };

  let body: ReactNode;
  switch (currentStep) {
    case "what":
      body = (
        <SeedStepWhat
          form={form}
          values={values}
          noteId={noteId}
          busy={busy}
          errorOf={errorOf}
          cycleOptions={cycleOptions}
        />
      );
      break;
    case "howMuch":
      body = (
        <SeedStepHowMuch
          form={form}
          values={values}
          noteId={noteId}
          busy={busy}
          errorOf={errorOf}
          requirements={requirements}
          actions={actions}
          chainId={chainId}
          now={now}
          cap={cap}
        />
      );
      break;
    case "proof":
      body = (
        <SeedStepProof
          form={form}
          values={values}
          noteId={noteId}
          busy={busy}
          errorOf={errorOf}
          members={members}
          protocolRegistered={protocolRegistered}
          settlementActive={settlementActive}
          price={price.state}
        />
      );
      break;
    default:
      body = (
        <SeedStepReview
          values={values}
          status={status}
          editable={!busy && !tray.currentLocked}
          onEditStep={(step: StepId) => setStepIndex(STEPS.indexOf(step))}
          others={tray.others}
          isLocked={tray.isLocked}
          onEditRow={(id) => void startRow(() => tray.edit(id))}
          onRemoveRow={tray.remove}
          actions={actions}
          chainId={chainId}
          cycleOptions={cycleOptions}
          protocolRegistered={protocolRegistered}
          price={price.state}
          capacity={{ cap, room, full: capacity.full, over: capacity.over }}
          submitError={submitError}
          queueUnavailable={pool.queueUnavailable}
          now={now}
        />
      );
  }

  const blocked = seedBlockedReason({
    poolOpen: pool.poolId !== undefined && pool.model.status === "open",
    capacityOver: capacity.over,
    priceUnavailable: priceNeeded && price.state.status !== "ready",
  });

  const footer = (
    <SeedFlowFooter
      stepIndex={stepIndex}
      isLast={isLast}
      status={status}
      mode={tray.mode}
      total={tray.size}
      createDisabled={Boolean(blocked) || Boolean(closedActionMessage)}
      blockedReason={blocked ? formatMessage(blocked) : closedActionMessage}
      addAnotherDisabled={poolDefaultsPending || (capacity.full && values.direction === "OFFER")}
      canAddAnother={tray.copies === null || busy}
      backDisabled={tray.currentLocked}
      onCancel={() => dirtyClose.onOpenChange(false)}
      onBack={() => setStepIndex((index) => Math.max(0, index - 1))}
      onNext={() => void goNext()}
      onAddAnother={() => void startRow(tray.addAnother)}
      onCreate={() => void create()}
      onDone={onClose}
    />
  );

  return (
    <>
      <AdminDialog
        open={open}
        size="lg"
        variant="flow"
        tone="garden"
        className={ADMIN_FLOW_DIALOG_CLASS}
        onOpenChange={dirtyClose.onOpenChange}
        preventClose={busy}
        title={title}
        description={formatMessage({
          id: "cockpit.garden.pool.seed.promisesDescription",
          defaultMessage: "Offer or ask for one or many promises on the pool's behalf.",
        })}
        bodyClassName="flex min-h-0 flex-col !overflow-hidden"
      >
        <ActionFlowShell
          layout="dialog"
          title={title}
          context={
            pool.model.season
              ? cycleName(pool.model.season, pool.cycleNames, formatMessage)
              : undefined
          }
          steps={stepConfigs}
          currentStep={stepIndex + 1}
          complete={finished}
          target={(placement) => (
            <GardenPoolTarget
              chainId={chainId}
              garden={garden}
              isProtocol={protocolContext}
              placement={placement}
            />
          )}
          // Once some of an answer exists its terms are fixed, so no step opens;
          // once everything exists, the way on is Done.
          onStepClick={
            finished || tray.currentLocked
              ? undefined
              : (step) => {
                  if (busy || step - 1 >= stepIndex) return;
                  setStepIndex(step - 1);
                }
          }
          footer={footer}
        >
          <div ref={stepRef} tabIndex={-1} className="space-y-4 outline-none">
            {/* The protocol pool keeps its warning in the body: a change there reaches beyond one garden. */}
            {protocolContext ? (
              <GardenPoolTarget chainId={chainId} garden={garden} isProtocol />
            ) : null}
            <FlowStepHeader
              title={stepConfigs[stepIndex]?.title ?? title}
              description={stepConfigs[stepIndex]?.description}
            />
            {pool.model.status !== "open" && pool.poolId !== undefined ? (
              <Alert variant="warning">
                {formatMessage({
                  id: "cockpit.garden.pool.seed.poolNotOpen",
                  defaultMessage: "The pool is not open, so nothing can be seeded into it yet.",
                })}
              </Alert>
            ) : null}
            {body}
          </div>
        </ActionFlowShell>
      </AdminDialog>
      <DiscardChangesDialog
        open={dirtyClose.confirmOpen}
        onKeepEditing={dirtyClose.cancelClose}
        onDiscard={dirtyClose.confirmClose}
        tone="garden"
      />
    </>
  );
}
