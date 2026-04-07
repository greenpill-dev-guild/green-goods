import {
  RiCodeBoxLine,
  RiGitBranchLine,
  RiSettings3Line,
  RiShieldCheckLine,
} from "@remixicon/react";
import type { useIntl } from "react-intl";
import { Card } from "@/components/ui/Card";

type FormatMessage = ReturnType<typeof useIntl>["formatMessage"];

export interface DeploymentPermissions {
  isOwner: boolean;
  isInAllowlist: boolean;
  canDeploy: boolean;
}

interface DeploymentPermissionsCardProps {
  formatMessage: FormatMessage;
  permissions: DeploymentPermissions;
}

export function DeploymentPermissionsCard({
  formatMessage,
  permissions,
}: DeploymentPermissionsCardProps) {
  return (
    <Card padding="feature">
      <div className="flex items-center mb-4">
        <RiShieldCheckLine className="h-5 w-5 text-information-base mr-2" />
        <h2 className="text-lg font-medium text-text-strong">
          {formatMessage({ id: "app.deployment.permissions" })}
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="text-center">
          <div
            className={`inline-flex items-center justify-center w-12 h-12 rounded-full mb-2 ${
              permissions.isOwner
                ? "bg-success-lighter text-success-base"
                : "bg-bg-weak text-text-disabled"
            }`}
          >
            <RiSettings3Line className="w-6 h-6" />
          </div>
          <p className="text-sm font-medium text-text-strong">
            {formatMessage({ id: "app.deployment.role.owner" })}
          </p>
          <p className={`text-xs ${permissions.isOwner ? "text-success-base" : "text-text-soft"}`}>
            {permissions.isOwner
              ? formatMessage({ id: "app.deployment.enabled" })
              : formatMessage({ id: "app.deployment.notAuthorized" })}
          </p>
        </div>
        <div className="text-center">
          <div
            className={`inline-flex items-center justify-center w-12 h-12 rounded-full mb-2 ${
              permissions.isInAllowlist
                ? "bg-information-lighter text-information-base"
                : "bg-bg-weak text-text-disabled"
            }`}
          >
            <RiCodeBoxLine className="w-6 h-6" />
          </div>
          <p className="text-sm font-medium text-text-strong">
            {formatMessage({ id: "app.deployment.role.allowlisted" })}
          </p>
          <p
            className={`text-xs ${permissions.isInAllowlist ? "text-information-base" : "text-text-soft"}`}
          >
            {permissions.isInAllowlist
              ? formatMessage({ id: "app.deployment.enabled" })
              : formatMessage({ id: "app.deployment.notAuthorized" })}
          </p>
        </div>
        <div className="text-center">
          <div
            className={`inline-flex items-center justify-center w-12 h-12 rounded-full mb-2 ${
              permissions.canDeploy
                ? "bg-feature-lighter text-feature-dark"
                : "bg-bg-weak text-text-disabled"
            }`}
          >
            <RiGitBranchLine className="w-6 h-6" />
          </div>
          <p className="text-sm font-medium text-text-strong">
            {formatMessage({ id: "app.deployment.role.canDeploy" })}
          </p>
          <p
            className={`text-xs ${permissions.canDeploy ? "text-feature-dark" : "text-text-soft"}`}
          >
            {permissions.canDeploy
              ? formatMessage({ id: "app.deployment.authorized" })
              : formatMessage({ id: "app.deployment.notAuthorized" })}
          </p>
        </div>
      </div>
    </Card>
  );
}
