import {
  type CampaignCookieJarCampaign,
  type Garden,
  FormField,
  TextInput,
} from "@green-goods/shared";
import type { IntlShape } from "react-intl";
import { AdminCard } from "@/components/AdminCard";
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
}: CampaignCookieJarPanelListProps) {
  return (
    <AdminCard
      variant="outlined"
      className="flex min-h-[32rem] flex-1 flex-col overflow-hidden p-0"
    >
      <div className="border-b border-[rgb(var(--m3-outline-variant))] p-4 sm:p-5">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_16rem] md:items-end">
          <div>
            <h2 className="text-title-md font-semibold text-[rgb(var(--m3-on-surface))]">
              {formatMessage({
                id: "cockpit.community.cookies.listTitle",
                defaultMessage: "Cookie jar campaigns",
              })}
            </h2>
            <p className="mt-1 text-body-sm text-[rgb(var(--m3-on-surface-variant))]">
              {formatMessage(
                {
                  id: "cockpit.community.cookies.listDescription",
                  defaultMessage:
                    "{count, plural, one {# trusted campaign jar} other {# trusted campaign jars}} indexed for this network.",
                },
                { count: campaigns.length }
              )}
            </p>
          </div>
          <FormField
            label={formatMessage({
              id: "cockpit.community.cookies.searchCampaigns",
              defaultMessage: "Search cookie jars",
            })}
            htmlFor="campaign-cookie-jar-search"
          >
            <TextInput
              id="campaign-cookie-jar-search"
              surface="admin"
              value={campaignSearch}
              onChange={(event) => setCampaignSearch(event.target.value)}
              placeholder={formatMessage({
                id: "cockpit.community.cookies.searchCampaignsPlaceholder",
                defaultMessage: "Search by name, slug, or address",
              })}
            />
          </FormField>
        </div>
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
        <div className="flex-1 p-5 text-body-sm text-[rgb(var(--m3-error))]">
          {formatMessage({
            id: "cockpit.community.cookies.loadFailed",
            defaultMessage: "Could not load campaign cookie jars. Direct jar links still work.",
          })}
        </div>
      ) : null}
      {!campaignsLoading && !campaignsError && campaigns.length === 0 ? (
        <div className="flex flex-1 flex-col items-start justify-center gap-3 p-5">
          <p className="text-title-sm font-semibold text-[rgb(var(--m3-on-surface))]">
            {formatMessage({
              id: "cockpit.community.cookies.emptyTitle",
              defaultMessage: "No campaign cookie jars yet",
            })}
          </p>
          <p className="max-w-xl text-body-sm text-[rgb(var(--m3-on-surface-variant))]">
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
        <div className="flex-1 p-5 text-body-sm text-[rgb(var(--m3-on-surface-variant))]">
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
