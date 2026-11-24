import { Button } from "@green-goods/shared/components/Button";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import type { ProofComposerStatus } from "@green-goods/shared/hooks/client-ui/commitment/proof-controller.types";
import { RiErrorWarningLine, RiLoader4Line, RiSearchLine, RiWifiOffLine } from "@remixicon/react";
import { useIntl } from "react-intl";

import { TopNav } from "@/components/Navigation";

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
      <div className="padded flex flex-col gap-4 pt-[var(--app-top-bar-height)] pb-6">
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
          <EmptyState
            busy
            icon={<RiLoader4Line className="animate-spin motion-reduce:animate-none" />}
            title={formatMessage({
              id: kind === "restoringDraft" ? "app.proof.draft.loading" : "app.commitment.loading",
            })}
          />
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
