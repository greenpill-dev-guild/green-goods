import type { CommitmentDialogController } from "@green-goods/shared";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { AdminChoiceGroup } from "@/components/AdminChoiceGroup";
import { AdminDialog } from "@/components/AdminDialog";
import { formatUnixDate } from "../poolPresentation";
import type { CommitmentDialogTone, OpenDialog } from "./commitmentDialogPresentation";

/**
 * Attaching the assessment a record waits on. Only current assessments
 * recorded for the provider garden are on offer: attaching one vouches that it
 * applies to this commitment.
 */
export function CommitmentAssessmentDialog({
  open,
  onClose,
  tone,
  acts,
  assessments,
  assessmentsLoading,
  assessmentUID,
  onAssessmentUIDChange,
  actDisabled,
  isActing,
}: {
  open: OpenDialog;
  onClose: () => void;
  tone: CommitmentDialogTone;
  acts: CommitmentDialogController["acts"];
  assessments: CommitmentDialogController["assessments"];
  assessmentsLoading: boolean;
  /** The picked assessment, or null while the reader has picked none. */
  assessmentUID: string | null;
  onAssessmentUIDChange: (assessmentUID: string | null) => void;
  actDisabled: boolean;
  isActing: boolean;
}) {
  const { formatMessage, locale } = useIntl();

  return (
    <AdminDialog
      open={open === "attach-assessment"}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      size="md"
      tone={tone}
      title={formatMessage({
        id: "cockpit.garden.pool.commitment.attach.title",
        defaultMessage: "Attach an assessment",
      })}
      description={formatMessage({
        id: "cockpit.garden.pool.commitment.attach.description",
        defaultMessage:
          "Only current assessments recorded for the provider garden appear here. Attaching one vouches that it applies.",
      })}
      bodyClassName="space-y-3"
      actions={
        <>
          <AdminButton type="button" variant="text" onClick={() => onClose()}>
            {formatMessage({ id: "app.common.cancel", defaultMessage: "Cancel" })}
          </AdminButton>
          <AdminButton
            type="button"
            variant="filled"
            disabled={!assessmentUID || actDisabled}
            loading={isActing}
            onClick={async () => {
              if (!assessmentUID) return;
              await acts.attachAssessment(assessmentUID as `0x${string}`);
              onClose();
            }}
          >
            {formatMessage({
              id: "cockpit.garden.pool.commitment.attach.confirm",
              defaultMessage: "Attach",
            })}
          </AdminButton>
        </>
      }
    >
      {assessmentsLoading ? (
        <div
          className="h-16 rounded-[var(--m3-shape-md)] skeleton-shimmer"
          role="status"
          aria-label={formatMessage({
            id: "cockpit.garden.pool.commitment.attach.loading",
            defaultMessage: "Loading assessments",
          })}
        />
      ) : assessments.length === 0 ? (
        <p className="text-sm text-text-soft" data-testid="attach-assessment-empty">
          {formatMessage({
            id: "cockpit.garden.pool.commitment.attach.empty",
            defaultMessage:
              "No current assessment is recorded for the provider garden yet. An evaluator records one from the Hub; this commitment cannot be sent for confirmation until then.",
          })}
        </p>
      ) : (
        <AdminChoiceGroup
          ariaLabel={formatMessage({
            id: "cockpit.garden.pool.commitment.attach.pick",
            defaultMessage: "Assessment",
          })}
          value={assessmentUID}
          onChange={onAssessmentUIDChange}
          options={assessments.map((assessment) => ({
            value: assessment.id,
            label: assessment.title,
            description: `${assessment.domain} · ${formatUnixDate(assessment.createdAt, locale, "")}`,
          }))}
        />
      )}
    </AdminDialog>
  );
}
