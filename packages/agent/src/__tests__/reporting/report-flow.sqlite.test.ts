import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TestBrowser } from "./support/browser";
import { AIYELOJA, TAS } from "./support/fixtures";
import { adaAccount, bolaAccount, latestLink } from "./support/flows";
import { ADA, Harness, summaryToken } from "./support/harness";

/**
 * Story-first reporting through the real coordinator, Shared rules and a temporary SQLite file,
 * driven over Hono. Fixture catalog and transport prove orchestration, not provider behavior.
 */
let harness: Harness;

beforeEach(() => {
  harness = new Harness();
});

afterEach(() => {
  harness.close();
});

async function consented(): Promise<string[]> {
  const notice = await harness.say(ADA, "Today I planted twelve baobab seedlings by the fence");
  expect(notice).toHaveLength(1);
  expect(notice[0]).toContain("Do you agree?");
  return harness.press(ADA, "I agree");
}

describe("story-first reporting", () => {
  it("quarantines a first message until consent, then resumes it as the story", async () => {
    const notice = await harness.say(ADA, "Today I planted twelve baobab seedlings by the fence");
    expect(notice[0]).toContain("Do you agree?");
    const db = harness.core.db;
    expect(db.query("SELECT state FROM inbox_events WHERE kind = 'message'").all()).toEqual([
      { state: "quarantined" },
    ]);
    expect(db.query("SELECT count(*) AS n FROM source_entries").get()).toEqual({ n: 0 });
    expect(db.query("SELECT count(*) AS n FROM participants").get()).toEqual({ n: 0 });

    const afterConsent = await harness.press(ADA, "I agree");
    expect(afterConsent[0]).toContain("Thank you!");
    expect(afterConsent[1]).toBe(
      "Which garden is this report for?\n1. TAS\n2. Aiyeloja Family Garden"
    );
    expect(db.query("SELECT revision, lifecycle FROM work_drafts").get()).toEqual({
      revision: 1,
      lifecycle: "open",
    });
  });

  it("pages the garden question when more gardens accept reports than fit in one message", async () => {
    harness.close();
    const others = Array.from({ length: 10 }, (_, index) => ({
      key: `garden-${index + 1}`,
      chainId: 42161,
      address: `0x${(index + 16).toString(16).padStart(40, "0")}` as const,
      label: `Garden ${index + 1}`,
    }));
    harness = new Harness({ gardens: [...others, TAS, AIYELOJA] });
    const first = (await consented())[1];
    expect(first).toContain("10. Garden 10");
    expect(first).not.toContain("TAS");
    const next = await harness.press(ADA, "More options");
    expect(next[0]).toBe("Which garden is this report for?\n1. TAS\n2. Aiyeloja Family Garden");
    expect((await harness.press(ADA, "TAS"))[0]).toContain("Which activity in TAS");
  });

  it("collects every required field, validates answers against the Action and confirms a bound revision", async () => {
    await consented();
    expect(await harness.say(ADA, "1")).toEqual([
      "Which activity in TAS best matches your work?\n1. Tree planting\n2. Weeding",
    ]);
    const adopted = await harness.press(ADA, "Tree planting");
    expect(adopted[0]).toMatch(
      /^Got it: Tree planting at TAS\. [0-9]+ quick questions?, then a summary to check\.$/
    );
    expect(adopted[1]).toMatch(
      /^[0-9]+ of [0-9]+ · Seedlings planted\? Please reply with a number \(seedlings\)\.$/
    );
    expect(await harness.say(ADA, "twelve")).toEqual([
      "Please reply with a number, for example 12.",
    ]);
    expect(await harness.say(ADA, "10 bags")).toEqual([
      "This is counted in seedlings, but you wrote bags. Could you give it in seedlings?",
    ]);
    expect((await harness.say(ADA, "12 seedlings"))[0]).toContain("Main species?");
    expect((await harness.say(ADA, "2"))[0]).toMatch(
      /^[0-9]+ of [0-9]+ · How much time did you spend on this work\? For example: 2 hours or 45 minutes\.$/
    );
    expect((await harness.say(ADA, "3"))[0]).toMatch(
      /^[0-9]+ of [0-9]+ · Was that 3 hours or 3 minutes\?\n1\. Hours\n2\. Minutes$/
    );
    const summary = await harness.press(ADA, "Hours");
    expect(summary[0]).toContain("• Activity: Tree planting");
    expect(summary[0]).toContain("• Time spent: 3 h");
    expect(summary[0]).toContain("• Seedlings planted: 12 seedlings");
    expect(summary[0]).toContain("• Main species: Baobab");
    expect(summary[0]).toContain("cannot be deleted");

    expect(await harness.say(ADA, "CONFIRM 9999")).toEqual([
      `To publish, reply CONFIRM ${summaryToken(summary)} exactly as shown in the summary.`,
    ]);
    const linking = await harness.say(ADA, `CONFIRM ${summaryToken(summary)}`);
    expect(linking).toEqual([
      "To publish, verify your existing Green Goods account (wallet or passkey) here. The link expires in 10 minutes and never moves funds.\n\nOpen it in Safari or Chrome. If it opens inside the chat app, use that page's menu to open it in your browser, or copy the link.",
      "When the page shows a code, send the six digits alone here.",
    ]);

    const draft = harness.core.db
      .query("SELECT id, revision, machine_snapshot FROM work_drafts")
      .get() as { id: string; revision: number; machine_snapshot: string };
    expect(JSON.parse(draft.machine_snapshot).value).toBe("authority");
    const confirmation = harness.core.db
      .query(
        "SELECT revision, account_binding_id, publication_consent_id, invalidated_at FROM confirmations"
      )
      .get();
    // Unlinked gardeners confirm content first; publication consent waits for account pairing.
    expect(confirmation).toEqual({
      revision: draft.revision,
      account_binding_id: null,
      publication_consent_id: null,
      invalidated_at: null,
    });
    expect(harness.core.db.query("SELECT kind, state FROM processing_jobs").all()).toEqual([
      { kind: "resolve_authority", state: "succeeded" },
    ]);
  });

  it("keeps each answer's provenance tied to the exact source message", async () => {
    await consented();
    await harness.say(ADA, "1");
    await harness.press(ADA, "Tree planting");
    await harness.say(ADA, "12");
    const revision = harness.core.db
      .query(
        "SELECT r.content_ciphertext, r.draft_id, r.revision FROM draft_revisions r ORDER BY revision DESC LIMIT 1"
      )
      .get() as { content_ciphertext: string; draft_id: string; revision: number };
    const content = JSON.parse(
      harness.core.keyring.open(
        revision.content_ciphertext,
        `draft_revisions.content:${revision.draft_id}:${revision.revision}`
      )
    );
    const source = harness.core.db
      .query(
        "SELECT s.id FROM source_entries s JOIN inbox_events e ON e.id = s.inbox_event_id WHERE e.event_id = 'evt-5'"
      )
      .get() as { id: string };
    expect(content.provenance["details.seedlings"]).toEqual({
      kind: "reported",
      origin: "gardener",
      sources: [{ sourceEntryId: source.id }],
      original: "12",
      originalUnit: "seedlings",
      gardenerStated: true,
    });
    expect(content.feedback).toBe("Today I planted twelve baobab seedlings by the fence");
  });

  it("delivers a repeated provider event once and never duplicates its source entry", async () => {
    await consented();
    const event = harness.message(ADA, { text: "1" });
    expect((await harness.post(event)).status).toBe(202);
    const duplicate = await harness.post(event);
    expect(duplicate.status).toBe(200);
    expect(await duplicate.json()).toMatchObject({ status: "duplicate" });
    await harness.drain();
    const count = harness.core.db
      .query(
        "SELECT count(*) AS n FROM source_entries s JOIN inbox_events e ON e.id = s.inbox_event_id WHERE e.event_id = $id"
      )
      .get({ id: event.eventId }) as { n: number };
    expect(count.n).toBe(1);
  });
});

