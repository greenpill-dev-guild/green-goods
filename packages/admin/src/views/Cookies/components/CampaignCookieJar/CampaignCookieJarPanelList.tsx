import { ItemRowSkeleton } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import type { CampaignCookieJarCampaign } from "@green-goods/shared/types/cookie-jar";
import { RiCookieLine, RiErrorWarningLine, RiSearchLine } from "@remixicon/react";
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
            <p className="mt-1 type-meta text-text-sub">
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
        // The rows' own frames while they load, so the jars land where these stood.
        <div
          className="flex flex-1 flex-col gap-(--gg-list-gap) p-4 sm:p-5"
          role="status"
          aria-live="polite"
        >
          <span className="sr-only">
            {formatMessage({
              id: "cockpit.community.cookies.loadingCampaigns",
              defaultMessage: "Loading campaign cookie jars...",
            })}
          </span>
          {Array.from({ length: 4 }).map((_, index) => (
            <ItemRowSkeleton key={`cookie-jar-skeleton-${index}`} amount />
          ))}
        </div>
      ) : null}
      {!campaignsLoading && campaignsError ? (
        <EmptyState
          className="flex-1"
          tone="error"
          icon={<RiErrorWarningLine />}
          title={formatMessage({
            id: "cockpit.community.cookies.loadFailed.title",
            defaultMessage: "Could not load campaign cookie jars",
          })}
          description={formatMessage({
            id: "cockpit.community.cookies.loadFailed.description",
            defaultMessage: "Direct jar links still work.",
          })}
        />
      ) : null}
      {!campaignsLoading && !campaignsError && campaigns.length === 0 ? (
        <EmptyState
          className="flex-1"
          icon={<RiCookieLine />}
          title={formatMessage({
            id: "cockpit.community.cookies.emptyTitle",
            defaultMessage: "No campaign cookie jars yet",
          })}
          description={formatMessage({
            id: "cockpit.community.cookies.emptyDescription",
            defaultMessage:
              "Create the first campaign jar, then it will appear here once the indexer sees it.",
          })}
        />
      ) : null}
      {!campaignsLoading &&
      !campaignsError &&
      campaigns.length > 0 &&
      visibleCampaigns.length === 0 ? (
        <EmptyState
          className="flex-1"
          icon={<RiSearchLine />}
          title={formatMessage({
            id: "cockpit.community.cookies.noCampaignMatches",
            defaultMessage: "No cookie jars match that search.",
          })}
        />
      ) : null}
      {!campaignsLoading && visibleCampaigns.length > 0 ? (
        <div className="flex flex-col gap-(--gg-list-gap) p-4 sm:p-5">
          {visibleCampaigns.map((campaign) => (
            <CampaignJarListRow
              key={campaign.address}
              campaign={campaign}
              onSelect={onSelectCampaign}
            />
          ))}
        </div>
      ) : null}
    </AdminCard>
  );
}
