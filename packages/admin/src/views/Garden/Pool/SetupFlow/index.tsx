import type { PoolConsoleController } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import { useDirtyClose } from "@green-goods/shared/hooks/admin-ui/useDirtyClose";
import { useStepFocus } from "@green-goods/shared/hooks/utils/useStepFocus";
import { logger } from "@green-goods/shared/modules/app/logger";
import { useCommitmentPoolSetupSequence } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentPoolSetupSequence";
import { isValidCycleSplit } from "@green-goods/shared/modules/commitment-pooling/pool-lifecycle";
import {
  isRetriablePoolSetupFailure,
  type PoolSetupStep,
} from "@green-goods/shared/modules/commitment-pooling/pool-setup";
import type { CommitmentCycleRecord } from "@green-goods/shared/modules/commitment-pooling/types-core";
import { type ReactNode, useCallback, useEffect, useId, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { ADMIN_FLOW_DIALOG_CLASS, AdminDialog } from "@/components/AdminDialog";
import { DiscardChangesDialog } from "@/components/DiscardChangesDialog";
import { ActionFlowShell } from "@/components/Layout/ActionFlowShell";
import { FlowStepHeader } from "@/components/Layout/FlowStepHeader";
import {
  ALLOCATION_PRESETS,
  AllocationEditor,
  type AllocationPercent,
  type AllocationPreset,
  DEFAULT_RECOGNITION_PERCENT,
  type RecognitionPercent,
  toAllocationBps,
  toRecognitionBps,
} from "./AllocationEditor";
import { SetupFlowFooter } from "./SetupFlowFooter";
import { SetupStepCycle } from "./SetupStepCycle";
import { SetupStepHow } from "./SetupStepHow";
import { SetupStepOpen } from "./SetupStepOpen";
import {
  buildStepConfigs,
  DEFAULT_CAP,
  defaultCycleDates,
  endOfDaySeconds,
  isStepValid,
  type PoolSetupIntent,
  STEPS_BY_INTENT,
  setupFlowTitle,
  startOfDaySeconds,
} from "./setupFlowModel";
import { planSetupSteps } from "./setupFlowPlan";

export type { PoolSetupIntent };

export interface PoolSetupFlowProps {
  open: boolean;
  intent: PoolSetupIntent;
  /** The Seeded cycle an `open-*` intent opens. */
  cycle?: CommitmentCycleRecord | null;
  console: PoolConsoleController;
  onClose: () => void;
}

/**
 * W11: first-run setup, a new season, a campaign, or opening a prepared
 * cycle, in one flow dialog. Nothing is written until the last step, where the
 * ordered writes go out through `useCommitmentPoolSetupSequence`: every
 * failure state names what already landed and the retry repeats only the
 * unlanded call (uiux-spec C.51). The charter and the cycle name are pinned
 * before the chain starts; a pin failure keeps the step open with the words.
 */
export function PoolSetupFlow({ open, intent, cycle, console: pool, onClose }: PoolSetupFlowProps) {
  const { formatMessage } = useIntl();
  const purposeId = useId();
  const steps = STEPS_BY_INTENT[intent];
  const [stepIndex, setStepIndex] = useState(0);
  const [purpose, setPurpose] = useState("");
  const [cap, setCap] = useState(DEFAULT_CAP);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(() => defaultCycleDates().start);
  const [endDate, setEndDate] = useState(() => defaultCycleDates().end);
  const [preset, setPreset] = useState<AllocationPreset>("model1");
  const [allocation, setAllocation] = useState<AllocationPercent>(ALLOCATION_PRESETS.model1);
  const [recognition, setRecognition] = useState<RecognitionPercent>(DEFAULT_RECOGNITION_PERCENT);
  const [pinning, setPinning] = useState(false);
  const [pinFailure, setPinFailure] = useState<"charter" | "cycle" | null>(null);
  const sequence = useCommitmentPoolSetupSequence({ chainId: pool.chainId });
  const stepRef = useStepFocus<HTMLDivElement>(stepIndex);
  const isCampaign = intent === "campaign" || intent === "open-campaign";

  // A fresh open starts at step one with the pool's current words prefilled.
  useEffect(() => {
    if (!open) return;
    setStepIndex(0);
    setPurpose(pool.charter.charter?.purpose ?? "");
    const currentCap = pool.pool?.providerOpenCommitmentCap ?? 0n;
    setCap(currentCap > 0n ? currentCap.toString() : DEFAULT_CAP);
    setName("");
    const dates = defaultCycleDates();
    setStartDate(dates.start);
    setEndDate(dates.end);
    setPreset("model1");
    setAllocation(ALLOCATION_PRESETS.model1);
    setRecognition(DEFAULT_RECOGNITION_PERCENT);
    setPinFailure(null);
    sequence.reset();
    // `sequence.reset` is stable; re-running on its identity would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, intent, cycle?.id]);

  const isDirty =
    open &&
    (purpose !== (pool.charter.charter?.purpose ?? "") || name.trim().length > 0 || stepIndex > 0);
  const submitting = pinning || sequence.state.status === "running";
  const dirtyClose = useDirtyClose({
    isDirty: isDirty && sequence.state.status !== "complete",
    onClose,
    blockRouteChange: true,
    preventRouteChange: submitting,
  });

  const model = pool.model;
  const secondSeasonBlocked = intent === "season" && model.season !== null;
  const split = isValidCycleSplit({
    allocation: toAllocationBps(allocation),
    recognitionPolicy: toRecognitionBps(recognition),
  });
  const start = startOfDaySeconds(startDate);
  const end = endOfDaySeconds(endDate);
  const datesValid = start !== null && end !== null && end > start;
  const capValue = /^\d+$/.test(cap.trim()) ? BigInt(cap.trim()) : null;

  const currentStep = steps[stepIndex] ?? "open";
  const isLast = stepIndex === steps.length - 1;
  const stepReady = isStepValid(currentStep, {
    purpose,
    capValue,
    name,
    datesValid,
    secondSeasonBlocked,
    splitValid: split.allocation && split.recognitionPolicy,
  });
  const canContinue = stepReady && !submitting && pool.isOnline;

  const title = setupFlowTitle(intent, isCampaign, formatMessage);

  const stepConfigs = useMemo(
    () => buildStepConfigs(steps, isCampaign, formatMessage),
    [steps, isCampaign, formatMessage]
  );

  const buildSteps = useCallback(
    (): Promise<PoolSetupStep[]> =>
      planSetupSteps({
        intent,
        isCampaign,
        poolId: pool.poolId,
        garden: pool.garden,
        cycle,
        allocation,
        recognition,
        start,
        end,
        name,
        purpose,
        capValue,
        onPinFailure: setPinFailure,
      }),
    [
      pool.poolId,
      pool.garden,
      allocation,
      recognition,
      intent,
      cycle,
      start,
      end,
      name,
      isCampaign,
      purpose,
      capValue,
    ]
  );

  const submit = useCallback(async () => {
    setPinning(true);
    let planned: PoolSetupStep[];
    try {
      planned = await buildSteps();
    } catch (error) {
      logger.error("[PoolSetupFlow] could not prepare the writes", {
        intent,
        error: error instanceof Error ? error.message : String(error),
      });
      setPinning(false);
      return;
    }
    setPinning(false);
    const outcome = await sequence.run(planned);
    if (outcome.status === "complete") {
      await pool.refetch();
      onClose();
    }
  }, [buildSteps, intent, sequence, pool, onClose]);

  const retry = useCallback(async () => {
    const outcome = await sequence.retry();
    if (outcome.status === "complete") {
      await pool.refetch();
      onClose();
    }
  }, [sequence, pool, onClose]);

  const failed = sequence.state.status === "failed";
  const failure = sequence.state.failure;

  let body: ReactNode;
  switch (currentStep) {
    case "how":
      body = (
        <SetupStepHow
          purposeId={purposeId}
          purpose={purpose}
          onPurposeChange={setPurpose}
          cap={cap}
          onCapChange={setCap}
          disabled={submitting}
        />
      );
      break;
    case "cycle":
      body = (
        <SetupStepCycle
          isCampaign={isCampaign}
          runningSeason={model.season}
          secondSeasonBlocked={secondSeasonBlocked}
          cycleNames={pool.cycleNames}
          name={name}
          onNameChange={setName}
          startDate={startDate}
          onStartDateChange={setStartDate}
          endDate={endDate}
          onEndDateChange={setEndDate}
          datesValid={datesValid}
          disabled={submitting}
        />
      );
      break;
    case "split":
      body = (
        <AllocationEditor
          preset={preset}
          onPresetChange={setPreset}
          allocation={allocation}
          onAllocationChange={setAllocation}
          recognition={recognition}
          onRecognitionChange={setRecognition}
          disabled={submitting}
        />
      );
      break;
    default:
      body = (
        <SetupStepOpen
          intent={intent}
          isCampaign={isCampaign}
          purpose={purpose}
          cap={cap}
          cycle={cycle}
          cycleNames={pool.cycleNames}
          name={name}
          startDate={startDate}
          endDate={endDate}
          allocation={allocation}
          recognition={recognition}
          poolStatus={model.status}
          pinFailure={pinFailure}
          failed={failed}
          failure={failure}
          landed={sequence.state.landed}
          failedStep={sequence.state.failedStep}
          isOnline={pool.isOnline}
        />
      );
  }

  const retryable = failed && isRetriablePoolSetupFailure(failure);

  const footer = (
    <SetupFlowFooter
      title={title}
      intent={intent}
      isCampaign={isCampaign}
      stepIndex={stepIndex}
      isLast={isLast}
      submitting={submitting}
      canContinue={canContinue}
      failed={failed}
      retryable={retryable}
      isOnline={pool.isOnline}
      onBack={() =>
        stepIndex === 0 ? dirtyClose.onOpenChange(false) : setStepIndex((index) => index - 1)
      }
      onNext={() => setStepIndex((index) => index + 1)}
      onSubmit={() => void submit()}
      onRetry={() => void retry()}
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
        preventClose={submitting}
        title={title}
        description={formatMessage({
          id: "cockpit.garden.pool.setup.description",
          defaultMessage: "Write how this pool runs and open it to the garden.",
        })}
        bodyClassName="flex min-h-0 flex-col !overflow-hidden"
      >
        <ActionFlowShell
          layout="dialog"
          title={title}
          steps={stepConfigs}
          currentStep={stepIndex + 1}
          onStepClick={(step) => {
            if (!submitting && step - 1 < stepIndex) setStepIndex(step - 1);
          }}
          footer={footer}
        >
          <div ref={stepRef} tabIndex={-1} className="space-y-4 outline-none">
            <FlowStepHeader
              title={stepConfigs[stepIndex]?.title ?? title}
              description={stepConfigs[stepIndex]?.description}
            />
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
