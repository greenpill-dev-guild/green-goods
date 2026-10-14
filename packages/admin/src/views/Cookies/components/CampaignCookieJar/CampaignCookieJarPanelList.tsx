import type { CampaignCookieJarCampaign } from "@green-goods/shared/types/cookie-jar";
import type { Garden } from "@green-goods/shared/types/domain";
import type { ReactNode } from "react";
import type { IntlShape } from "react-intl";
import { AdminCard, AdminCardTitle } from "@/components/AdminCard";
import { AdminTextField } from "@/components/AdminTextField";
import { CampaignJarListRow } from "./CampaignJarListRow";

interface CampaignCookieJarPanelListProps {
  formatMessage: IntlShape["formatMessage"];
  campaigns: readonly CampaignCookieJarCampaign[];
  campaignsLoading: boolean;
  campaignsError: Error | null;
  campaignSearch: string;
  setCampaignSearch: (value: string) => void;
  visibleCampaigns: readonly CampaignCookieJarCampaign[];
  gardensByAddress: Map<string, Garden>;
  onSelectCampaign: (campaign: CampaignCookieJarCampaign) => void;
  headerAction?: ReactNode;
}

export function CampaignCookieJarPanelList({
  formatMessage,
  campaigns,
  campaignsLoading,
  campaignsError,
  campaignSearch,
  setCampaignSearch,
  visibleCampaigns,
  gardensByAddress,
  onSelectCampaign,
  headerAction,
}: CampaignCookieJarPanelListProps) {
  return (
    <AdminCard variant="outlined" className="flex flex-1 flex-col overflow-hidden p-0">
      <div className="space-y-3 border-b border-stroke-soft p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <AdminCardTitle as="h2">
              {formatMessage({
                id: "cockpit.community.cookies.listTitle",
                defaultMessage: "Campaign Cookie Jars",
              })}
            </AdminCardTitle>
            <p className="mt-1 text-body-sm text-text-sub">
              {formatMessage(
                {
                  id: "cockpit.community.cookies.listDescription",
                  defaultMessage:
                    "{count, plural, one {# campaign jar on this network} other {# campaign jars on this network}}.",
                },
                { count: campaigns.length }
              )}
            </p>
          </div>
          {headerAction}
        </div>
        <AdminTextField
          id="campaign-cookie-jar-search"
          className="min-w-0 md:max-w-sm"
          label={formatMessage({
            id: "cockpit.community.cookies.searchCampaigns",
            defaultMessage: "Search cookie jars",
          })}
          value={campaignSearch}
          onChange={(event) => setCampaignSearch(event.target.value)}
          placeholder={formatMessage({
            id: "cockpit.community.cookies.searchCampaignsPlaceholder",
            defaultMessage: "Search by name, slug, or address",
          })}
        />
      </div>
      {campaignsLoading ? (
        <div className="flex-1 space-y-3 p-4 sm:p-5" role="status" aria-live="polite">
          <span className="sr-only">
            {formatMessage({
              id: "cockpit.community.cookies.loadingCampaigns",
              defaultMessage: "Loading campaign cookie jars...",
            })}
          </span>
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`cookie-jar-skeleton-${index}`}
              className="h-20 rounded-sm skeleton-shimmer"
            />
          ))}
        </div>
      ) : null}
      {!campaignsLoading && campaignsError ? (
        <div className="flex-1 p-5 text-body-sm text-error-dark">
          {formatMessage({
            id: "cockpit.community.cookies.loadFailed",
            defaultMessage: "Could not load campaign cookie jars. Direct jar links still work.",
          })}
        </div>
      ) : null}
      {!campaignsLoading && !campaignsError && campaigns.length === 0 ? (
        <div className="flex flex-1 flex-col items-start justify-center gap-3 p-5">
          <p className="text-title-sm font-semibold text-text-strong">
            {formatMessage({
              id: "cockpit.community.cookies.emptyTitle",
              defaultMessage: "No campaign cookie jars yet",
            })}
          </p>
          <p className="max-w-xl text-body-sm text-text-sub">
            {formatMessage({
              id: "cockpit.community.cookies.emptyDescription",
              defaultMessage:
                "Create the first campaign jar, then it will appear here once the indexer sees it.",
            })}
          </p>
        </div>
      ) : null}
      {!campaignsLoading &&
      !campaignsError &&
      campaigns.length > 0 &&
      visibleCampaigns.length === 0 ? (
        <div className="flex-1 p-5 text-body-sm text-text-sub">
          {formatMessage({
            id: "cockpit.community.cookies.noCampaignMatches",
            defaultMessage: "No cookie jars match that search.",
          })}
        </div>
      ) : null}
      {!campaignsLoading && visibleCampaigns.length > 0 ? (
        <div>
          {visibleCampaigns.map((campaign) => (
            <CampaignJarListRow
              key={campaign.address}
              campaign={campaign}
              gardensByAddress={gardensByAddress}
              onSelect={onSelectCampaign}
            />
          ))}
        </div>
      ) : null}
    </AdminCard>
  );
}
