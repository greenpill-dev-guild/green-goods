import { Button } from "@green-goods/shared/components/Button";
import type { ProofComposerStatus } from "@green-goods/shared/hooks/client-ui/commitment/proof-controller.types";
import {
  RiErrorWarningLine,
  RiSearchLine,
  RiWifiOffLine,
  type RemixiconComponentType,
} from "@remixicon/react";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";

import { FormInfo } from "@/components/Cards";
import { EmptyState, FormProgress } from "@/components/Communication";
import { TopNav } from "@/components/Navigation";

export interface ProofShellProps {
  onBack: () => void;
  /** Which step is showing, 1-based. */
  progress: number;
  /** The step's heading card, which leads the page. */
  heading: { title: string; info: ReactNode; Icon: RemixiconComponentType };
  /** The promise this proof is for, pinned under the top bar once the heading scrolls away. */
  pinned: ReactNode;
  bar: ReactNode;
  children: ReactNode;
}

/**
 * The proof flow's page, drawn as Submit Work's is (D16): the top bar with the
 * named steps, the step's heading card, the promise pinned after it (O9), the
 * step, and the fixed bar.
 */
export function ProofShell({ onBack, progress, heading, pinned, bar, children }: ProofShellProps) {
  const { formatMessage } = useIntl();
  const steps = [
    formatMessage({ id: "app.proof.beat.media" }),
    formatMessage({ id: "app.proof.beat.details" }),
    formatMessage({ id: "app.compose.beat.review" }),
  ];

  return (
    <>
      <TopNav onBackClick={onBack} overlay>
        <FormProgress currentStep={progress} steps={steps} />
      </TopNav>
      <form
        className="relative py-6 pt-20 flex flex-col gap-4 min-h-[calc(100vh-7.5rem)]"
        onSubmit={(event) => event.preventDefault()}
      >
        <div className="padded relative flex flex-col gap-4 flex-1 pb-[calc(7rem+env(safe-area-inset-bottom))]">
          <FormInfo title={heading.title} info={heading.info} Icon={heading.Icon} />
          {pinned}
          {children}
        </div>
      </form>
      {bar}
    </>
  );
}

export type ProofStateKind = Exclude<ProofComposerStatus, "ready">;

/**
 * Every screen the proof flow shows that is not a step. Proof belongs to the
 * people doing the work, so anyone else reads a plain answer rather than a form
 * the chain would refuse; a read that failed is its own answer, with a way to
 * try again.
 */
export function ProofState({
  kind,
  onBack,
  onRetry,
}: {
  kind: ProofStateKind;
  onBack: () => void;
  onRetry?: () => void;
}) {
  const { formatMessage } = useIntl();
  return (
    <>
      <TopNav onBackClick={onBack} overlay />
      <div className="padded flex flex-col gap-4 pt-20 pb-6">
        {kind === "unavailable" ? (
          <EmptyState
            icon={<RiWifiOffLine />}
            title={formatMessage({ id: "app.commitments.notReady.title" })}
            description={formatMessage({ id: "app.commitments.notReady.description" })}
          />
        ) : kind === "error" || kind === "draftRestoreFailed" ? (
          <div className="flex flex-col items-center gap-3">
            <EmptyState
              icon={kind === "draftRestoreFailed" ? <RiErrorWarningLine /> : <RiWifiOffLine />}
              title={formatMessage({
                id:
                  kind === "draftRestoreFailed"
                    ? "app.proof.draft.restoreFailed.title"
                    : "app.commitment.error.title",
              })}
              description={formatMessage({
                id:
                  kind === "draftRestoreFailed"
                    ? "app.proof.draft.restoreFailed.body"
                    : "app.commitment.error.body",
              })}
            />
            {onRetry ? (
              <Button type="button" onClick={onRetry}>
                {formatMessage({
                  id:
                    kind === "draftRestoreFailed"
                      ? "app.proof.draft.restoreRetry"
                      : "app.commitments.retry",
                })}
              </Button>
            ) : null}
          </div>
        ) : kind === "loading" || kind === "restoringDraft" ? (
          <p className="text-xs text-text-soft-400" role="status">
            {formatMessage({
              id: kind === "restoringDraft" ? "app.proof.draft.loading" : "app.commitment.loading",
            })}
          </p>
        ) : kind === "closed" ? (
          <EmptyState
            icon={<RiSearchLine />}
            title={formatMessage({ id: "app.proof.closed.title" })}
            description={formatMessage({ id: "app.proof.closed.body" })}
          />
        ) : (
          <EmptyState
            icon={<RiSearchLine />}
            title={formatMessage({ id: "app.proof.notYours.title" })}
            description={formatMessage({ id: "app.proof.notYours.body" })}
          />
        )}
      </div>
    </>
  );
}
