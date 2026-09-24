import { Alert } from "@green-goods/shared/components/Alert";
import { usePoolConsoleController } from "@green-goods/shared/hooks/admin-ui/pool/usePoolConsoleController";
import {
  type SeedTrayRow,
  selectSeedTrayCapacity,
  useSeedTray,
  useSeedTrayRoom,
} from "@green-goods/shared/hooks/admin-ui/pool/useSeedTray";
import { useDirtyClose } from "@green-goods/shared/hooks/admin-ui/useDirtyClose";
import { useActions } from "@green-goods/shared/hooks/blockchain/useBaseLists";
import { useErc20Metadata } from "@green-goods/shared/hooks/blockchain/useErc20Metadata";
import { useStepFocus } from "@green-goods/shared/hooks/utils/useStepFocus";
import type { Address } from "@green-goods/shared/types/domain";
import {
  buildCommitmentCreationPayload,
  useCommitmentComposerForm,
  useCommitmentComposerSession,
} from "@green-goods/shared/hooks/commitment-pooling/useCommitmentComposerForm";
import {
  type CommitmentSendReport,
  useCommitmentJobs,
} from "@green-goods/shared/hooks/commitment-pooling/useCommitmentJobs";
import { useComposeAgainValues } from "@green-goods/shared/hooks/commitment-pooling/useComposeAgainValues";
import { useProtocolPool } from "@green-goods/shared/hooks/commitment-pooling/useProtocolPool";
import { useSettlementAccount } from "@green-goods/shared/hooks/commitment-pooling/useSettlementQueries";
import { type ReactNode, useCallback, useId, useMemo, useState } from "react";
import { useFieldArray } from "react-hook-form";
import { useIntl } from "react-intl";
import { ADMIN_FLOW_DIALOG_CLASS, AdminDialog } from "@/components/AdminDialog";
import { DiscardChangesDialog } from "@/components/DiscardChangesDialog";
import { ActionFlowShell } from "@/components/Layout/ActionFlowShell";
import { FlowStepHeader } from "@/components/Layout/FlowStepHeader";
import { cycleName } from "../poolPresentation";
import { GardenPoolTarget } from "../PoolTarget";
import { SeedFlowFooter } from "./SeedFlowFooter";
import { SeedStepDone, SeedStepSending } from "./SeedStepDone";
import { SeedStepHowMuch } from "./SeedStepHowMuch";
import { SeedStepProof } from "./SeedStepProof";
import { SeedStepReview } from "./SeedStepReview";
import { SeedStepWhat } from "./SeedStepWhat";
import { rewardUnitsFor } from "./seedRewardAmount";
import {
  buildSeedCycleOptions,
  buildSeedStepConfigs,
  type SeedFieldError,
  seedErrorText,
  STEP_FIELDS,
  STEPS,
  withConfirmer,
} from "./seedStepModel";

export interface SeedCommitmentDialogProps {
  open: boolean;
  chainId: number;
  garden: Address;
  onClose: () => void;
  /** A commitment in this pool to start from (Seed Another Like This). */
  fromCommitmentId?: bigint | null;
}

