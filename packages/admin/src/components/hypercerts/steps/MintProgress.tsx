import {
  cn,
  DEFAULT_CHAIN_ID,
  getNetworkConfig,
  getBlockchainErrorI18nKey,
  type MintingState,
} from "@green-goods/shared";
import { RiCheckLine, RiCloseLine, RiLoader4Line } from "@remixicon/react";
import { useMemo, useEffect, useRef } from "react";
import { useIntl } from "react-intl";

interface MintStep {
  id: string;
  labelId: string;
}

const MINT_STEPS: MintStep[] = [
  { id: "metadata", labelId: "app.hypercerts.mint.step.metadata" },
  { id: "allowlist", labelId: "app.hypercerts.mint.step.allowlist" },
  { id: "signing", labelId: "app.hypercerts.mint.step.signing" },
  { id: "confirming", labelId: "app.hypercerts.mint.step.confirming" },
];

/**
 * Maps minting status to the current step index
 * Returns -1 for idle, 0-3 for in-progress steps, 4 for completed
 */
function getStepIndex(status: MintingState["status"]): number {
  switch (status) {
    case "idle":
      return -1;
    case "uploading_metadata":
      return 0;
    case "uploading_allowlist":
      return 1;
    case "building_userop":
    case "awaiting_signature":
      return 2;
    case "submitting":
    case "pending":
      return 3;
    case "confirmed":
      return 4; // All complete
    case "failed":
      return -2; // Special case for failure
    default:
      return -1;
  }
}

interface MintProgressProps {
  state: MintingState;
  chainId?: number;
}

export function MintProgress({ state, chainId = DEFAULT_CHAIN_ID }: MintProgressProps) {
  const { formatMessage } = useIntl();
  const explorer = getNetworkConfig(chainId).blockExplorer;
  const previousStatus = useRef(state.status);

  const currentStepIndex = useMemo(() => getStepIndex(state.status), [state.status]);
  const isFailed = state.status === "failed";
  const isComplete = state.status === "confirmed";

  // Screen reader announcement for status changes
  const srAnnouncement = useMemo(() => {
    if (state.status === "confirmed") {
      return formatMessage(
        { id: "app.hypercerts.mint.sr.confirmed" },
        { hypercertId: state.hypercertId }
      );
    }
    if (state.status === "failed") {
      return formatMessage({ id: "app.hypercerts.mint.sr.failed" });
    }
    // Map status to step name for announcement
    const stepNames: Record<string, string> = {
      uploading_metadata: formatMessage({ id: "app.hypercerts.mint.step.metadata" }),
      uploading_allowlist: formatMessage({ id: "app.hypercerts.mint.step.allowlist" }),
      building_userop: formatMessage({ id: "app.hypercerts.mint.step.signing" }),
      awaiting_signature: formatMessage({ id: "app.hypercerts.mint.step.signing" }),
      submitting: formatMessage({ id: "app.hypercerts.mint.step.confirming" }),
      pending: formatMessage({ id: "app.hypercerts.mint.step.confirming" }),
    };
    const stepName = stepNames[state.status];
    return stepName
      ? formatMessage({ id: "app.hypercerts.mint.sr.inProgress" }, { step: stepName })
      : "";
  }, [formatMessage, state.status, state.hypercertId]);

  // Track if status actually changed to avoid duplicate announcements
  useEffect(() => {
    previousStatus.current = state.status;
  }, [state.status]);

  const statusMessage = useMemo(() => {
    switch (state.status) {
      case "uploading_metadata":
        return formatMessage({ id: "app.hypercerts.mint.status.metadata" });
      case "uploading_allowlist":
        return formatMessage({ id: "app.hypercerts.mint.status.allowlist" });
      case "building_userop":
      case "awaiting_signature":
        return formatMessage({ id: "app.hypercerts.mint.status.signing" });
      case "submitting":
      case "pending":
        return formatMessage({ id: "app.hypercerts.mint.status.pending" });
      case "confirmed":
        return formatMessage({ id: "app.hypercerts.mint.status.confirmed" });
      case "failed":
        return formatMessage({ id: "app.hypercerts.mint.status.failed" });
      default:
        return formatMessage({ id: "app.hypercerts.mint.status.ready" });
    }
  }, [formatMessage, state.status]);

  return (
    <div className="space-y-6">
      {/* Screen reader live region for status announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {srAnnouncement}
      </div>

      {/* Visual Progress Steps */}
      <div className="rounded-xl border border-stroke-soft bg-bg-white p-4 sm:p-6">
        <nav aria-label={formatMessage({ id: "app.hypercerts.mint.progress.label" })}>
          <ol className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
            {MINT_STEPS.map((step, index) => {
              const isStepComplete = currentStepIndex > index;
              const isStepActive = currentStepIndex === index;
              const isStepFailed = isFailed && isStepActive;
              const isStepPending = currentStepIndex < index && !isFailed;

              return (
                <li
                  key={step.id}
                  className={cn(
                    "flex items-center gap-3 sm:flex-1",
                    index < MINT_STEPS.length - 1 &&
                      "sm:after:ml-3 sm:after:flex-1 sm:after:border-t sm:after:border-stroke-soft"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {/* Step indicator circle */}
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-medium transition-all",
                        isStepComplete && "border-success-base bg-success-base text-white",
                        isStepActive &&
                          !isStepFailed &&
                          "border-primary-base bg-primary-base text-white",
                        isStepFailed && "border-error-base bg-error-base text-white",
                        isStepPending && "border-stroke-sub bg-bg-white text-text-sub"
                      )}
                    >
                      {isStepComplete && <RiCheckLine className="h-4 w-4" />}
                      {isStepActive && !isStepFailed && (
                        <RiLoader4Line className="h-4 w-4 animate-spin" />
                      )}
                      {isStepFailed && <RiCloseLine className="h-4 w-4" />}
                      {isStepPending && <span>{index + 1}</span>}
                    </div>
                    {/* Step label */}
                    <span
                      className={cn(
                        "text-xs font-medium sm:hidden lg:inline",
                        isStepComplete && "text-success-dark",
                        isStepActive && !isStepFailed && "text-primary-dark",
                        isStepFailed && "text-error-dark",
                        isStepPending && "text-text-sub"
                      )}
                    >
                      {formatMessage({ id: step.labelId })}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        </nav>

        {/* Status message below progress */}
        <div className="mt-4 border-t border-stroke-soft pt-4">
          <p className="text-sm font-medium text-text-strong">{statusMessage}</p>
          {!isComplete && !isFailed && (
            <p className="mt-1 text-xs text-text-sub">
              {formatMessage({ id: "app.hypercerts.mint.status.helper" })}
            </p>
          )}
        </div>
      </div>

      {state.status === "confirmed" && state.hypercertId && (
        <div className="rounded-lg border border-success-light bg-success-lighter p-4 text-sm text-success-dark">
          {formatMessage({ id: "app.hypercerts.mint.success" }, { hypercertId: state.hypercertId })}
        </div>
      )}

      {state.txHash && explorer && (
        <a
          href={`${explorer}/tx/${state.txHash}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex text-xs font-medium text-primary-base underline"
        >
          {formatMessage({ id: "app.hypercerts.mint.viewTransaction" })}
        </a>
      )}

      {state.status === "failed" && (
        <div className="rounded-lg border border-error-light bg-error-lighter p-4 text-sm text-error-dark">
          <p>{formatMessage({ id: "app.hypercerts.mint.failed" })}</p>
          {state.error && (
            <p className="mt-1 text-xs">
              {formatMessage({
                id: getBlockchainErrorI18nKey(state.error),
                defaultMessage: state.error,
              })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
