import { RiSearchLine, RiWifiOffLine } from "@remixicon/react";
import { useIntl } from "react-intl";

import { EmptyState, FormProgress } from "@/components/Communication";
import { TopNav } from "@/components/Navigation";

export interface ProofShellProps {
  children: React.ReactNode;
  onBack: () => void;
  /** Which beat is showing, 1-based; absent outside the composer's beats. */
  progress?: number;
  bar?: React.ReactNode;
}

/** The proof composer's chrome: back, the three-beat progress, a body, a bar. */
export function ProofShell({ children, onBack, progress, bar }: ProofShellProps) {
  const { formatMessage } = useIntl();
  const steps = [
    formatMessage({ id: "app.proof.beat.media" }),
    formatMessage({ id: "app.proof.beat.details" }),
    formatMessage({ id: "app.compose.beat.review" }),
  ];

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <TopNav onBackClick={onBack}>
        {progress ? <FormProgress currentStep={progress} steps={steps} /> : null}
      </TopNav>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="flex flex-1 flex-col gap-4 p-4 pb-24">
          <p className="text-xs font-medium uppercase tracking-wide text-text-soft-400">
            {formatMessage({ id: "app.proof.title" })}
          </p>
          {children}
        </div>
      </div>
      {bar}
    </div>
  );
}

export type ProofStateKind = "unavailable" | "loading" | "notYours" | "queued";

/**
 * Every screen the composer shows that is not the form. Proof belongs to the
 * people doing the work, so anyone else reads a plain answer rather than a
 * form the chain would refuse; and once the proof is queued the screen says
 * what happens next in the reader's actual conditions.
 */
export function ProofState({
  kind,
  isOnline,
  onBack,
}: {
  kind: ProofStateKind;
  isOnline: boolean;
  onBack: () => void;
}) {
  const { formatMessage } = useIntl();
  return (
    <ProofShell onBack={onBack}>
      {kind === "unavailable" ? (
        <EmptyState
          icon={<RiWifiOffLine />}
          title={formatMessage({ id: "app.commitments.notReady.title" })}
          description={formatMessage({ id: "app.commitments.notReady.description" })}
        />
      ) : kind === "loading" ? (
        <p className="text-xs text-text-soft-400" role="status">
          {formatMessage({ id: "app.commitment.loading" })}
        </p>
      ) : kind === "notYours" ? (
        <EmptyState
          icon={<RiSearchLine />}
          title={formatMessage({ id: "app.proof.notYours.title" })}
          description={formatMessage({ id: "app.proof.notYours.body" })}
        />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <h1 className="text-lg font-medium text-text-strong-950">
            {formatMessage({
              id: isOnline ? "app.proof.queued.title" : "app.proof.queued.offlineTitle",
            })}
          </h1>
          <p className="max-w-sm text-sm text-text-sub-600">
            {formatMessage({
              id: isOnline ? "app.proof.queued.body" : "app.proof.queued.offlineBody",
            })}
          </p>
          <button
            type="button"
            onClick={onBack}
            className="mt-2 rounded-[var(--radius-lg)] bg-primary-action px-4 py-3 text-sm font-medium text-primary-action-foreground tap-target-lg"
          >
            {formatMessage({ id: "app.proof.queued.back" })}
          </button>
        </div>
      )}
    </ProofShell>
  );
}
