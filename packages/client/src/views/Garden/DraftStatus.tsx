import { Button } from "@green-goods/shared/components/Button";
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
      {!submissionCompleted &&
        draft.saveState &&
        draft.saveState !== "idle" &&
        draft.saveState !== "saved" && (
          <div role="status" aria-live="polite" className="text-sm text-text-sub-600">
            {intl.formatMessage({ id: `app.garden.draft.${draft.saveState}` })}
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
          <Button
            type="button"
            emphasis="tertiary"
            onClick={() => draft.removeMissingAttachment(attachment.id)}
          >
            {intl.formatMessage({ id: "app.common.remove" })}
          </Button>
        </div>
      ))}
      {draft.legacyRecovery && !draft.showDraftSheet && (
        <Button type="button" emphasis="tertiary" onClick={draft.recover}>
          {intl.formatMessage({ id: "app.garden.draft.recover" })}
        </Button>
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
          <Button
            type="button"
            emphasis="tertiary"
            onClick={() => void draft.retry().catch(() => undefined)}
          >
            {intl.formatMessage({ id: "app.garden.draft.retry" })}
          </Button>
          {draft.error === "draft-limit" && (
            <Button type="button" emphasis="tertiary" onClick={draft.manage}>
              {intl.formatMessage({ id: "app.garden.draft.manage" })}
            </Button>
          )}
        </div>
      )}
    </>
  );
}