/**
 * W8, the steward's seeding console (uiux-spec §6.3): a cast of the member
 * composer over the same shared form, with the steward's extras. What → how
 * much → proof & confirmation → sectioned review, then one queued creation
 * through useCommitmentJobs; the queued row appears on the pool tab before
 * the indexer has it. Add Another Like This keeps the reviewed commitment in a
 * tray and starts the next from the same answers, and the whole tray is then
 * sent one creation after another. The cycle selector groups the one season,
 * then the campaigns, then cycle-less; claim mode is prefilled by context; the
 * consideration rail defaults to none, names the external rail's fields,
 * and shows Celo settlement disabled with its readiness explanation unless
 * the garden's settlement account is active; the Green Goods team fallback is
 * on by default and disabled with a repair path when no protocol pool is
 * registered.
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
  const pool = usePoolConsoleController({ chainId, garden });
  // Seeding into the protocol pool (the Green Goods Community Garden's own):
  // requests default to steward review. The pool says which it is, so the
  // context holds wherever the wizard is opened from.
  const protocolContext = pool.pool?.poolType === "PROTOCOL";
  const protocolPool = useProtocolPool({ chainId });
  const settlement = useSettlementAccount({ chainId, garden });
  const { data: actions = [] } = useActions(chainId);
  const jobs = useCommitmentJobs({ chainId });
  const [stepIndex, setStepIndex] = useState(0);
  const [confirmerDraft, setConfirmerDraft] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const stepRef = useStepFocus<HTMLDivElement>(stepIndex);

  // The season and the protocol pool arrive with their queries, so these are
  // not all known on a cold load; useCommitmentComposerSession carries the late
  // ones onto the untouched fields.
  // Seeding another like an earlier commitment starts from that one's answers,
  // the steward's extras included. They arrive with their own query, so they are
  // late in the same way, and the season stays this pool's current one.
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
      ...again,
    }),
    [pool.model.season, protocolContext, protocolPool.isRegistered, again]
  );
  const form = useCommitmentComposerForm(initial);
  const requirements = useFieldArray({ control: form.control, name: "requirements" });
  const values = form.watch();
  const protocolRegistered = protocolPool.isRegistered;
  // The season and the protocol pool arrive with their queries, and a row put
  // into the tray keeps the answers it was parked with. Parking before they
  // land would send that row with no cycle, or with the fallback off, when the
  // steward chose neither. The composer's own session carries a late answer
  // onto the untouched fields of the row still in the form; a parked one is a
  // snapshot nothing revisits.
  const poolDefaultsPending = pool.isLoading || protocolPool.isLoading;
  // The declared reward is typed in its token's units, read once for every step.
  // Until they are known, nothing with a reward can be seeded.
  const rewardToken = useErc20Metadata(
    chainId,
    values.considerationRail === "ARBITRUM_EXTERNAL" ? values.considerationToken : null
  );
  const rewardUnits = rewardUnitsFor(values.considerationRail, rewardToken);
  const rewardUnitsUnknown = values.considerationRail !== "NONE" && rewardUnits.status !== "ready";
  const settlementActive = Boolean(settlement.detail?.account?.active);

  // One creation per tray row, under the id the row was given when it joined
  // the tray: a row sent twice is the same creation to the queue and the chain.
  const createRow = async (row: SeedTrayRow, report: (event: CommitmentSendReport) => void) => {
    if (pool.poolId === undefined || !jobs.viewer) throw new Error("No pool or viewer to seed as");
    const payload = buildCommitmentCreationPayload({
      // The fallback choice cannot stand without a registered protocol pool.
      values: protocolRegistered ? row.values : { ...row.values, protocolFallbackEnabled: false },
      clientCommitmentId: row.clientCommitmentId,
      poolId: pool.poolId,
      creator: jobs.viewer,
      gardenAddress: garden,
      nowSeconds: Math.floor(Date.now() / 1000),
      allowGatedOffers: true,
    });
    await jobs.enqueue({ act: "create", payload, report });
  };
  const tray = useSeedTray({ form, createRow });
  const room = useSeedTrayRoom({
    chainId,
    poolId: pool.poolId,
    cap: pool.pool?.providerOpenCommitmentCap,
    viewer: jobs.viewer,
    pendingCreates: pool.pendingCreates,
  });
  const capacity = selectSeedTrayCapacity({
    room,
    others: tray.others,
    currentDirection: values.direction,
  });
  const busy = jobs.isPending || tray.isSending;
  // A pass ends on the done screen; with every row sent there is nothing to lose.
  const settled = !tray.isSending && tray.pass !== null;
  const unsent = settled && (tray.pass?.some((row) => row.status === "not-sent") ?? false);

  const dirtyClose = useDirtyClose({
    isDirty: open && !(settled && !unsent) && (form.formState.isDirty || tray.others.length > 0),
    onClose,
    blockRouteChange: true,
    preventRouteChange: busy,
  });

  const restart = () => {
    setStepIndex(0);
    setConfirmerDraft("");
    setSubmitError(null);
    tray.restart();
  };
  // This dialog stays mounted while `open` toggles, so a cancelled or seeded
  // attempt would otherwise be resumed — and queued a second time.
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
    id: "cockpit.garden.pool.seed.title",
    defaultMessage: "Seed a Commitment",
  });

  const goNext = useCallback(async () => {
    const valid = await form.trigger(STEP_FIELDS[currentStep]);
    if (valid) setStepIndex((index) => index + 1);
  }, [form, currentStep]);

  const seed = async () => {
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
    // A pass that ran ends on the done screen, which says how each row ended.
    const outcome = await tray.sendAll();
    if (outcome === "invalid") setStepIndex(0);
  };

  // Both moves hand the form another row, which starts again from the first step.
  // Answers that break a rule move nothing, and the first step is where they show.
  const startRow = async (move: () => Promise<void>) => {
    setSubmitError(null);
    await move();
    setConfirmerDraft("");
    setStepIndex(0);
  };

  const addConfirmer = () => {
    const named = withConfirmer(form.getValues("confirmers"), confirmerDraft);
    if (named) form.setValue("confirmers", named, { shouldDirty: true, shouldValidate: true });
    setConfirmerDraft("");
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
          confirmerDraft={confirmerDraft}
          onConfirmerDraftChange={setConfirmerDraft}
          onAddConfirmer={addConfirmer}
          protocolRegistered={protocolRegistered}
          settlementActive={settlementActive}
          rewardUnits={rewardUnits}
        />
      );
      break;
    default:
      body = (
        <SeedStepReview
          values={values}
          actions={actions}
          chainId={chainId}
          cycleOptions={cycleOptions}
          protocolRegistered={protocolRegistered}
          rewardUnits={rewardUnits}
          submitError={submitError}
          queueUnavailable={pool.queueUnavailable}
          tray={{
            others: tray.others,
            currentNotSent: tray.currentNotSent,
            lastSend: tray.lastSend,
            cap: pool.pool ? Number(pool.pool.providerOpenCommitmentCap) : null,
            room,
            full: capacity.full,
            over: capacity.over,
            busy,
            onEdit: (id) => void startRow(() => tray.edit(id)),
            onRemove: tray.remove,
            onRemoveCurrent: tray.removeCurrent,
          }}
        />
      );
  }

  if (tray.pass && (tray.isSending || settled)) {
    body = tray.isSending ? (
      <SeedStepSending pass={tray.pass} chainId={chainId} />
    ) : (
      <SeedStepDone pass={tray.pass} chainId={chainId} />
    );
  }
  const passHeader = tray.isSending
    ? formatMessage(
        {
          id: "cockpit.garden.pool.seed.sendingTitle",
          defaultMessage:
            "{count, plural, one {Creating the Commitment} other {Creating the Commitments}}",
        },
        { count: tray.pass?.length ?? 1 }
      )
    : settled
      ? formatMessage({
          id: "cockpit.garden.pool.seed.doneTitle",
          defaultMessage: "What Was Created",
        })
      : null;

  const footer = (
    <SeedFlowFooter
      phase={tray.isSending ? "sending" : settled ? "done" : "compose"}
      busy={busy}
      stepIndex={stepIndex}
      isLast={isLast}
      seedDisabled={
        pool.poolId === undefined ||
        pool.model.status !== "open" ||
        capacity.over ||
        rewardUnitsUnknown
      }
      count={tray.size}
      addAnotherDisabled={poolDefaultsPending || (capacity.full && values.direction === "OFFER")}
      onCancel={() => dirtyClose.onOpenChange(false)}
      onBack={() => setStepIndex((index) => index - 1)}
      onNext={() => void goNext()}
      unsent={unsent}
      onAddAnother={() => void startRow(tray.addAnother)}
      onSeed={() => void seed()}
      onDone={onClose}
      onBackToTray={() => {
        tray.clearPass();
        setStepIndex(STEPS.length - 1);
      }}
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
          id: "cockpit.garden.pool.seed.description",
          defaultMessage: "Offer or ask for something on the pool's behalf.",
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
          // Once every row is sent, the answers are spent: seeding them again
          // would be a second commitment, so no step opens and the way on is Done.
          onStepClick={
            settled && !unsent
              ? undefined
              : (step) => {
                  if (busy || step - 1 >= stepIndex) return;
                  // Going back to a step leaves the done screen for the rows still unsent.
                  tray.clearPass();
                  setStepIndex(step - 1);
                }
          }
          footer={footer}
        >
          <div ref={stepRef} tabIndex={-1} className="space-y-4 outline-none">
            <GardenPoolTarget chainId={chainId} garden={garden} isProtocol={protocolContext} />
            <FlowStepHeader
              title={passHeader ?? stepConfigs[stepIndex]?.title ?? title}
              description={passHeader ? undefined : stepConfigs[stepIndex]?.description}
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
