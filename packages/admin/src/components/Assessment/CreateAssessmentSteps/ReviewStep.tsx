import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import type { Step } from "@green-goods/shared/components/Form/StepIndicator";
import { useActions } from "@green-goods/shared/hooks/blockchain/useBaseLists";
import { useCurrentChain } from "@green-goods/shared/hooks/blockchain/useChainConfig";
import type { CreateAssessmentFormState } from "@green-goods/shared/stores/useCreateAssessmentStore";
import {
  formatReportingPeriod,
  fromCalendarDateKey,
  pickerValueToUtcDay,
} from "@green-goods/shared/utils/time";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import type { FlowSendStatus } from "@/components/Layout/FlowSendFooter";
import { FlowStatusRow } from "@/components/Layout/FlowStatusRow";
import { resolveCynefinOptions, resolveDomainMetrics } from "./StrategyKernelStep";
import { knownDomain, resolveDomainLabel, Section } from "./shared";

interface ReviewStepProps {
  /** The answers under review: the wizard's own, or the ones a send just carried. */
  form: CreateAssessmentFormState;
  /** The wizard's steps: each section takes its step's name and its Edit reopens it. */
  steps: readonly Step[];
  /** Where the send stands, in the one row that changes while it works. */
  status: FlowSendStatus;
  /** Reopen the step, by its place in `steps`, that asked a section's answers. */
  onEditStep: (stepIndex: number) => void;
}

/**
 * Step 4: Review. What the assessment's attestation will carry, grouped by the
 * step that asked it, each section with an Edit, under one status row that
 * keeps its height through ready, sending, sent and failed (DL-072, DL-080).
 * The footer's primary sends from here, and the row says how it went.
 */
export function ReviewStep({ form, steps, status, onEditStep }: ReviewStepProps) {
  const intl = useIntl();
  const { formatMessage } = intl;
  // Until the send lands the answers stay the steward's to change, a failed send included.
  const editable = status.phase === "ready" || status.phase === "failed";
  const chainId = useCurrentChain();
  const { data: actions = [] } = useActions(chainId);

  const domain = knownDomain(form.domain);
  const metrics = resolveDomainMetrics(intl, domain);
  const cynefin = resolveCynefinOptions(intl).find((option) => option.value === form.cynefinPhase);
  // The period as the attestation stores it and every record reads it back:
  // UTC midnight of each day picked.
  const period = formatReportingPeriod(
    intl,
    pickerValueToUtcDay(fromCalendarDateKey(form.reportingPeriodStart)),
    pickerValueToUtcDay(fromCalendarDateKey(form.reportingPeriodEnd))
  );

  // An answer left empty reads "Not provided", quieter than the answers, so a gap stands out.
  const notProvided = (
    <span className="font-normal text-text-soft">
      {formatMessage({
        id: "admin.assessment.review.notProvided",
        defaultMessage: "Not provided",
      })}
    </span>
  );
  const answer = (value: string | null | undefined) =>
    value && value.trim().length > 0 ? value : notProvided;

  const section = (stepId: string, rows: ReactNode) => {
    const stepIndex = steps.findIndex((step) => step.id === stepId);
    const title = steps[stepIndex]?.title ?? "";
    return (
      <Section
        title={title}
        action={
          <AdminButton
            type="button"
            variant="text"
            size="sm"
            disabled={!editable}
            aria-label={formatMessage(
              { id: "app.admin.flow.review.editSection", defaultMessage: "Edit {section}" },
              { section: title }
            )}
            onClick={() => onEditStep(stepIndex)}
          >
            {formatMessage({ id: "app.common.edit", defaultMessage: "Edit" })}
          </AdminButton>
        }
      >
        <FactList frame="inset">{rows}</FactList>
      </Section>
    );
  };

  return (
    <div className="space-y-6" data-testid="assessment-review">
      <FlowStatusRow
        tone={status.tone}
        busy={status.busy}
        title={status.title}
        description={status.description}
      />
      {/* Each label is the one its step shows, read from the catalog alone so the two cannot drift. */}
      {section(
        "domainContext",
        <>
          <FactRow
            label={formatMessage({ id: "app.admin.assessment.domainAction.domainTitle" })}
            value={domain === null ? notProvided : resolveDomainLabel(intl, domain)}
          />
          <FactRow
            label={formatMessage({ id: "app.admin.assessment.strategyKernel.titleLabel" })}
            value={answer(form.title)}
          />
          <FactRow
            label={formatMessage({ id: "app.admin.assessment.strategyKernel.locationLabel" })}
            value={answer(form.location)}
          />
          <FactRow
            label={formatMessage({ id: "app.admin.assessment.strategyKernel.descriptionLabel" })}
            value={answer(form.description)}
          />
        </>
      )}
      {section(
        "strategy",
        <>
          <FactRow
            label={formatMessage({ id: "app.admin.assessment.strategyKernel.diagnosisLabel" })}
            value={answer(form.diagnosis)}
          />
          <FactRow
            label={formatMessage({ id: "app.admin.assessment.strategyKernel.smartOutcomesTitle" })}
            value={
              form.smartOutcomes.length > 0 ? (
                <ul className="space-y-1.5">
                  {form.smartOutcomes.map((outcome, index) => {
                    const metric = metrics.find((entry) => entry.key === outcome.metric);
                    const target = intl.formatNumber(outcome.target);
                    return (
                      <li key={index}>
                        <span className="block">{outcome.description}</span>
                        <span className="block type-meta font-normal text-text-sub">
                          {metric ? `${metric.label} · ${target} ${metric.unit}` : target}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                notProvided
              )
            }
          />
          <FactRow
            label={formatMessage({ id: "app.admin.assessment.strategyKernel.cynefinTitle" })}
            value={answer(cynefin?.label)}
          />
        </>
      )}
      {section(
        "actionsHarvest",
        <>
          <FactRow
            label={formatMessage({ id: "app.admin.assessment.domainAction.actionsTitle" })}
            value={
              form.selectedActionUIDs.length > 0 ? (
                <ul className="space-y-0.5">
                  {form.selectedActionUIDs.map((uid) => (
                    // An action this device has not loaded still shows, by its id.
                    <li key={uid}>{actions.find((action) => action.id === uid)?.title ?? uid}</li>
                  ))}
                </ul>
              ) : (
                // Actions are optional, so none is an answer, not a gap.
                formatMessage({
                  id: "admin.assessment.review.noActions",
                  defaultMessage: "None selected",
                })
              )
            }
          />
          <FactRow
            label={formatMessage({ id: "app.admin.assessment.actionsHarvest.sectionTitle" })}
            value={answer(period)}
          />
        </>
      )}
    </div>
  );
}
