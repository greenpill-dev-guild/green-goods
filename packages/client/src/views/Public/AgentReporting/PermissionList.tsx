import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import type { useAgentReportingPermissions } from "@green-goods/shared/hooks/agent-reporting/useAgentReportingPermissions";
import { type ReactNode, useId } from "react";
import { useIntl } from "react-intl";

type Permissions = ReturnType<typeof useAgentReportingPermissions>["permissions"];

/**
 * What a check found on the account: each permission by what it is, its id, and whether it is
 * still active. Status is a labelled badge, never colour alone. The act that removes them sits
 * under the list it acts on, so the page's bar keeps to the one act that is always there.
 */
export function PermissionList({
  permissions,
  action = null,
}: {
  permissions: Permissions;
  /** What can be done about the permissions listed, while any is active. */
  action?: ReactNode;
}) {
  const intl = useIntl();
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className="rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-white-0 p-4"
    >
      <h2 id={headingId} className="text-sm font-semibold leading-5 text-text-strong-950">
        {intl.formatMessage({
          id: "public.reporting.permissions.found",
          defaultMessage: "Permissions found",
        })}
      </h2>
      <ul className="mt-1 divide-y divide-stroke-soft-200">
        {permissions.map((permission) => (
          <li
            key={permission.permissionId}
            className="flex min-w-0 items-start justify-between gap-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-strong-950">
                {intl.formatMessage(
                  permission.descriptor
                    ? {
                        id: "public.reporting.permissions.reporting",
                        defaultMessage: "Reporting permission",
                      }
                    : {
                        id: "public.reporting.permissions.other",
                        defaultMessage: "Account permission",
                      }
                )}
              </p>
              <p className="mt-0.5 break-all font-mono text-xs leading-5 text-text-sub-600">
                {permission.permissionId}
              </p>
            </div>
            <StatusBadge size="xs" variant={permission.active ? "success" : "neutral"}>
              {intl.formatMessage(
                permission.active
                  ? { id: "public.reporting.permissions.active", defaultMessage: "Active" }
                  : { id: "public.reporting.permissions.inactive", defaultMessage: "Inactive" }
              )}
            </StatusBadge>
          </li>
        ))}
      </ul>
      {action ? <div className="mt-3 flex">{action}</div> : null}
    </section>
  );
}
