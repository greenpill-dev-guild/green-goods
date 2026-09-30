import type { TabBadgeSeverity } from "@green-goods/shared/types/garden-detail";
import { useIntl } from "react-intl";
import { AdminCard, AdminCardBody, AdminCardHeader, AdminCardTitle } from "@/components/AdminCard";
import { AlertRow } from "./GardenDetailHelpers";

export interface GardenAlert {
  key: string;
  severity: Exclude<TabBadgeSeverity, "none">;
  label: string;
  onAction: () => void;
}

/**
 * Attention Needed: what the garden needs from its steward next. It sits in the
 * tab's rail, except on phones, where it leads above the main column (DL-051).
 */
export function GardenAlertsCard({ alerts }: { alerts: GardenAlert[] }) {
  const { formatMessage } = useIntl();

  return (
    <AdminCard density="none" data-component="GardenAlertsCard">
      <AdminCardHeader>
        <AdminCardTitle>{formatMessage({ id: "app.garden.detail.alerts.title" })}</AdminCardTitle>
      </AdminCardHeader>
      <AdminCardBody>
        {alerts.length === 0 ? (
          <p className="body-sm text-text-soft">
            {formatMessage({ id: "app.garden.detail.alerts.none" })}
          </p>
        ) : (
          <div className="space-y-2">
            {alerts.map((alert) => (
              <AlertRow
                key={alert.key}
                severity={alert.severity}
                label={alert.label}
                actionLabel={formatMessage({ id: "app.actions.view" })}
                onAction={alert.onAction}
              />
            ))}
          </div>
        )}
      </AdminCardBody>
    </AdminCard>
  );
}
