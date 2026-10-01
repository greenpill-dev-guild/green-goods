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
import type { ReactNode } from "react";
import { useIntl } from "react-intl";

export interface CommitmentPeopleProps {
  commitment: CommitmentReadModel;
  contributors: CommitmentContributorRecord[];
  seat: CommitmentSeat | null;
  /** The count and unit, already in words, or null when the record has none. */
  units: string | null;
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
 * when, who is doing it, the team, and who confirms it.
 *
 * One accountable lead is named, then everyone else. Presence is never
 * presented as equal credit: a contributor's approved work and proof are what
 * count for them, and the lead is the only person who can send the promise for
 * confirmation.
 */
export function CommitmentPeople({
  commitment,
  contributors,
  seat,
  units,
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
  const confirmerIsSteward = Boolean(
    confirmer && stewards.some((steward) => same(steward, confirmer))
  );
  // The team, told as people: a helper by name, then how many more.
  const youHelp = helpers.some((entry) => same(entry.contributor, viewer));
  const namedHelper = helpers.find((entry) => !same(entry.contributor, viewer));

  return (
    <dl className="mt-1 divide-y divide-stroke-soft-200">
      {units ? (
        <Fact
          icon={isRequest ? <RiHandHeartLine /> : <RiSeedlingLine />}
          label={formatMessage({
            id: isRequest ? "app.commitments.direction.request" : "app.commitments.direction.offer",
          })}
          value={units}
        />
      ) : null}

      {commitment.dueDate ? (
        <Fact
          icon={<RiTimeLine />}
          label={formatMessage({ id: "app.commitment.people.due" })}
          value={formatDate(new Date(Number(commitment.dueDate) * 1000), {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        />
      ) : null}

      {commitment.leadProvider ? (
        <Fact
          icon={<RiUserLine />}
          label={formatMessage({ id: "app.commitment.people.provider" })}
          value={<AddressDisplay address={commitment.leadProvider} />}
          tag={seat === "provider" ? you : null}
        />
      ) : null}

      {asker && askerRow ? (
        <Fact
          icon={<RiQuestionAnswerLine />}
          label={formatMessage({ id: "app.commitment.people.askedBy" })}
          value={<AddressDisplay address={asker} />}
        />
      ) : null}

      {helpers.length > 0 ? (
        <Fact
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
        <Fact
          icon={<RiShieldCheckLine />}
          label={formatMessage({ id: "app.commitment.people.confirmer" })}
          value={<AddressDisplay address={(confirmer ?? confirmingGarden) as Address} />}
          tag={
            seat === "confirmer" ? (
              you
            ) : confirmerIsSteward ? (
              <>
                <RiShieldCheckLine className="h-3 w-3" aria-hidden="true" />
                {formatMessage({ id: "app.roles.steward" })}
              </>
            ) : null
          }
        />
      ) : null}

      {lead === undefined && commitment.contributorsFrozen ? (
        <p className="py-2.5 text-xs text-text-soft-400">
          {formatMessage({ id: "app.commitment.people.frozen" })}
        </p>
      ) : null}
    </dl>
  );
}

/** One labelled fact: an icon and its label on the start side, the value on the end. */
export function Fact({
  icon,
  label,
  value,
  tag = null,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  /** "You", or the role the person holds, beside the value. */
  tag?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <dt className="flex shrink-0 items-center gap-2 text-xs text-text-sub-600">
        <span className="flex text-text-soft-400 [&>svg]:h-4 [&>svg]:w-4" aria-hidden="true">
          {icon}
        </span>
        {label}
      </dt>
      <dd className="flex min-w-0 items-center justify-end gap-1 text-right text-sm text-text-strong-950">
        {value}
        {tag ? (
          <span className="ms-1 inline-flex shrink-0 items-center gap-1 rounded-full bg-bg-weak-50 px-2 py-0.5 text-[10px] font-medium text-text-sub-600">
            {tag}
          </span>
        ) : null}
      </dd>
    </div>
  );
}
