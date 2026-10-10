import type { Address } from "@green-goods/shared/types/domain";
import { createLogger } from "../../logger";
import type { ReportingCopyKey } from "../copy";
import type { DraftRecord } from "../drafts";
import { type GardenScope, gardenScope, gardensIn, type ReportingGarden } from "../gardens";
import type { PromptOption, PromptRecord } from "../prompts";
import type { ReportingCore } from "../runtime";
import type { OutboundMessage } from "../transport";
import { accountLink } from "./account-link";
import type { ConversationWriter } from "./writer";

const log = createLogger("reporting");

/**
 * The garden step: how a report comes to name its garden. A chat with no account chooses from
 * every garden that accepts reports. A linked chat is offered only the gardens its account
 * reports to; with none it is shown how to join one, and when they cannot be read it is asked to
 * try again, never shown every garden instead. A choice made here only names the garden: the
 * account's role there is read from the chain before anything is published.
 */

/**
 * How old the garden list may be when a linked account's gardens are about to be used. Short
 * enough that Check again shows a garden joined a moment ago, long enough that taps and messages
 * in a row share one read of the indexer.
 */
const OWN_GARDENS_MAX_AGE_MS = 10_000;

/**
 * The same, when the person has asked to look again. Their reply gets a read of its own even
 * while a failed one is waiting to be repeated, so Try again does try, as it does for a garden's
 * activities. Replies moments apart, in one chat or several, share a read.
 */
const LOOK_AGAIN_MAX_AGE_MS = 3_000;

/**
 * Reads the garden list again before a linked account's gardens are used, unless it was read
 * moments ago. A garden joined on the link page a minute ago should be there, and an account must
 * not be told it has none from an old list. A read that fails is answered by the directory, which
 * then says the account's gardens cannot be read. `lookAgain` is for a reply that asks for
 * exactly that.
 */
export async function readOwnGardens(core: ReportingCore, lookAgain = false): Promise<void> {
  const now = core.clock.now();
  const read = lookAgain
    ? core.gardens.refresh(now, LOOK_AGAIN_MAX_AGE_MS, LOOK_AGAIN_MAX_AGE_MS)
    : core.gardens.refresh(now, OWN_GARDENS_MAX_AGE_MS);
  await read.catch((err) =>
    log.warn({ err }, "Could not read the garden list for a linked account")
  );
}

/** The garden question's choices that are not gardens. */
export const JOIN_CHOICE = "choice:join";
export const AGAIN_CHOICE = "choice:again";

const option = (id: string, label: string, value: string): PromptOption => ({ id, label, value });

function chunks<T>(items: readonly T[], size: number): T[][] {
  const pages: T[][] = [];
  for (let start = 0; start < items.length; start += size)
    pages.push(items.slice(start, start + size));
  return pages;
}

/**
 * The garden a garden question's answer names: the chosen option, its number, or a name that
 * matches exactly one garden. Only a garden the chat may choose counts, whatever the question
 * offered when it was asked. Names are steward-editable and need not be unique.
 */
export function answeredGarden(
  scope: GardenScope,
  prompt: PromptRecord,
  chosen: PromptOption | null | undefined,
  text: string | null | undefined
): ReportingGarden | null {
  const gardens = gardensIn(scope);
  const key = (chosen ?? prompt.options[Number(text) - 1])?.value;
  if (key) return gardens.find((garden) => garden.key === key) ?? null;
  const name = text?.trim().toLowerCase();
  const named = name ? gardens.filter((garden) => garden.label.toLowerCase() === name) : [];
  return named.length === 1 ? (named[0] as ReportingGarden) : null;
}

/** Whether a garden question showed gardens, and so has a choice among them to explain. */
export function offeredGardens(prompt: PromptRecord): boolean {
  return prompt.options.some(
    ({ value }) => value !== JOIN_CHOICE && value !== AGAIN_CHOICE && !value.startsWith("page:")
  );
}

/**
 * Whether a reply to this question asks to look at the account's gardens again. A garden
 * question with no garden to offer has that one choice (Try again, Check again or Show my
 * gardens), and any other words sent to it are taken the same way.
 */
export function asksToLookAgain(prompt: PromptRecord): boolean {
  return prompt.kind === "select_garden" && !offeredGardens(prompt);
}

