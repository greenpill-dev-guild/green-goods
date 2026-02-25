import {
  toastService,
  useAdminStore,
  useOpsJobLogs,
  useOpsRunScript,
  useOpsRunnerAuth,
  useOpsRunnerHealth,
  useOpsRunnerJob,
  useOpsRunnerJobs,
  useOpsRunnerScripts,
  useOpsRunnerSession,
} from "@green-goods/shared";
import { RiPlayCircleLine, RiTerminalLine } from "@remixicon/react";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { useAccount, useSignMessage } from "wagmi";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { chainIdToOpsNetwork, getOpsStatusBadge } from "@/utils/ops";

export default function Ops() {
  const { formatMessage } = useIntl();
  const selectedChainId = useAdminStore((state) => state.selectedChainId);
  const network = chainIdToOpsNetwork(selectedChainId);

  const { address: walletAddress } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const { session, isAuthenticated, clearSession } = useOpsRunnerSession();
  const auth = useOpsRunnerAuth();
  const health = useOpsRunnerHealth();
  const scriptsQuery = useOpsRunnerScripts();
  const jobsQuery = useOpsRunnerJobs({ enabled: isAuthenticated, refetchIntervalMs: 3_000 });
  const runScriptMutation = useOpsRunScript();

  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const selectedJobQuery = useOpsRunnerJob(selectedJobId, {
    enabled: !!selectedJobId && isAuthenticated,
  });
  const logsState = useOpsJobLogs(selectedJobId, {
    enabled: !!selectedJobId && isAuthenticated,
    maxLogs: 1_200,
  });

  const jobs = jobsQuery.data ?? [];
  const currentJob = useMemo(() => {
    if (selectedJobQuery.data) {
      return selectedJobQuery.data;
    }
    return jobs.find((job) => job.id === selectedJobId) ?? null;
  }, [jobs, selectedJobId, selectedJobQuery.data]);

  const connectRunner = async () => {
    if (!walletAddress) {
      toastService.error({ title: formatMessage({ id: "app.deployment.ops.connectWalletFirst" }) });
      return;
    }

    try {
      const challenge = await auth.requestChallenge.mutateAsync({ address: walletAddress });
      const signature = await signMessageAsync({ message: challenge.message });
      await auth.verifySignature.mutateAsync({ address: walletAddress, signature });
      toastService.success({ title: formatMessage({ id: "app.deployment.ops.authSuccess" }) });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : formatMessage({ id: "app.error.unknown" });
      toastService.error({
        title: formatMessage({ id: "app.deployment.ops.authFailed" }),
        description: message,
      });
    }
  };

  const runScript = async (scriptId: string) => {
    if (!isAuthenticated) {
      toastService.error({ title: formatMessage({ id: "app.ops.authRequired" }) });
      return;
    }

    try {
      const job = await runScriptMutation.mutateAsync({ scriptId, network });
      setSelectedJobId(job.id);
      toastService.success({ title: formatMessage({ id: "app.ops.jobStarted" }) });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : formatMessage({ id: "app.error.unknown" });
      toastService.error({
        title: formatMessage({ id: "app.ops.runFailed" }),
        description: message,
      });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-strong">
          {formatMessage({ id: "app.ops.title" })}
        </h1>
        <p className="text-text-sub">{formatMessage({ id: "app.ops.description" })}</p>
      </div>

      <Card padding="feature">
        <div className="flex items-center mb-4">
          <RiTerminalLine className="h-5 w-5 text-information-base mr-2" />
          <h2 className="text-lg font-medium text-text-strong">
            {formatMessage({ id: "app.deployment.ops.runnerTitle" })}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`text-sm font-medium ${
              health.data?.ok ? "text-success-base" : "text-error-base"
            }`}
          >
            {health.data?.ok
              ? formatMessage({ id: "app.deployment.ops.runnerOnline" })
              : formatMessage({ id: "app.deployment.ops.runnerOffline" })}
          </span>

          {!isAuthenticated ? (
            <Button
              type="button"
              onClick={connectRunner}
              loading={auth.requestChallenge.isPending || auth.verifySignature.isPending}
            >
              {formatMessage({ id: "app.deployment.ops.authenticate" })}
            </Button>
          ) : (
            <Button type="button" variant="secondary" onClick={clearSession}>
              {formatMessage({ id: "app.deployment.ops.disconnect" })}
            </Button>
          )}

          {session?.address && <span className="text-xs text-text-soft">{session.address}</span>}
        </div>
      </Card>

      <Card padding="feature">
        <div className="flex items-center mb-4">
          <RiPlayCircleLine className="h-5 w-5 text-feature-dark mr-2" />
          <h2 className="text-lg font-medium text-text-strong">
            {formatMessage({ id: "app.ops.scriptsTitle" })}
          </h2>
        </div>

        {!isAuthenticated ? (
          <p className="text-sm text-error-base">{formatMessage({ id: "app.ops.authRequired" })}</p>
        ) : scriptsQuery.isLoading ? (
          <p className="text-sm text-text-soft">
            {formatMessage({ id: "app.ops.loadingScripts" })}
          </p>
        ) : (
          <div className="space-y-3">
            {(scriptsQuery.data ?? []).map((script) => (
              <div
                key={script.id}
                className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between rounded-lg border border-stroke-soft p-3"
              >
                <div>
                  <p className="text-sm font-medium text-text-strong">{script.id}</p>
                  <p className="text-xs text-text-soft">{script.description}</p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => runScript(script.id)}
                  loading={runScriptMutation.isPending}
                >
                  {formatMessage({ id: "app.ops.runScript" })}
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card padding="feature">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-text-strong">
            {formatMessage({ id: "app.ops.jobStatus" })}
          </h2>
          <select
            value={selectedJobId ?? ""}
            onChange={(event) => setSelectedJobId(event.target.value || null)}
            className="border border-stroke-sub rounded-lg px-2 py-1 text-sm bg-bg-white"
          >
            <option value="">{formatMessage({ id: "app.ops.selectJob" })}</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.type} · {job.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </div>

        {!selectedJobId ? (
          <p className="text-sm text-text-soft">{formatMessage({ id: "app.ops.noJobs" })}</p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm">
              <span
                className={getOpsStatusBadge(
                  currentJob?.status ?? logsState.status?.status ?? "queued"
                )}
              >
                {formatMessage({
                  id: `app.deployment.ops.status.${currentJob?.status ?? logsState.status?.status ?? "queued"}`,
                })}
              </span>
            </p>

            <pre className="text-xs bg-bg-weak rounded-lg p-3 max-h-80 overflow-auto whitespace-pre-wrap">
              {logsState.logs
                .map((entry) => `${entry.at} [${entry.stream}] ${entry.message}`)
                .join("\n")}
            </pre>

            {currentJob?.result && (
              <pre className="text-xs bg-bg-weak rounded-lg p-3 max-h-80 overflow-auto whitespace-pre-wrap">
                {JSON.stringify(currentJob.result, null, 2)}
              </pre>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
