import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadDraft } from "../../services/reporting/drafts";
import { openPrompt } from "../../services/reporting/prompts";
import { TestBrowser } from "./support/browser";
import { AIYELOJA, TAS } from "./support/fixtures";
import {
  adaAccount,
  bolaAccount,
  confirmLinkAndPublish,
  latestLink,
  openSigningPage,
  reportOutcome,
  reserve,
} from "./support/flows";
import { ADA, Harness } from "./support/harness";

/**
 * "Same as last time?": the garden and activity of the linked account's last published report,
 * offered once to its next one. What is offered, what is never carried over, and when the offer
 * stops being made.
 */
let harness: Harness;

beforeEach(() => {
  harness = new Harness();
});

afterEach(() => {
  harness.close();
});

const DAY = 24 * 60 * 60 * 1000;
const SUGGESTION =
  "Same as last time: Tree planting at TAS?\n1. Yes\n2. Something else\n3. Don't suggest this";
const OWN_GARDENS =
  "Which of your gardens is this report for?\n1. TAS\n2. Aiyeloja Family Garden\n3. Join another garden";

/** Ada, in both gardens, publishes a Tree planting report at TAS from this chat. */
async function published(): Promise<void> {
  harness.chain.grantRole(AIYELOJA.address, adaAccount.address, { gardener: true });
  await confirmLinkAndPublish(harness);
  const { browser, view, envelope } = await openSigningPage(harness);
  const attempt = await reserve(browser, view, envelope);
  const hash = harness.chain.submit({
    attester: adaAccount.address,
    to: envelope.call.to,
    data: envelope.call.data,
  });
  await reportOutcome(browser, view, envelope, attempt.body.attemptId, {
    kind: "broadcast",
    transactionHash: hash,
  });
  await harness.drain();
}

function openReport() {
  const row = harness.core.db
    .query("SELECT id FROM work_drafts WHERE lifecycle = 'open'")
    .get() as { id: string } | null;
  const draft = row ? loadDraft(harness.core, row.id) : null;
  if (!draft) throw new Error("No report is open");
  return {
    garden: draft.content.garden?.address ?? null,
    activity: draft.content.actionUID,
    details: draft.content.details,
    minutes: draft.content.timeSpentMinutes,
    photos: draft.content.evidence.length,
    question: openPrompt(harness.core, draft.conversationId)?.kind ?? null,
  };
}

const NEXT_STORY = "We were back at the fence today";

