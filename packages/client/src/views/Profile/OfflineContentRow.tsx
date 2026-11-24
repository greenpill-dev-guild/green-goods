import { Button } from "@green-goods/shared/components/Button";
import { useOfflineStatus } from "@green-goods/shared/hooks/offline/useOfflineContent";
import type { OfflineProgress } from "@green-goods/shared/modules/offline-content/store";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { RiDownloadCloud2Line } from "@remixicon/react";
import { type IntlShape, useIntl } from "react-intl";
import { Card } from "@/components/Cards";
import { Avatar } from "@/components/Display";

interface OfflineContentRowProps {
  /** The settings column's shared control width, so every row's control lines up. */
  controlClassName: string;
}

interface RowCopy {
  status: string;
  detail: string;
  action: string;
  onClick?: () => void;
  disabled?: boolean;
}

type ConnectivityState = ReturnType<typeof useOfflineStatus>["connectivity"]["state"];

function megabytes(intl: IntlShape, bytes: number): string {
  const value = bytes / 1_000_000;
  return intl.formatNumber(value, {
    style: "unit",
    unit: "megabyte",
    maximumFractionDigits: value < 10 ? 1 : 0,
  });
}

function describeRow(
  intl: IntlShape,
  progress: OfflineProgress,
  connectivity: ConnectivityState,
  controls: { pause: () => void; resume: () => void; refresh: () => void }
): RowCopy {
  const text = (id: string, defaultMessage: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id, defaultMessage }, values);
  const progressLine = `${megabytes(intl, progress.runBytes)} · ${intl.formatNumber(
    progress.runRatio,
    { style: "percent", maximumFractionDigits: 0 }
  )}`;
  const resume = text("app.offline.action.resume", "Resume");
  const refresh = text("app.common.refresh", "Refresh");
  const retry = text("app.common.retry", "Retry");
  const paused = text("app.offline.status.paused", "Paused");
  const running = progress.state === "downloading" || progress.state === "paused";
  const online = connectivity !== "offline";

  if (connectivity === "offline" && running) {
    return {
      status: paused,
      detail: text("app.offline.detail.noConnection", "No connection"),
      action: resume,
      disabled: true,
    };
  }
  if (connectivity === "degraded") {
    return {
      status: text("app.offline.status.degraded", "Connection unstable"),
      detail: text("app.offline.detail.degraded", "Preparation will keep trying"),
      action: running ? text("app.offline.action.pause", "Pause") : retry,
      onClick: running ? controls.pause : controls.refresh,
    };
  }
  if (progress.state === "incomplete" || progress.storageFull) {
    return {
      status: text("app.offline.status.incomplete", "Incomplete"),
      detail: progress.storageFull
        ? text("app.offline.detail.storageFull", "Storage full")
        : progress.failedReads > 0
          ? text(
              "app.offline.detail.readsMissing",
              "{count, plural, one {# list missing} other {# lists missing}}",
              { count: progress.failedReads }
            )
          : text(
              "app.offline.detail.photosMissing",
              "{count, plural, one {# photo missing} other {# photos missing}}",
              { count: progress.missingPhotos }
            ),
      action: retry,
      onClick: controls.refresh,
      disabled: !online,
    };
  }
  if (progress.state === "downloading") {
    return {
      status: text("app.offline.status.downloading", "Downloading"),
      detail: progressLine,
      action: text("app.offline.action.pause", "Pause"),
      onClick: controls.pause,
    };
  }
  if (progress.state === "paused" && progress.pauseReason === "dataSaver") {
    return {
      status: text("app.offline.status.photosPaused", "Photos paused"),
      detail: text("app.offline.detail.dataSaver", "Data Saver on"),
      action: resume,
      onClick: controls.resume,
    };
  }
  if (progress.state === "paused" && progress.pauseReason === "worker") {
    return {
      status: text("app.offline.status.workerWaiting", "App update waiting"),
      detail: text("app.offline.detail.workerWaiting", "Restart to prepare photos"),
      action: retry,
      onClick: controls.refresh,
    };
  }
  if (progress.state === "paused") {
    return { status: paused, detail: progressLine, action: resume, onClick: controls.resume };
  }
  if (progress.state === "idle") {
    return {
      status: text("app.offline.status.notPrepared", "Not prepared"),
      detail: text("app.offline.detail.notPrepared", "Preparation hasn’t started"),
      action: text("app.offline.action.start", "Start"),
      onClick: controls.refresh,
      disabled: !online,
    };
  }
  return {
    status: text("app.offline.status.ready", "Ready"),
    detail: text("app.offline.detail.saved", "{size} saved", {
      size: megabytes(intl, progress.savedBytes),
    }),
    action: refresh,
    onClick: controls.refresh,
    disabled: !online,
  };
}

/**
 * The one place offline downloads are visible. The title stays on one line and
 * the status on exactly two, each truncated rather than wrapped, so the card keeps
 * its height in every state and language at a 360 px screen.
 */
export function OfflineContentRow({ controlClassName }: OfflineContentRowProps) {
  const intl = useIntl();
  const { progress, connectivity, pause, resume, refresh } = useOfflineStatus();
  const title = intl.formatMessage({
    id: "app.offline.preparation.title",
    defaultMessage: "Offline",
  });
  const row = describeRow(intl, progress, connectivity.state, { pause, resume, refresh });

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3 w-full">
        <Avatar>
          <RiDownloadCloud2Line className="h-4 w-4 text-primary-on-surface" aria-hidden="true" />
        </Avatar>
        <div className="flex flex-col gap-0.5 min-w-0 flex-1 basis-0">
          <div className="text-sm font-medium truncate" title={title}>
            {title}
          </div>
          <div role="status" aria-label={title} className="min-h-8 text-xs text-text-sub-600">
            <span className="block truncate">{row.status}</span>
            {/* Wraps rather than cuts: these lines run long in Spanish and Portuguese (DL-159). */}
            <span className="block">{row.detail}</span>
          </div>
        </div>
        <Button
          type="button"
          emphasis="secondary"
          size="sm"
          // Under the title on a phone too narrow for both, as the other settings' controls do.
          className={cn(controlClassName, "@max-[328px]:w-full @max-[328px]:basis-full")}
          disabled={row.disabled}
          onClick={row.onClick}
        >
          {row.action}
        </Button>
      </div>
    </Card>
  );
}
