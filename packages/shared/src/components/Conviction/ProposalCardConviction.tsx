import type { ConvictionProposal } from "../../types/conviction";
import { cn } from "../../utils/styles/cn";
import { StatusBadge } from "../StatusBadge";
import { ConvictionMeter } from "./ConvictionMeter";

export interface ProposalCardConvictionProps {
  proposal: ConvictionProposal;
  onClick?: () => void;
  className?: string;
}

/**
 * ProposalCardConviction — one proposal rendered with its status pill,
 * conviction meter, and supporter count. Replaces the v1 for/against/abstain
 * tally card. No "OldTallyCard" exists in this codebase to migrate from —
 * this is a net-new card variant per Tier 3 of the admin design handoff.
 *
 * Spec: design_handoff_admin-revamp/screens/UI%20Review.html § 03.
 */
export function ProposalCardConviction({
  proposal,
  onClick,
  className,
}: ProposalCardConvictionProps) {
  const isInteractive = typeof onClick === "function";

  const headingId = `proposal-card-${proposal.id}-title`;
  const surfaceClass = cn(
    "flex flex-col gap-3 rounded-[var(--r-lg,16px)] p-4 text-left",
    "bg-[var(--surface-raised,rgb(var(--bg-white-0)))] shadow-[var(--e2)]",
    isInteractive &&
      "cursor-pointer transition-shadow duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)] hover:shadow-[var(--e3)] focus-visible:outline-none focus-visible:shadow-[var(--e3)] focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary-action))] motion-reduce:transition-none",
    className
  );

  const Inner = (
    <>
      <header className="flex items-start justify-between gap-3">
        <StatusBadge convictionStatus={proposal.status} size="sm" />
        <span className="text-label-sm font-medium text-text-soft tabular-nums">
          {proposal.supporters} {proposal.supporters === 1 ? "supporter" : "supporters"}
        </span>
      </header>

      <div className="flex flex-col gap-1.5">
        <h3
          id={headingId}
          className="text-title-md font-semibold text-text-strong line-clamp-2"
          title={proposal.title}
        >
          {proposal.title}
        </h3>
        {proposal.summary ? (
          <p className="text-body-sm text-text-sub line-clamp-2">{proposal.summary}</p>
        ) : null}
      </div>

      <ConvictionMeter
        conviction={proposal.conviction}
        threshold={proposal.threshold}
        dailyAccrual={proposal.dailyAccrual}
        status={proposal.status}
      />
    </>
  );

  if (isInteractive) {
    return (
      <button
        type="button"
        data-component="ProposalCardConviction"
        data-status={proposal.status}
        data-proposal-id={proposal.id}
        aria-labelledby={headingId}
        onClick={onClick}
        className={surfaceClass}
      >
        {Inner}
      </button>
    );
  }

  return (
    <article
      data-component="ProposalCardConviction"
      data-status={proposal.status}
      data-proposal-id={proposal.id}
      aria-labelledby={headingId}
      className={surfaceClass}
    >
      {Inner}
    </article>
  );
}