const GARDEN_QUESTION = "Which garden is this report for?\n1. TAS\n2. Aiyeloja Family Garden";
const CHOICE_HELP =
  "I didn't catch which one you mean. Tap a choice below or reply with its number. Send HELP to see everything I can do, or CANCEL to stop this report.";

describe("a reply that is not one of the choices", () => {
  it("offers Try again when a garden's activities can't be read, and reads them again on any reply", async () => {
    await consented();
    harness.catalog.unavailable = true;
    const stuck =
      "I couldn't load TAS's activities just now. That's a problem on my side, and your draft is saved. Tap Try again or send any message.\n1. Try again";
    expect(await harness.say(ADA, "1")).toEqual([stuck]);
    // The garden is chosen, so a question is never taken for another garden.
    expect(await harness.say(ADA, "What does that mean? Can I report activities?")).toEqual([
      stuck,
    ]);
    harness.catalog.unavailable = false;
    expect(await harness.press(ADA, "Try again")).toEqual([
      "Which activity in TAS best matches your work?\n1. Tree planting\n2. Weeding",
    ]);
  });

  it("says how to answer and shows the choices again when no model can read the words", async () => {
    await consented();
    expect(await harness.say(ADA, "Which one is mine?")).toEqual([CHOICE_HELP, GARDEN_QUESTION]);
    // The question is still open: its number answers it.
    expect((await harness.say(ADA, "1"))[0]).toContain("Which activity in TAS");
    expect(await harness.say(ADA, "the planting one")).toEqual([
      CHOICE_HELP,
      "Which activity in TAS best matches your work?\n1. Tree planting\n2. Weeding",
    ]);
  });

  it("lets the model read a garden named in other words, a question and a status request", async () => {
    harness.close();
    harness = new Harness({ controls: { model_processing: true } });
    const read = (
      intent: "report_content" | "help" | "status",
      gardenKey: string | null = null
    ) => ({ intent, gardenKey, actionUID: null, facts: [], models: ["fixture-model"] });
    // The notice says a model may read the messages, names no provider and sends help to the site.
    const notice = (await harness.say(ADA, STORY))[0];
    expect(notice).toContain(
      "the messages and files you send here and may use AI to understand them."
    );
    expect(notice).toContain("HELP for support (greengoods.app)");
    expect(notice).not.toMatch(/OpenAI|TypeSafe|operated by|@/);
    await harness.press(ADA, "I agree");

    harness.interpreter.responses = [read("help")];
    expect(await harness.say(ADA, "What does that mean?")).toEqual([CHOICE_HELP, GARDEN_QUESTION]);
    harness.interpreter.responses = [read("status")];
    expect(await harness.say(ADA, "where are we with this?")).toEqual([
      "Your report for your garden is still being filled in.",
    ]);
    // The garden's one activity is read in the same turn, so the reply moves on to its first field.
    harness.interpreter.responses = [read("report_content", AIYELOJA.key)];
    const adoptedFromModel = await harness.say(ADA, "the family garden");
    expect(adoptedFromModel[0]).toMatch(/^Got it: Tree planting at Aiyeloja Family Garden\./);
    expect(adoptedFromModel[1]).toMatch(/^[0-9]+ of [0-9]+ · Seedlings planted\?/);
    expect(harness.interpreter.requests.at(-1)?.message.text).toBe("the family garden");
    // Numbers and a choice's own label never go to the model.
    const asked = harness.interpreter.requests.length;
    await harness.say(ADA, "12");
    await harness.say(ADA, "Baobab");
    expect(harness.interpreter.requests).toHaveLength(asked);
  });
});

