import type { useIntl } from "react-intl";
import { Card } from "@/components/ui/Card";
import { getOpsStatusBadge } from "@/utils/ops";

type FormatMessage = ReturnType<typeof useIntl>["formatMessage"];

interface OpsJob {
  id: string;
  type: string;
  status?: string;
  result?: unknown;
}

interface JobLogEntry {
  at: string;
  stream: string;
  message: string;
}

interface JobLogsState {
  logs: JobLogEntry[];
  error?: string | null;
  status?: {
    status?: string;
  } | null;
}

interface DeploymentJobMonitorProps {
  formatMessage: FormatMessage;
  selectedJobId: string | null;
  setSelectedJobId: (jobId: string | null) => void;
  recentJobs: OpsJob[];
  currentJob: OpsJob | null;
  jobLogs: JobLogsState;
}

export function DeploymentJobMonitor({
  formatMessage,
  selectedJobId,
  setSelectedJobId,
  recentJobs,
  currentJob,
  jobLogs,
}: DeploymentJobMonitorProps) {
  const status = currentJob?.status ?? jobLogs.status?.status ?? "queued";

  return (
    <Card padding="feature">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium text-text-strong">
          {formatMessage({ id: "app.deployment.ops.statusTitle" })}
        </h2>
        <select
          value={selectedJobId ?? ""}
          onChange={(event) => setSelectedJobId(event.target.value || null)}
          className="border border-stroke-sub rounded-lg px-2 py-1 text-sm bg-bg-white"
        >
          <option value="">{formatMessage({ id: "app.deployment.ops.selectJob" })}</option>
          {recentJobs.map((job) => (
            <option key={job.id} value={job.id}>
              {job.type} · {job.id.slice(0, 8)}
            </option>
          ))}
        </select>
      </div>

      {!selectedJobId ? (
        <p className="text-sm text-text-soft">
          {formatMessage({ id: "app.deployment.ops.noJobs" })}
        </p>
      ) : (
        <div className="space-y-3">
          <div className="text-sm text-text-sub">
            <span className="mr-2">{formatMessage({ id: "app.deployment.ops.jobLabel" })}:</span>
            <code>{selectedJobId}</code>
          </div>

          <div className="text-sm">
            <span className="text-text-sub mr-2">
              {formatMessage({ id: "app.deployment.statusLabel" })}:
            </span>
            <span className={getOpsStatusBadge(status)}>
              {formatMessage({ id: `app.deployment.ops.status.${status}` })}
            </span>
          </div>

          <div>
            <p className="text-sm font-medium text-text-strong mb-2">
              {formatMessage({ id: "app.deployment.ops.liveLogs" })}
            </p>
            <pre className="text-xs bg-bg-weak rounded-lg p-3 max-h-80 overflow-auto whitespace-pre-wrap">
              {jobLogs.logs
                .map((entry) => `${entry.at} [${entry.stream}] ${entry.message}`)
                .join("\n")}
            </pre>
            {jobLogs.error && <p className="text-xs text-error-base mt-2">{jobLogs.error}</p>}
          </div>

          {currentJob?.result && (
            <div>
              <p className="text-sm font-medium text-text-strong mb-2">
                {formatMessage({ id: "app.deployment.ops.result" })}
              </p>
              <pre className="text-xs bg-bg-weak rounded-lg p-3 max-h-80 overflow-auto whitespace-pre-wrap">
                {JSON.stringify(currentJob.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
