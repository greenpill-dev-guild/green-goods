import { useIntl } from "react-intl";
import { PageHeader } from "@/components/Layout/PageHeader";

export default function CommunityView() {
  const { formatMessage } = useIntl();

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title={formatMessage({ id: "cockpit.community.title", defaultMessage: "Community" })}
        description={formatMessage({
          id: "cockpit.community.description",
          defaultMessage: "Manage treasury, members, and signal pools",
        })}
      />

      {/* Treasury card — full width */}
      <div className="rounded-xl border border-stroke-soft bg-bg-white p-6 shadow-elevation-1">
        <h3 className="text-base font-semibold text-text-strong">
          {formatMessage({ id: "cockpit.community.treasury", defaultMessage: "Treasury" })}
        </h3>
        <p className="mt-2 text-sm text-text-sub">
          {formatMessage({
            id: "cockpit.community.treasuryPlaceholder",
            defaultMessage: "Treasury overview will be displayed here",
          })}
        </p>
      </div>

      {/* Members + Pools — side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="rounded-xl border border-stroke-soft bg-bg-white p-6 shadow-elevation-1">
          <h3 className="text-base font-semibold text-text-strong">
            {formatMessage({ id: "cockpit.community.members", defaultMessage: "Members" })}
          </h3>
          <p className="mt-2 text-sm text-text-sub">
            {formatMessage({
              id: "cockpit.community.membersPlaceholder",
              defaultMessage: "Member management will be displayed here",
            })}
          </p>
        </div>
        <div className="rounded-xl border border-stroke-soft bg-bg-white p-6 shadow-elevation-1">
          <h3 className="text-base font-semibold text-text-strong">
            {formatMessage({ id: "cockpit.community.pools", defaultMessage: "Signal Pools" })}
          </h3>
          <p className="mt-2 text-sm text-text-sub">
            {formatMessage({
              id: "cockpit.community.poolsPlaceholder",
              defaultMessage: "Signal pool management will be displayed here",
            })}
          </p>
        </div>
      </div>
    </div>
  );
}
