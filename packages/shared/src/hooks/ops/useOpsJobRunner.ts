import { useCallback } from "react";
import { useIntl } from "react-intl";

import { toastService } from "../../components/toast";
import { useOpsRunnerSession } from "./useOpsRunner";

interface UseOpsJobRunnerOptions {
  onJobStarted?: (jobId: string) => void;
  successMessageId?: string;
  failedMessageId?: string;
  authRequiredMessageId?: string;
}

export function useOpsJobRunner(options: UseOpsJobRunnerOptions = {}) {
  const { formatMessage } = useIntl();
  const { isAuthenticated } = useOpsRunnerSession();

  const {
    onJobStarted,
    successMessageId = "app.deployment.ops.jobStarted",
    failedMessageId = "app.deployment.ops.submitFailed",
    authRequiredMessageId = "app.deployment.ops.authRequired",
  } = options;

  const runJob = useCallback(
    async <T>(mutation: { mutateAsync: (payload: T) => Promise<{ id: string }> }, payload: T) => {
      if (!isAuthenticated) {
        toastService.error({
          title: formatMessage({ id: authRequiredMessageId }),
        });
        return null;
      }

      try {
        const job = await mutation.mutateAsync(payload);
        onJobStarted?.(job.id);
        toastService.success({
          title: formatMessage({ id: successMessageId }),
        });
        return job;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : formatMessage({ id: "app.error.unknown" });
        toastService.error({
          title: formatMessage({ id: failedMessageId }),
          description: message,
        });
        return null;
      }
    },
    [
      isAuthenticated,
      formatMessage,
      onJobStarted,
      successMessageId,
      failedMessageId,
      authRequiredMessageId,
    ]
  );

  return { runJob, isAuthenticated };
}
