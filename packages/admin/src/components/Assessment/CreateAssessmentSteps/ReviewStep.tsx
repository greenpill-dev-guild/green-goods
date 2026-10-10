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
import { knownDomain, ReviewRow, resolveDomainLabel, Section } from "./shared";

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
        <dl className="grid gap-3 sm:grid-cols-2">{rows}</dl>
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
          <ReviewRow
            label={formatMessage({ id: "app.admin.assessment.domainAction.domainTitle" })}
            value={domain === null ? null : resolveDomainLabel(intl, domain)}
          />
          <ReviewRow
            label={formatMessage({ id: "app.admin.assessment.strategyKernel.titleLabel" })}
            value={form.title}
          />
          <ReviewRow
            label={formatMessage({ id: "app.admin.assessment.strategyKernel.locationLabel" })}
            value={form.location}
            wide
          />
          <ReviewRow
            label={formatMessage({ id: "app.admin.assessment.strategyKernel.descriptionLabel" })}
            value={form.description}
            wide
          />
        </>
      )}
      {section(
        "strategy",
        <>
          <ReviewRow
            label={formatMessage({ id: "app.admin.assessment.strategyKernel.diagnosisLabel" })}
            value={form.diagnosis}
            wide
          />
          <ReviewRow
            label={formatMessage({ id: "app.admin.assessment.strategyKernel.smartOutcomesTitle" })}
            wide
          >
            {form.smartOutcomes.length > 0 ? (
              <ul className="space-y-1.5">
                {form.smartOutcomes.map((outcome, index) => {
                  const metric = metrics.find((entry) => entry.key === outcome.metric);
                  const target = intl.formatNumber(outcome.target);
                  return (
                    <li key={index}>
                      <span className="block">{outcome.description}</span>
                      <span className="block body-xs text-text-sub">
                        {metric ? `${metric.label} · ${target} ${metric.unit}` : target}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </ReviewRow>
          <ReviewRow
            label={formatMessage({ id: "app.admin.assessment.strategyKernel.cynefinTitle" })}
            value={cynefin?.label}
            wide
          />
        </>
      )}
      {section(
        "actionsHarvest",
        <>
          <ReviewRow
            label={formatMessage({ id: "app.admin.assessment.domainAction.actionsTitle" })}
            // Actions are optional, so none is an answer, not a gap.
            value={
              form.selectedActionUIDs.length === 0
                ? formatMessage({
                    id: "admin.assessment.review.noActions",
                    defaultMessage: "None selected",
                  })
                : undefined
            }
            wide
          >
            {form.selectedActionUIDs.length > 0 ? (
              <ul className="space-y-0.5">
                {form.selectedActionUIDs.map((uid) => (
                  // An action this device has not loaded still shows, by its id.
                  <li key={uid}>{actions.find((action) => action.id === uid)?.title ?? uid}</li>
                ))}
              </ul>
            ) : null}
          </ReviewRow>
          <ReviewRow
            label={formatMessage({ id: "app.admin.assessment.actionsHarvest.sectionTitle" })}
            value={period}
            wide
          />
        </>
      )}
    </div>
  );
}
