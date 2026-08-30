import {
  RiCloseLine,
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
  const description = intl.formatMessage({
    id: "app.garden.commitment.description",
    defaultMessage: "Choose the commitment and exact requirement this work fulfils.",
  });
  const readFailed = error !== null || intentStatus === "unavailable";
  const intentInvalid = intentStatus === "invalid";
  const loading = isLoading || intentStatus === "validating";

  return (
    <div className="space-y-2">
      <FormInfo
        title={intl.formatMessage({
          id: "app.garden.commitment.label",
          defaultMessage: "Commitment (optional)",
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
            defaultMessage: "Checking eligible commitments…",
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
                ? "That commitment link is no longer eligible. Choose another commitment or continue without one."
                : "Eligible commitments could not be read. Try again or continue without one.",
            })}
          </span>
          {intentInvalid && onSelectedKeyChange ? (
            <button
              type="button"
              onClick={() => onSelectedKeyChange(null)}
              className="flex min-h-11 shrink-0 items-center gap-1 rounded-[var(--radius-md)] px-2 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-alpha-24"
            >
              <RiCloseLine className="h-4 w-4" aria-hidden="true" />
              {intl.formatMessage({
                id: "app.garden.commitment.none",
                defaultMessage: "Not for a Commitment",
              })}
            </button>
          ) : readFailed && onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="flex min-h-11 shrink-0 items-center gap-1 rounded-[var(--radius-md)] px-2 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-alpha-24"
            >
              <RiRefreshLine className="h-4 w-4" aria-hidden="true" />
              {intl.formatMessage({
                id: "app.garden.commitment.retry",
                defaultMessage: "Try Again",
              })}
            </button>
          ) : null}
        </div>
      ) : null}
      {!loading && !readFailed && choices.length === 0 ? (
        <p className="text-sm text-text-sub-600">
          {intl.formatMessage({
            id: "app.garden.commitment.empty",
            defaultMessage: "No eligible commitments match this garden and action.",
          })}
        </p>
      ) : null}
      {choices.length > 0 ? (
        <>
          <label htmlFor="work-commitment-selection" className="sr-only">
            {intl.formatMessage({
              id: "app.garden.commitment.label",
              defaultMessage: "Commitment (optional)",
            })}
          </label>
          <p id="work-commitment-selection-description" className="sr-only">
            {description}
          </p>
          <select
            id="work-commitment-selection"
            aria-describedby="work-commitment-selection-description"
            value={selectedKey ?? ""}
            onChange={(event) => onSelectedKeyChange?.(event.target.value || null)}
            className="w-full rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-white-0 p-3 text-sm text-text-strong-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-alpha-24"
          >
            <option value="">
              {intl.formatMessage({
                id: "app.garden.commitment.none",
                defaultMessage: "No commitment",
              })}
            </option>
            {choices.map((choice) => (
              <option key={choice.key} value={choice.key}>
                {intl.formatMessage(
                  {
                    id: "app.garden.commitment.option",
                    defaultMessage: "{title} · requirement {requirement}",
                  },
                  { title: choice.title, requirement: choice.requirementIndex + 1 }
                )}
              </option>
            ))}
          </select>
        </>
      ) : null}
    </div>
  );
}