const ada = adaAccount.address.toLowerCase();
const VERIFY = "The link expires in 10 minutes and never moves funds.";
const BROWSER_HINT =
  "Open it in Safari or Chrome. If it opens inside the chat app, use that page's menu to open it in your browser, or copy the link.";
const CONNECT_LINK = `To connect your Green Goods account (wallet or passkey), verify it here. ${VERIFY}\n\n${BROWSER_HINT}`;
const PAIR_HINT = "When the page shows a code, send the six digits alone here.";
const STORY = "Today I planted twelve baobab seedlings by the fence";

/** Opens the chat with START, as Telegram does, and agrees to processing. */
async function started(): Promise<string[]> {
  await harness.say(ADA, "START");
  return harness.press(ADA, "I agree");
}

/** Proves Ada's account on the latest link and sends its code from the chat. */
async function pairAda(): Promise<string[]> {
  const browser = new TestBrowser(harness.app);
  await browser.open(latestLink(harness));
  const proof = await browser.prove(adaAccount);
  return harness.say(ADA, `PAIR ${proof.body.pairingCode}`);
}

describe("linking an account before reporting", () => {
  it("offers linking on START, then asks about the account's own gardens first", async () => {
    harness.chain.grantRole(AIYELOJA.address, adaAccount.address, { gardener: true });
    const welcome = await started();
    expect(welcome[1]).toBe(
      "Before your first report, connect your Green Goods account so I can show your gardens. Or skip this and tell me about the work you did; I'll ask you to connect when you publish.\n1. Connect account"
    );
    expect(await harness.press(ADA, "Connect account")).toEqual([CONNECT_LINK, PAIR_HINT]);
    expect(await pairAda()).toEqual([
      `Your account ${ada} is now linked.\nYour gardens: Aiyeloja Family Garden.`,
    ]);

    expect(await harness.say(ADA, STORY)).toEqual([
      "Which of your gardens is this report for?\n1. Aiyeloja Family Garden\n2. Other gardens",
    ]);
    // The list only orders the choice: a garden the indexer does not show the account in stays open,
    // and "Other gardens" answers to its number like the gardens above it.
    expect(await harness.say(ADA, "2")).toEqual(["Which garden is this report for?\n1. TAS"]);
    expect((await harness.press(ADA, "TAS"))[0]).toContain("Which activity in TAS");
    // START no longer offers linking, and must not replace the report's open question.
    expect((await harness.say(ADA, "START"))[0]).toContain("Green Goods reporting:");
    expect((await harness.say(ADA, "1"))[0]).toMatch(/^Got it: Tree planting at TAS\./);
  });

  it("takes a typed address as a request to link that account, and trusts nothing until it is proven", async () => {
    harness.chain.grantRole(TAS.address, adaAccount.address, { gardener: true });
    await started();
    // The address arrives as wallets show it, in mixed case.
    expect(await harness.say(ADA, adaAccount.address)).toEqual([
      `${ada} is in: TAS.\nTo connect it to this chat, verify it here with that account. ${VERIFY}\n\n${BROWSER_HINT}`,
      PAIR_HINT,
    ]);
    expect(harness.core.db.query("SELECT count(*) AS n FROM account_bindings").get()).toEqual({
      n: 0,
    });
    expect((await harness.say(ADA, STORY))[0]).toBe(
      "Which garden is this report for?\n1. TAS\n2. Aiyeloja Family Garden"
    );

    const browser = new TestBrowser(harness.app);
    await browser.open(latestLink(harness));
    expect((await browser.prove(bolaAccount)).status).toBe(403);
    const proof = await browser.prove(adaAccount);
    expect(proof.status).toBe(200);
    // Linked mid-report, the reply leaves the report's own question standing.
    expect(await harness.say(ADA, `PAIR ${proof.body.pairingCode}`)).toEqual([
      `Your account ${ada} is now linked.`,
    ]);

    expect(await harness.say(ADA, bolaAccount.address)).toEqual([
      `This chat is linked to a different account. Verify with ${ada} or contact ${harness.core.settings.supportContact}.`,
    ]);
    expect(await harness.say(ADA, "CONNECT")).toEqual([
      `This chat is linked to ${ada}.\nYour gardens: TAS.`,
    ]);
  });

  it.each([
    ["yes", CONNECT_LINK],
    ["1", CONNECT_LINK],
    [
      "no",
      "No problem. Tell me about the work you did; you can send text and photos. Send CONNECT whenever you want to link your account.",
    ],
    [STORY, "Which garden is this report for?\n1. TAS\n2. Aiyeloja Family Garden"],
  ])("reads %s as an answer to the offer only when it is one", async (reply, first) => {
    await started();
    expect((await harness.say(ADA, reply))[0]).toBe(first);
  });

  it("says so when the indexer shows a linked account in no garden", async () => {
    await started();
    const unknown = `0x${"c".repeat(40)}`;
    expect((await harness.say(ADA, `CONNECT ${unknown}`))[0]).toBe(
      `I don't see ${unknown} in a garden yet.\nTo connect it to this chat, verify it here with that account. ${VERIFY}\n\n${BROWSER_HINT}`
    );
    // A plain CONNECT replaces the link that was limited to the named account.
    await harness.say(ADA, "CONNECT");
    expect(await pairAda()).toEqual([
      `Your account ${ada} is now linked.\nI don't see it in a garden yet. A garden you just joined can take a few minutes to show here.`,
    ]);
  });
});