function ask(
  writer: ConversationWriter,
  draft: DraftRecord,
  question: {
    options: PromptOption[];
    page?: number;
    link?: OutboundMessage["link"];
    copy?: OutboundMessage["copy"];
  },
  text: () => string
): void {
  writer.ask(
    {
      subjectKind: "draft",
      resourceId: draft.id,
      resourceRevision: draft.revision,
      kind: "select_garden",
      options: question.options,
      page: question.page ?? 0,
    },
    text,
    question.link,
    question.copy
  );
}

/** Asks which garden a report is for. `account` is the chat's linked account, when it has one. */
export function askGarden(
  writer: ConversationWriter,
  draft: DraftRecord,
  account: Address | null,
  page = 0
): void {
  const scope = gardenScope(writer.core.gardens, account);
  if (scope.kind === "unavailable") {
    const again = option("again", writer.text("report.tryAgain"), AGAIN_CHOICE);
    return ask(writer, draft, { options: [again] }, () =>
      writer.text("report.ownGardensUnavailable")
    );
  }
  if (account && scope.gardens.length === 0) return askJoin(writer, draft, account);
  const pages = chunks(scope.gardens, writer.core.settings.choicePageSize);
  // A page that no longer exists, because the list changed since it was offered, starts over.
  const index = pages[page] ? page : 0;
  const shown = pages[index];
  if (!shown) {
    // With no account, the list only comes back empty when the indexer could not be read.
    writer.say("report.gardensUnavailable");
    return;
  }
  const options = shown.map((garden, position) => option(`${position}`, garden.label, garden.key));
  if (pages[index + 1])
    options.push(option("more", writer.text("report.moreChoices"), `page:${index + 1}`));
  else if (account) options.push(option("join", writer.text("report.joinAnother"), JOIN_CHOICE));
  ask(writer, draft, { options, page: index }, () =>
    writer.text(account ? "report.askOwnGarden" : "report.askGarden")
  );
}

/**
 * What a linked account is told about reporting to a garden it is not in. The Community Garden
 * can be joined from the link's page, where the chain decides whether it takes the account; any
 * other garden needs one of its stewards.
 */
function joinGuidance(
  writer: ConversationWriter,
  account: Address
): { none: boolean; community: OutboundMessage["link"] | null } {
  const { core, target } = writer;
  const memberships = core.gardens.membershipsOf(account);
  const own = memberships.ok ? memberships.gardens : null;
  const community = core.settings.communityGarden?.toLowerCase();
  const joinable = community !== undefined && !own?.some((garden) => garden.address === community);
  return {
    none: own?.length === 0,
    community:
      joinable && target.binding
        ? {
            url: accountLink(writer, target.binding, account),
            label: writer.text("link.joinCommunityLabel"),
          }
        : null,
  };
}

/**
 * Shows a report's account how to come to report to another garden, or to its first. The one
 * choice looks at the account's gardens again.
 */
export function askJoin(writer: ConversationWriter, draft: DraftRecord, account: Address): void {
  const { none, community } = joinGuidance(writer, account);
  const key: ReportingCopyKey = none
    ? community
      ? "report.joinFirst"
      : "report.joinFirstSteward"
    : community
      ? "report.joinAnotherHow"
      : "report.joinAnotherSteward";
  const again = option(
    "again",
    writer.text(none ? "report.checkAgain" : "report.showMyGardens"),
    AGAIN_CHOICE
  );
  // The account is what a steward needs, so it can be copied from here.
  const copy = { label: writer.text("link.copyAddress"), text: account };
  ask(writer, draft, { options: [again], copy, ...(community ? { link: community } : {}) }, () =>
    writer.text(key, { account })
  );
}

/** The same guidance for a chat with no report under way, which has no question to return to. */
export function sayJoin(writer: ConversationWriter, account: Address): void {
  const { community } = joinGuidance(writer, account);
  if (community) writer.sayWithAccount("link.joinCommunity", {}, account, community);
  else writer.sayWithAccount("report.joinAnotherSteward", {}, account);
}

/**
 * Says which garden a report took without asking. Changing it and joining another stay one tap
 * away where the channel draws buttons, and two command words where it does not.
 */
export function announceGarden(writer: ConversationWriter, garden: ReportingGarden): void {
  const buttons = writer.usesButtons();
  writer.sayWithCommands(
    "report.gardenTaken",
    { garden: garden.label, how: buttons ? "" : writer.text("report.gardenTakenWords") },
    buttons
      ? [
          { word: "garden", label: writer.text("report.changeGarden") },
          { word: "join", label: writer.text("report.joinAnother") },
        ]
      : []
  );
}
