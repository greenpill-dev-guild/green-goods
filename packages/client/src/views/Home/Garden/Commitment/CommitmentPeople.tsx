import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import { AddressDisplay } from "@green-goods/shared/components/AddressDisplay";
import {
  type CommitmentContributorRecord,
  type CommitmentReadModel,
  type CommitmentSeat,
  selectOrdinaryConfirmer,
} from "@green-goods/shared/commitment-pooling";
import type { Address } from "@green-goods/shared/types/domain";
import {
  RiGroupLine,
  RiHandHeartLine,
  RiQuestionAnswerLine,
  RiSeedlingLine,
  RiShieldCheckLine,
  RiTimeLine,
  RiUserLine,
} from "@remixicon/react";
import { useIntl } from "react-intl";

import { PromiseRewardRow } from "@/components/Features/Commitments";

export interface CommitmentPeopleProps {
  commitment: CommitmentReadModel;
  contributors: CommitmentContributorRecord[];
  seat: CommitmentSeat | null;
  /** The count and unit, already in words, or null when the record has none. */
  units: string | null;
  /** The reward it carries, in words, or null when it carries none or the page doesn't say. */
  reward?: string | null;
  /** Who is reading, so the team can say "You" rather than their name. */
  viewer: Address | null;
  /** The stewards of the promise's garden, so whoever confirms it carries the role. */
  stewards: readonly Address[];
}

/** Addresses arrive checksummed and lowercase alike, so identity is compared case-blind. */
const same = (a?: string | null, b?: string | null) =>
  Boolean(a && b && a.toLowerCase() === b.toLowerCase());

/**
 * Whoever confirms this promise, when one person does, by the contract's ordinary
 * rule. The "Confirms it" row and the status sentence name the same person.
 */
export function confirmerOf(
  commitment: CommitmentReadModel,
  contributors: readonly CommitmentContributorRecord[]
): Address | null {
  return selectOrdinaryConfirmer({
    confirmers: commitment.confirmers,
    direction: commitment.direction,
    counterpartyKind: commitment.counterpartyKind,
    creator: commitment.creator,
    counterparty: commitment.counterparty,
    activeContributors: contributors
      .filter((entry) => entry.active)
      .map((entry) => entry.contributor),
  });
}

/**
 * What was promised and who is on it, as labelled facts: what and how much, by
 * when, what keeping it earns, who is doing it, the team, and who confirms it.
 *
 * One accountable lead is named, then everyone else. Presence is never
 * presented as equal credit: a contributor's approved work and proof are what
 * count for them, and the lead is the only person who can send the promise for
 * confirmation.
 */
export function CommitmentPeople({
  commitment,
  contributors,
  units,
  reward = null,
  viewer,
  stewards,
}: CommitmentPeopleProps) {
  const { formatMessage, formatDate } = useIntl();
  const active = contributors.filter((entry) => entry.active);
  const lead = active.find((entry) => entry.isLead);
  const helpers = active.filter((entry) => !entry.isLead);
  const isRequest = commitment.direction === "REQUEST";
  // A request is never anonymous: the record knows who asked (the creator), and
  // the decision "do I want to help this neighbour" deserves the name.
  const asker = isRequest ? commitment.creator : null;
  const confirmer = confirmerOf(commitment, contributors);
  // An Offer a garden took up is confirmed by that garden's stewards: no one
  // name speaks for them, so the row names the garden.
  const confirmingGarden =
    !isRequest && commitment.counterpartyKind === "GARDEN" && commitment.confirmers.length === 0
      ? (commitment.counterparty ?? null)
      : null;
  // The asker needs their own row only when someone else confirms; when they
  // confirm, the "Confirms it" row names them once.
  const askerRow = Boolean(
    asker && !same(asker, commitment.leadProvider) && !same(asker, confirmer)
  );
  const you = formatMessage({ id: "app.commitment.people.you" });
  const identity = (address: Address) =>
    same(address, viewer) ? (
      <div className="min-w-0 text-right">
        <span className="block font-semibold text-primary-on-surface">{you}</span>
        <AddressDisplay address={address} className="text-xs text-text-sub-600" />
      </div>
    ) : (
      <AddressDisplay address={address} />
    );
  const confirmerIsSteward = Boolean(
    confirmer && stewards.some((steward) => same(steward, confirmer))
  );
  // The team, told as people: a helper by name, then how many more.
  const youHelp = helpers.some((entry) => same(entry.contributor, viewer));
  const namedHelper = helpers.find((entry) => !same(entry.contributor, viewer));

  return (
    <>
      <FactList frame="inset" className="mt-1">
        {units ? (
          <FactRow
            icon={isRequest ? <RiHandHeartLine /> : <RiSeedlingLine />}
            label={formatMessage({
              id: isRequest
                ? "app.commitments.direction.request"
                : "app.commitments.direction.offer",
            })}
            value={units}
          />
        ) : null}

        {commitment.dueDate ? (
          <FactRow
            icon={<RiTimeLine />}
            label={formatMessage({ id: "app.commitment.people.due" })}
            value={formatDate(new Date(Number(commitment.dueDate) * 1000), {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          />
        ) : null}

        {reward ? <PromiseRewardRow text={reward} /> : null}

        {commitment.leadProvider ? (
          <FactRow
            icon={<RiUserLine />}
            label={formatMessage({ id: "app.commitment.people.provider" })}
            value={identity(commitment.leadProvider)}
          />
        ) : null}

        {asker && askerRow ? (
          <FactRow
            icon={<RiQuestionAnswerLine />}
            label={formatMessage({ id: "app.commitment.people.askedBy" })}
            value={identity(asker)}
          />
        ) : null}

        {helpers.length > 0 ? (
          <FactRow
            icon={<RiGroupLine />}
            label={formatMessage({ id: "app.commitment.people.team" })}
            value={formatMessage(
              { id: "app.commitment.people.helping" },
              {
                who: youHelp ? "you" : "other",
                name: namedHelper ? (
                  <AddressDisplay
                    key="helper"
                    address={namedHelper.contributor}
                    interactive={false}
                    className="inline"
                  />
                ) : null,
                others: helpers.length - 1,
              }
            )}
          />
        ) : null}

        {confirmer || confirmingGarden ? (
          <FactRow
            icon={<RiShieldCheckLine />}
            label={formatMessage({ id: "app.commitment.people.confirmer" })}
            value={
              <span className="inline-flex flex-wrap items-center gap-1">
                {identity((confirmer ?? confirmingGarden) as Address)}
                {confirmerIsSteward ? (
                  <span className="ms-1 inline-flex shrink-0 items-center gap-1 rounded-full bg-bg-weak-50 px-2 py-0.5 text-[10px] font-medium text-text-sub-600">
                    <RiShieldCheckLine className="h-3 w-3" aria-hidden="true" />
                    {formatMessage({ id: "app.roles.steward" })}
                  </span>
                ) : null}
              </span>
            }
          />
        ) : null}
      </FactList>
      {lead === undefined && commitment.contributorsFrozen ? (
        <p className="border-t border-stroke-soft-200 py-2.5 text-xs text-text-soft-400">
          {formatMessage({ id: "app.commitment.people.frozen" })}
        </p>
      ) : null}
    </>
  );
}
