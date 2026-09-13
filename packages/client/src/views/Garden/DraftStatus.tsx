import { useIntl } from "react-intl";
import type { useWorkSubmissionFlowController } from "@green-goods/shared/hooks/client-ui/work/useWorkSubmissionFlowController";
export function DraftStatus({
  draft,
  submissionCompleted,
}: {
  draft: ReturnType<typeof useWorkSubmissionFlowController>["draft"];
  submissionCompleted: boolean;
}) {
  const intl = useIntl();
  return (
    <>
      {!submissionCompleted && draft.saveState && draft.saveState !== "idle" && (
        <div role="status" aria-live="polite" className="text-sm text-text-sub-600">
          {intl.formatMessage({ id: `app.garden.draft.${draft.saveState ?? "loading"}` })}
        </div>
      )}
      {draft.missingAttachments?.map((attachment) => (
        <div key={attachment.id} role="alert">
          <p>
            {intl.formatMessage({ id: "app.garden.draft.reselect" }, { name: attachment.name })}
          </p>
          <label className="inline-flex min-h-11 items-center underline focus-within:outline focus-within:outline-2 focus-within:outline-offset-2">
            {intl.formatMessage({ id: "app.garden.draft.reselectAction" })}
            <input
              type="file"
              className="sr-only"
              accept={attachment.kind === "audio" ? "audio/*" : "image/*,video/mp4,video/webm"}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                if (file)
                  void draft.reselectMissingAttachment(attachment.id, file).catch(() => undefined);
              }}
            />
          </label>
          <button
            type="button"
            className="min-h-11 underline"
            onClick={() => draft.removeMissingAttachment(attachment.id)}
          >
            {intl.formatMessage({ id: "app.common.remove" })}
          </button>
        </div>
      ))}
      {draft.legacyRecovery && !draft.showDraftSheet && (
        <button type="button" className="min-h-11 underline" onClick={draft.recover}>
          {intl.formatMessage({ id: "app.garden.draft.recover" })}
        </button>
      )}
      {draft.saveState === "failed" && (
        <div role="alert" className="flex flex-col gap-2">
          <p>
            {intl.formatMessage({
              id:
                draft.error === "draft-limit"
                  ? "app.garden.draft.limit"
                  : "app.garden.draft.failed",
            })}
          </p>
          <button
            type="button"
            className="min-h-11 underline"
            onClick={() => void draft.retry().catch(() => undefined)}
          >
            {intl.formatMessage({ id: "app.garden.draft.retry" })}
          </button>
          {draft.error === "draft-limit" && (
            <button type="button" className="min-h-11 underline" onClick={draft.manage}>
              {intl.formatMessage({ id: "app.garden.draft.manage" })}
            </button>
          )}
        </div>
      )}
    </>
  );
}
