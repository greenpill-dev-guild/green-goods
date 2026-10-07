import { Button } from "@green-goods/shared/components/Button";
import { DialogShell } from "@green-goods/shared/components/Dialog/DialogShell";
import { useId, useState } from "react";
import {
  RiCloseLine,
  RiArrowDownSLine,
  RiErrorWarningLine,
  RiHandHeartLine,
  RiLoader4Line,
  RiRefreshLine,
} from "@remixicon/react";
import { useIntl } from "react-intl";
import { FormInfo } from "@/components/Cards/Form/FormInfo";

export interface WorkCommitmentChoice {
  key: string;
  commitmentId: bigint;
  requirementIndex: number;
  title: string;
  actionTitle?: string;
  approvedCount?: number;
  requiredCount?: number;
  dueDate?: bigint | null;
}

interface WorkCommitmentSelectionProps {
  choices: WorkCommitmentChoice[];
  isLoading: boolean;
  error: unknown;
  intentStatus: "none" | "validating" | "valid" | "invalid" | "unavailable";
  onRetry?: () => void;
  selectedKey: string | null;
  onSelectedKeyChange?: (key: string | null) => void;
}

export function WorkCommitmentSelection({
  choices,
  isLoading,
  error,
  intentStatus,
  onRetry,
  selectedKey,
  onSelectedKeyChange,
}: WorkCommitmentSelectionProps) {
  const intl = useIntl();
  const [open, setOpen] = useState(false);
  const choiceId = useId();
  const selectedChoice = choices.find((choice) => choice.key === selectedKey);
  const requirementText = (choice: WorkCommitmentChoice) =>
    intl.formatMessage(
      { id: "app.garden.commitment.requirement", defaultMessage: "Requirement {requirement}" },
      { requirement: choice.requirementIndex + 1 }
    );
  const progressText = (choice: WorkCommitmentChoice) =>
    choice.requiredCount === undefined
      ? null
      : intl.formatMessage(
          { id: "app.garden.commitment.progress", defaultMessage: "{done} of {total} approved" },
          {
            done: Math.min(choice.approvedCount ?? 0, choice.requiredCount),
            total: choice.requiredCount,
          }
        );
  const description = intl.formatMessage({
    id: "app.garden.commitment.description",
    defaultMessage: "Choose the promise and exact requirement this work fulfils.",
  });
  const readFailed = error !== null || intentStatus === "unavailable";
  const intentInvalid = intentStatus === "invalid";
  // A link that holds the work back can always be let go: it is no longer
  // eligible, or its eligibility could not be read.
  const canUnlink =
    (intentInvalid || intentStatus === "unavailable") && onSelectedKeyChange !== undefined;
  const loading = isLoading || intentStatus === "validating";

  return (
    <div className="space-y-2">
      <FormInfo
        title={intl.formatMessage({
          id: "app.garden.commitment.label",
          defaultMessage: "Promise",
        })}
        info={description}
        Icon={RiHandHeartLine}
      />
      {loading ? (
        <p
          className="flex items-center gap-2 text-sm text-text-sub-600"
          role="status"
          aria-live="polite"
        >
          <RiLoader4Line className="h-4 w-4 shrink-0" aria-hidden="true" />
          {intl.formatMessage({
            id: "app.garden.commitment.loading",
            defaultMessage: "Checking eligible promises…",
          })}
        </p>
      ) : null}
      {readFailed || intentInvalid ? (
        <div
          className="flex items-start justify-between gap-3 rounded-[var(--radius-lg)] border border-warning-light bg-warning-lighter p-3 text-sm text-warning-dark"
          role="alert"
        >
          <span className="flex items-start gap-2">
            <RiErrorWarningLine className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {intl.formatMessage({
              id: intentInvalid ? "app.garden.commitment.invalid" : "app.garden.commitment.error",
              defaultMessage: intentInvalid
                ? "That promise link is no longer eligible. Choose another promise or continue without one."
                : "Eligible promises could not be read. Try again or continue without one.",
            })}
          </span>
          <span className="flex shrink-0 flex-col items-end gap-1">
            {readFailed && onRetry ? (
              <Button
                type="button"
                emphasis="tertiary"
                size="compact"
                onClick={onRetry}
                leadingIcon={<RiRefreshLine className="h-4 w-4" aria-hidden="true" />}
              >
                {intl.formatMessage({
                  id: "app.garden.commitment.retry",
                  defaultMessage: "Try Again",
                })}
              </Button>
            ) : null}
            {canUnlink ? (
              <Button
                type="button"
                emphasis="tertiary"
                size="compact"
                onClick={() => onSelectedKeyChange?.(null)}
                leadingIcon={<RiCloseLine className="h-4 w-4" aria-hidden="true" />}
              >
                {intl.formatMessage({
                  id: "app.garden.commitment.none",
                  defaultMessage: "Not for a Promise",
                })}
              </Button>
            ) : null}
          </span>
        </div>
      ) : null}
      {!loading && !readFailed && choices.length === 0 ? (
        <p className="text-sm text-text-sub-600">
          {intl.formatMessage({
            id: "app.garden.commitment.empty",
            defaultMessage: "No eligible promises match this garden and action.",
          })}
        </p>
      ) : null}
      {choices.length > 0 ? (
        <>
          {/* A field trigger keeps the selected promise and requirement readable on multiple lines. */}
          <button
            type="button"
            data-pressable="trigger"
            onClick={() => setOpen(true)}
            disabled={loading || readFailed || !onSelectedKeyChange}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-label={intl.formatMessage({
              id: "app.garden.commitment.choose",
              defaultMessage: "Choose a Promise",
            })}
            className="flex min-h-12 w-full items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-white-0 px-4 py-3 text-left text-sm text-text-strong-950 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-on-surface"
          >
            <span className="min-w-0 whitespace-normal">
              <span className="block">
                {selectedChoice?.title ??
                  intl.formatMessage({
                    id: "app.garden.commitment.none",
                    defaultMessage: "Not for a Promise",
                  })}
              </span>
              {selectedChoice ? (
                <span className="mt-0.5 block text-xs font-normal text-text-sub-600">
                  {[
                    requirementText(selectedChoice),
                    selectedChoice.actionTitle,
                    progressText(selectedChoice),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              ) : null}
            </span>
            <RiArrowDownSLine
              className="h-5 w-5 shrink-0 text-primary-on-surface"
              aria-hidden="true"
            />
          </button>
          <DialogShell
            open={open}
            onOpenChange={setOpen}
            title={intl.formatMessage({
              id: "app.garden.commitment.choose",
              defaultMessage: "Choose a Promise",
            })}
            description={description}
            size="md"
            sheetSize="tall"
            actions={{
              primary: {
                label: intl.formatMessage({ id: "app.common.done" }),
                onClick: () => setOpen(false),
              },
            }}
          >
            <fieldset disabled={loading || readFailed || !onSelectedKeyChange}>
              <legend className="sr-only">{description}</legend>
              <div className="space-y-2">
                {[null, ...choices].map((choice) => {
                  const selected = choice ? choice.key === selectedKey : selectedKey === null;
                  return (
                    <label
                      key={choice?.key ?? "none"}
                      className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-[var(--radius-lg)] border p-3 text-left focus-within:ring-2 focus-within:ring-primary-on-surface ${selected ? "border-primary-on-surface bg-primary-alpha-10" : "border-stroke-soft-200 bg-bg-white-0"}`}
                    >
                      <input
                        type="radio"
                        name={choiceId}
                        value={choice?.key ?? ""}
                        checked={selected}
                        onChange={() => {
                          onSelectedKeyChange?.(choice?.key ?? null);
                        }}
                        className="mt-1 shrink-0 accent-primary-on-surface"
                      />
                      <span className="min-w-0 text-sm">
                        <span className="block font-medium text-text-strong-950">
                          {choice?.title ??
                            intl.formatMessage({
                              id: "app.garden.commitment.none",
                              defaultMessage: "Not for a Promise",
                            })}
                        </span>
                        {choice ? (
                          <>
                            <span className="mt-1 block text-xs text-text-sub-600">
                              {[requirementText(choice), choice.actionTitle]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                            {progressText(choice) ? (
                              <span className="mt-0.5 block text-xs text-text-sub-600">
                                {progressText(choice)}
                              </span>
                            ) : null}
                            {choice.dueDate ? (
                              <span className="mt-0.5 block text-xs text-text-sub-600">
                                {intl.formatMessage(
                                  { id: "app.garden.commitment.due", defaultMessage: "Due {date}" },
                                  {
                                    date: intl.formatDate(new Date(Number(choice.dueDate) * 1000), {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                    }),
                                  }
                                )}
                              </span>
                            ) : null}
                          </>
                        ) : null}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </DialogShell>
        </>
      ) : null}
    </div>
  );
}
