import {
  type Address,
  Alert,
  buildCommitmentCreationPayload,
  commitmentComposerSchema,
  logger,
  useActions,
  useCommitmentComposerForm,
  useCommitmentJobs,
  useDirtyClose,
  usePoolConsoleController,
  useProtocolPool,
  useSettlementAccount,
  useStepFocus,
} from "@green-goods/shared";
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
  buildSeedStepConfigs,
  CONFIRMER_ADDRESS_PATTERN,
  type SeedFieldError,
  STEP_FIELDS,
  STEPS,
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

  const form = useCommitmentComposerForm({
    kind: "SEASON_CAMPAIGN",
    direction: "OFFER",
    cycleId: pool.model.season ? pool.model.season.cycleId.toString() : "0",
    claimMode: protocolContext ? "APPROVAL_GATED" : "OPEN",
    protocolFallbackEnabled: protocolPool.isRegistered,
  });
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

  const cycleOptions = useMemo(() => {
    const season = pool.model.season;
    const campaigns = pool.model.campaigns;
    return [
      ...(season
        ? [
            {
              value: season.cycleId.toString(),
              label: `${formatMessage({ id: "cockpit.garden.pool.cycle.season", defaultMessage: "Season" })} · ${cycleName(season, pool.cycleNames, formatMessage)}`,
            },
          ]
        : []),
      ...campaigns.map((campaign) => ({
        value: campaign.cycleId.toString(),
        label: `${formatMessage({ id: "cockpit.garden.pool.cycle.campaign", defaultMessage: "Campaign" })} · ${cycleName(campaign, pool.cycleNames, formatMessage)}`,
      })),
      {
        value: "0",
        label: formatMessage({
          id: "cockpit.garden.pool.seed.cycleless",
          defaultMessage: "No cycle (runs on its own)",
        }),
      },
    ];
  }, [pool.model.season, pool.model.campaigns, pool.cycleNames, formatMessage]);

  const stepConfigs = useMemo(() => buildSeedStepConfigs(formatMessage), [formatMessage]);

  const currentStep = STEPS[stepIndex] ?? "review";
  const isLast = stepIndex === STEPS.length - 1;
  const busy = jobs.isPending;
  const title = formatMessage({
    id: "cockpit.garden.pool.seed.title",
    defaultMessage: "Seed a commitment",
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
    const candidate = confirmerDraft.trim();
    if (!CONFIRMER_ADDRESS_PATTERN.test(candidate)) return;
    const current = form.getValues("confirmers");
    if (current.some((address) => address.toLowerCase() === candidate.toLowerCase())) {
      setConfirmerDraft("");
      return;
    }
    form.setValue("confirmers", [...current, candidate], {
      shouldDirty: true,
      shouldValidate: true,
    });
    setConfirmerDraft("");
  };

  const errorOf: SeedFieldError = (field) =>
    form.formState.errors[field]?.message as string | undefined;

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
