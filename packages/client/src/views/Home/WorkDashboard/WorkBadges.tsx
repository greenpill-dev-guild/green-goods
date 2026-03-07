import { type Address, compareAddresses, type Work } from "@green-goods/shared";
import { RiCheckLine, RiTimeLine } from "@remixicon/react";
import React from "react";
import { useIntl } from "react-intl";

interface WorkBadgesContext {
  activeAddress: Address | undefined;
  reviewerGardenIds: string[];
  reviewedByYou: Set<string>;
  isUserAddress: (address: Address | undefined) => boolean;
}

export function createWorkBadgeRenderer(ctx: WorkBadgesContext) {
  return function renderWorkBadges(item: Work): React.ReactNode[] {
    const badges: React.ReactNode[] = [];
    const isGardener = ctx.isUserAddress(item.gardenerAddress);
    const isOperator =
      ctx.activeAddress &&
      ctx.reviewerGardenIds.some((id) => compareAddresses(id, item.gardenAddress));
    const reviewed = ctx.reviewedByYou.has(item.id);

    if (isOperator && !reviewed) {
      badges.push(<NeedsReviewBadge key="review" />);
    }
    if (reviewed) {
      badges.push(<ReviewedByYouBadge key="reviewed" />);
    }
    if (isGardener) {
      badges.push(<YouSubmittedBadge key="submitted" />);
    }
    return badges;
  };
}

export const NeedsReviewBadge: React.FC = () => {
  const intl = useIntl();
  return (
    <span className="badge-pill-amber">
      <RiTimeLine className="w-3 h-3" />
      {intl.formatMessage({
        id: "app.workDashboard.badge.needsReview",
        defaultMessage: "Needs review",
      })}
    </span>
  );
};

export const ReviewedByYouBadge: React.FC = () => {
  const intl = useIntl();
  return (
    <span className="badge-pill-emerald">
      <RiCheckLine className="w-3 h-3" />
      {intl.formatMessage({
        id: "app.workDashboard.badge.reviewedByYou",
        defaultMessage: "Reviewed by you",
      })}
    </span>
  );
};

export const YouSubmittedBadge: React.FC = () => {
  const intl = useIntl();
  return (
    <span className="badge-pill-slate">
      {intl.formatMessage({
        id: "app.workDashboard.badge.youSubmitted",
        defaultMessage: "You submitted",
      })}
    </span>
  );
};

export function renderApprovalBadges(): React.ReactNode[] {
  return [<ReviewedByYouBadge key="reviewed" />];
}

export const YourWorkReviewedBadge: React.FC = () => {
  const intl = useIntl();
  return (
    <span className="badge-pill-slate">
      {intl.formatMessage({
        id: "app.workDashboard.badge.yourWorkReviewed",
        defaultMessage: "Your work was reviewed",
      })}
    </span>
  );
};

export function renderMyWorkReviewedBadges(): React.ReactNode[] {
  return [<YourWorkReviewedBadge key="work-reviewed" />];
}
