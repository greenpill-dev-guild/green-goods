import { Alert } from "@green-goods/shared/components/Alert";
import { usePoolConsoleController } from "@green-goods/shared/hooks/admin-ui/pool/usePoolConsoleController";
import { useDirtyClose } from "@green-goods/shared/hooks/admin-ui/useDirtyClose";
import { useActions } from "@green-goods/shared/hooks/blockchain/useBaseLists";
import { useStepFocus } from "@green-goods/shared/hooks/utils/useStepFocus";
import { logger } from "@green-goods/shared/modules/app/logger";
import type { Address } from "@green-goods/shared/types/domain";
import {
  buildCommitmentCreationPayload,
  commitmentComposerSchema,
  useCommitmentComposerForm,
  useCommitmentComposerSession,
} from "@green-goods/shared/hooks/commitment-pooling/useCommitmentComposerForm";
import { useCommitmentJobs } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentJobs";
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
import { SeedFlowFooter } from "./SeedFlowFooter";
import { SeedStepHowMuch } from "./SeedStepHowMuch";
import { SeedStepProof } from "./SeedStepProof";
import { SeedStepReview } from "./SeedStepReview";
import { SeedStepWhat } from "./SeedStepWhat";
import {
  buildSeedCycleOptions,
  buildSeedStepConfigs,
  SEED_ERROR_DESCRIPTOR_BY_ID,
  type SeedFieldError,
  STEP_FIELDS,
  STEPS,
  withConfirmer,
} from "./seedStepModel";

export interface SeedCommitmentDialogProps {
  open: boolean;
  chainId: number;
  garden: Address;
  onClose: () => void;
  /**
   * Seeding in protocol context (the root garden's pool): requests default to
   * steward review. A garden campaign defaults to open claims.
   */
  protocolContext?: boolean;
}

/**
 * W8, the steward's seeding console (uiux-spec §6.3): a cast of the member
 * composer over the same shared form, with the steward's extras. What → how
 * much → proof & confirmation → sectioned review, then one queued creation
 * through useCommitmentJobs; the queued row appears on the pool tab before
 * the indexer has it. The cycle selector groups the one season, then the
 * campaigns, then cycle-less; claim mode is prefilled by context; the
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
  protocolContext = false,
}: SeedCommitmentDialogProps) {
  const { formatMessage } = useIntl();
  const noteId = useId();
  const pool = usePoolConsoleController({ chainId, garden });
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
  const initial = useMemo(
    () => ({
      kind: "SEASON_CAMPAIGN" as const,
      direction: "OFFER" as const,
      cycleId: pool.model.season ? pool.model.season.cycleId.toString() : "0",
      claimMode: (protocolContext ? "APPROVAL_GATED" : "OPEN") as "APPROVAL_GATED" | "OPEN",
      protocolFallbackEnabled: protocolPool.isRegistered,
    }),
    [pool.model.season, protocolContext, protocolPool.isRegistered]
  );
  const form = useCommitmentComposerForm(initial);
  const requirements = useFieldArray({ control: form.control, name: "requirements" });
  const values = form.watch();
  const protocolRegistered = protocolPool.isRegistered;
  const settlementActive = Boolean(settlement.detail?.account?.active);

  const dirtyClose = useDirtyClose({
    isDirty: open && form.formState.isDirty,
    onClose,
    blockRouteChange: true,
    preventRouteChange: jobs.isPending,
  });

  const restart = useCallback(() => {
    setStepIndex(0);
    setConfirmerDraft("");
    setSubmitError(null);
  }, []);
  // This dialog stays mounted while `open` toggles, so a cancelled or seeded
  // attempt would otherwise be resumed — and queued a second time.
  useCommitmentComposerSession({
    form,
    open,
    sessionKey: `${chainId}:${garden}:${protocolContext}`,
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
  const busy = jobs.isPending;
  const title = formatMessage({
    id: "cockpit.garden.pool.seed.title",
    defaultMessage: "Seed a Commitment",
  });

  const goNext = useCallback(async () => {
    const valid = await form.trigger(STEP_FIELDS[currentStep]);
    if (valid) setStepIndex((index) => index + 1);
  }, [form, currentStep]);

  const seed = useCallback(async () => {
    setSubmitError(null);
    const parsed = commitmentComposerSchema.safeParse(form.getValues());
    if (!parsed.success) {
      await form.trigger();
      setStepIndex(0);
      return;
    }
    if (pool.poolId === undefined || !jobs.viewer) {
      setSubmitError(
        formatMessage({
          id: "cockpit.garden.pool.seed.noPoolOrViewer",
          defaultMessage: "Sign in and choose a garden with a pool before seeding.",
        })
      );
      return;
    }
    // The fallback choice cannot stand without a registered protocol pool.
    const valuesToSend = protocolRegistered
      ? parsed.data
      : { ...parsed.data, protocolFallbackEnabled: false };
    const payload = buildCommitmentCreationPayload({
      values: valuesToSend,
      clientCommitmentId: crypto.randomUUID(),
      poolId: pool.poolId,
      creator: jobs.viewer,
      gardenAddress: garden,
      nowSeconds: Math.floor(Date.now() / 1000),
      allowGatedOffers: true,
    });
    try {
      await jobs.enqueue({ act: "create", payload });
      onClose();
    } catch (error) {
      logger.error("[SeedCommitmentDialog] enqueue failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      setSubmitError(
        formatMessage({
          id: "cockpit.garden.pool.seed.enqueueFailed",
          defaultMessage: "The commitment could not be queued. Nothing was sent; try again.",
        })
      );
    }
  }, [form, pool.poolId, jobs, protocolRegistered, garden, onClose, formatMessage]);

  const addConfirmer = () => {
    const named = withConfirmer(form.getValues("confirmers"), confirmerDraft);
    if (named) form.setValue("confirmers", named, { shouldDirty: true, shouldValidate: true });
    setConfirmerDraft("");
  };

  // The composer says its newer rules as message ids so they can be read in any
  // language; its older ones are English prose and are shown as they are.
  const errorOf: SeedFieldError = (field) => {
    const message = form.formState.errors[field]?.message as string | undefined;
    if (message === undefined) return undefined;
    const descriptor = SEED_ERROR_DESCRIPTOR_BY_ID.get(message);
    return descriptor ? formatMessage(descriptor) : message;
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
          submitError={submitError}
          queueUnavailable={pool.queueUnavailable}
        />
      );
  }

  const footer = (
    <SeedFlowFooter
      busy={busy}
      title={title}
      stepIndex={stepIndex}
      isLast={isLast}
      seedDisabled={pool.poolId === undefined || pool.model.status !== "open"}
      onCancel={() => dirtyClose.onOpenChange(false)}
      onBack={() => setStepIndex((index) => index - 1)}
      onNext={() => void goNext()}
      onSeed={() => void seed()}
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
          onStepClick={(step) => {
            if (!busy && step - 1 < stepIndex) setStepIndex(step - 1);
          }}
          footer={footer}
        >
          <div ref={stepRef} tabIndex={-1} className="space-y-4 outline-none">
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
