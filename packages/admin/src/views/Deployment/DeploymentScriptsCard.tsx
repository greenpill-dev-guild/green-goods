import { RiPlayCircleLine } from "@remixicon/react";
import type { useIntl } from "react-intl";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type FormatMessage = ReturnType<typeof useIntl>["formatMessage"];

export interface OpsScript {
  id: string;
  description: string;
}

interface DeploymentScriptsCardProps {
  formatMessage: FormatMessage;
  isAuthenticated: boolean;
  scriptsLoading: boolean;
  scripts: OpsScript[];
  runScriptPending: boolean;
  runScriptAndTrack: (scriptId: string) => void;
}

export function DeploymentScriptsCard({
  formatMessage,
  isAuthenticated,
  scriptsLoading,
  scripts,
  runScriptPending,
  runScriptAndTrack,
}: DeploymentScriptsCardProps) {
  return (
    <Card padding="feature">
      <div className="flex items-center mb-4">
        <RiPlayCircleLine className="h-5 w-5 text-feature-dark mr-2" />
        <h2 className="text-lg font-medium text-text-strong">
          {formatMessage({ id: "app.ops.scriptsTitle" })}
        </h2>
      </div>

      {!isAuthenticated ? (
        <p className="text-sm text-error-base">{formatMessage({ id: "app.ops.authRequired" })}</p>
      ) : scriptsLoading ? (
        <p className="text-sm text-text-soft">{formatMessage({ id: "app.ops.loadingScripts" })}</p>
      ) : (
        <div className="space-y-3">
          {scripts.map((script) => (
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
                onClick={() => runScriptAndTrack(script.id)}
                loading={runScriptPending}
              >
                {formatMessage({ id: "app.ops.runScript" })}
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