describe("suggesting the last report's garden and activity", () => {
  it("offers them once, takes them on yes, and carries nothing else over", async () => {
    await published();

    expect(await harness.say(ADA, NEXT_STORY)).toEqual([SUGGESTION]);
    const replies = await harness.press(ADA, "Yes");
    expect(openReport()).toEqual({
      garden: TAS.address,
      activity: 7,
      // The last report had 12 seedlings, baobab and three hours: none of it is in this one.
      details: {},
      minutes: null,
      photos: 0,
      question: "field",
    });
    expect(replies[0]).toContain("Got it: Tree planting at TAS. 3 quick questions");

    // The offer is made once for a report: changing the garden later asks the plain question.
    expect(await harness.say(ADA, "GARDEN")).toEqual([OWN_GARDENS]);
  });

  it("asks the ordinary question when something else is chosen, or other words are sent", async () => {
    await published();
    await harness.say(ADA, NEXT_STORY);
    expect(await harness.press(ADA, "Something else")).toEqual([OWN_GARDENS]);
    expect(openReport()).toMatchObject({ garden: null, activity: null });

    await harness.say(ADA, "CANCEL");
    await harness.say(ADA, NEXT_STORY);
    // Typed words are not an answer to the offer: they are heard as part of the report.
    const replies = await harness.say(ADA, "no, this was somewhere else");
    expect(replies.at(-1)).toBe(OWN_GARDENS);
  });

  it("suggests only what still stands: the garden alone, or nothing", async () => {
    await published();
    // TAS no longer offers Tree planting: the garden is still offered, the activity is asked.
    const activities = harness.catalog.actions.get(TAS.key) ?? [];
    harness.catalog.actions.set(
      TAS.key,
      activities.filter((activity) => activity.definition.actionUID !== 7)
    );
    expect(await harness.say(ADA, NEXT_STORY)).toEqual([
      "Same garden as last time: TAS?\n1. Yes\n2. Something else\n3. Don't suggest this",
    ]);
    await harness.press(ADA, "Yes");
    expect(openReport()).toMatchObject({ garden: TAS.address, activity: null });

    // The account no longer reports to TAS: a suggestion gives no one a place in a garden.
    await harness.say(ADA, "CANCEL");
    harness.chain.grantRole(TAS.address, adaAccount.address, {});
    harness.clock.advance(10 * 60 * 1000);
    const replies = await harness.say(ADA, NEXT_STORY);
    expect(replies.join("\n")).not.toContain("last time");
    expect(openReport().garden).not.toBe(TAS.address);
  });

  it("never offers one account's last report to another", async () => {
    await published();
    harness.chain.grantRole(TAS.address, bolaAccount.address, { gardener: true });
    harness.chain.grantRole(AIYELOJA.address, bolaAccount.address, { gardener: true });
    await harness.say(ADA, "SWITCH");
    const browser = new TestBrowser(harness.app);
    await browser.open(latestLink(harness));
    const proof = await browser.prove(bolaAccount);
    await harness.say(ADA, `PAIR ${proof.body.pairingCode}`);

    expect(await harness.say(ADA, NEXT_STORY)).toEqual([OWN_GARDENS]);
  });

  it("closes an open offer when the account changes, so no other account takes it", async () => {
    await published();
    harness.chain.grantRole(TAS.address, bolaAccount.address, { gardener: true });
    harness.chain.grantRole(AIYELOJA.address, bolaAccount.address, { gardener: true });
    expect(await harness.say(ADA, NEXT_STORY)).toEqual([SUGGESTION]);
    await harness.say(ADA, "SWITCH");
    // The offer's Yes, tapped after the switch, is an old button: it takes nothing.
    await harness.press(ADA, "Yes");
    const browser = new TestBrowser(harness.app);
    await browser.open(latestLink(harness));
    const proof = await browser.prove(bolaAccount);
    await harness.say(ADA, `PAIR ${proof.body.pairingCode}`);
    expect(openReport()).toMatchObject({ garden: null, activity: null });

    // Unlinked, the offer is closed too, and the garden is asked again.
    await harness.say(ADA, "CANCEL");
    expect(await harness.say(ADA, NEXT_STORY)).toEqual([OWN_GARDENS]);
    harness.close();
    harness = new Harness();
    await published();
    await harness.say(ADA, NEXT_STORY);
    const replies = await harness.say(ADA, "DISCONNECT");
    expect(replies.at(-1)).not.toContain("last time");
    await harness.press(ADA, "Yes");
    expect(openReport()).toMatchObject({ garden: null, activity: null });
  });

  it.each([
    "STOP",
    "DELETE",
  ])("forgets a report still publishing when %s is sent", async (command) => {
    harness.chain.grantRole(AIYELOJA.address, adaAccount.address, { gardener: true });
    await confirmLinkAndPublish(harness);
    const { browser, view, envelope } = await openSigningPage(harness);
    const attempt = await reserve(browser, view, envelope);
    const hash = harness.chain.submit({
      attester: adaAccount.address,
      to: envelope.call.to,
      data: envelope.call.data,
    });
    harness.clock.advance(1000);
    await harness.say(ADA, command);
    // The receipt arrives after the command, for a report begun before it.
    harness.clock.advance(1000);
    await reportOutcome(browser, view, envelope, attempt.body.attemptId, {
      kind: "broadcast",
      transactionHash: hash,
    });
    await harness.drain();
    await harness.say(ADA, "START");
    await harness.press(ADA, "I agree");
    expect((await harness.say(ADA, NEXT_STORY)).join("\n")).not.toContain("last time");
  });

  it("stops offering when asked to, after STOP, and after ninety days", async () => {
    await published();
    await harness.say(ADA, NEXT_STORY);
    expect(await harness.press(ADA, "Don't suggest this")).toEqual([
      "Okay, I won't suggest it again.",
      OWN_GARDENS,
    ]);
    await harness.say(ADA, "CANCEL");
    expect(await harness.say(ADA, NEXT_STORY)).toEqual([OWN_GARDENS]);

    // Another chat history: the offer is on, then STOP forgets what was published before it.
    harness.close();
    harness = new Harness();
    await published();
    await harness.say(ADA, "STOP");
    await harness.say(ADA, "START");
    await harness.press(ADA, "I agree");
    expect((await harness.say(ADA, NEXT_STORY)).join("\n")).not.toContain("last time");

    harness.close();
    harness = new Harness();
    await published();
    harness.clock.advance(90 * DAY + 1);
    expect((await harness.say(ADA, NEXT_STORY)).join("\n")).not.toContain("last time");
  });
});
