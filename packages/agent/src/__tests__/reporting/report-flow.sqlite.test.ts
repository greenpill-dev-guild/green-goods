import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TestBrowser } from "./support/browser";
import { AIYELOJA, planting, snapshot, TAS } from "./support/fixtures";
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
    // The story gave the description, so three questions are left, and each is numbered against them.
    expect(adopted).toEqual([
      "Got it: Tree planting at TAS. 3 quick questions, then a summary to check.",
      "1 of 3 · Seedlings planted? Send just the number (seedlings).",
    ]);
    expect(await harness.say(ADA, "twelve")).toEqual([
      "Seedlings planted is a number (seedlings). For example, 12.",
    ]);
    expect(await harness.say(ADA, "10 bags")).toEqual([
      "This is counted in seedlings, but you wrote bags. Could you give it in seedlings?",
    ]);
    expect((await harness.say(ADA, "12 seedlings"))[0]).toContain("2 of 3 · Main species?");
    expect(await harness.say(ADA, "2")).toEqual([
      "3 of 3 · How much time did you spend on this work? For example: 2 hours or 45 minutes.",
    ]);
    expect(await harness.say(ADA, "3")).toEqual([
      "3 of 3 · Was that 3 hours or 3 minutes?\n1. Hours\n2. Minutes",
    ]);
    const summary = await harness.press(ADA, "Hours");
    expect(summary[0]).toContain("• Activity: Tree planting");
    expect(summary[0]).toContain("• Time spent: 3 h");
    expect(summary[0]).toContain("• Seedlings planted: 12 seedlings");
    expect(summary[0]).toContain("• Main species: Baobab");
    expect(summary[0]).toContain("cannot be deleted");

    expect(await harness.say(ADA, "CONFIRM 9999")).toEqual([
      `To publish, reply CONFIRM ${summaryToken(summary)}.`,
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

describe("an amount that needs a choice to mean anything", () => {
  it("asks what is being measured before a number with no unit, and explains the number", async () => {
    const milestone = planting({
      title: "Infrastructure Milestone",
      inputs: [
        {
          key: "milestoneValue",
          title: "Milestone Value",
          placeholder: "Enter the numeric value for this milestone",
          type: "number",
          required: true,
          options: [],
        },
        {
          key: "milestoneType",
          title: "Milestone Type",
          placeholder: "Select the type of milestone",
          type: "select",
          required: true,
          options: ["Solar kW installed", "Battery kWh added"],
        },
      ],
    });
    harness.catalog.actions.set(TAS.key, [snapshot(milestone)]);
    await consented();
    await harness.say(ADA, "1");
    // The activity's choice comes before its unit-less amount, and both are numbered as asked.
    expect(await harness.press(ADA, "Infrastructure Milestone")).toEqual([
      "Got it: Infrastructure Milestone at TAS. 3 quick questions, then a summary to check.",
      "1 of 3 · Milestone Type: Select the type of milestone.\n1. Solar kW installed\n2. Battery kWh added",
    ]);
    expect(await harness.say(ADA, "1")).toEqual([
      "2 of 3 · Milestone Value: Enter the numeric value for this milestone. Send just the number.",
    ]);
    expect(await harness.say(ADA, "what is a milestone value?")).toEqual([
      "Milestone Value is a number: Enter the numeric value for this milestone. For example, 12.",
    ]);
    expect((await harness.say(ADA, "5"))[0]).toContain("3 of 3 · How much time");
  });
});

const GARDEN_QUESTION = "Which garden is this report for?\n1. TAS\n2. Aiyeloja Family Garden";
const GARDEN_HELP =
  "A garden is the community or place your work belongs to. Pick the one where you did this work, or send CONNECT to link your account and choose from your own gardens.";
const ACTIVITY_HELP =
  "These are the kinds of work TAS is tracking right now. Pick the closest match to what you did; the details come next.";

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

  it("puts the activity question again when a button of an earlier question is tapped", async () => {
    harness.catalog.actions.set(AIYELOJA.key, harness.catalog.actions.get(TAS.key) ?? []);
    await consented();
    const activitiesIn = (garden: string) =>
      `Which activity in ${garden} best matches your work?\n1. Tree planting\n2. Weeding`;
    expect(await harness.say(ADA, "1")).toEqual([activitiesIn("TAS")]);
    // The garden question's button answers nothing now. Its tap must not read as a failed load.
    expect(await harness.press(ADA, "TAS")).toEqual([activitiesIn("TAS")]);

    // The same once the garden is changed, when the report has to choose its activity again.
    await harness.press(ADA, "Tree planting");
    await harness.say(ADA, "EDIT");
    await harness.say(ADA, "1");
    expect(await harness.say(ADA, "2")).toEqual([activitiesIn("Aiyeloja Family Garden")]);
    expect(await harness.press(ADA, "TAS")).toEqual([activitiesIn("Aiyeloja Family Garden")]);
  });

  it("says how to answer and shows the choices again when no model can read the words", async () => {
    await consented();
    expect(await harness.say(ADA, "Which one is mine?")).toEqual([GARDEN_HELP, GARDEN_QUESTION]);
    // The question is still open: its number answers it.
    expect((await harness.say(ADA, "1"))[0]).toContain("Which activity in TAS");
    expect(await harness.say(ADA, "the planting one")).toEqual([
      ACTIVITY_HELP,
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
    expect(await harness.say(ADA, "What does that mean?")).toEqual([GARDEN_HELP, GARDEN_QUESTION]);
    harness.interpreter.responses = [read("status")];
    expect(await harness.say(ADA, "where are we with this?")).toEqual([
      "Your report for your garden is still being filled in.",
    ]);
    // The garden's one activity is read in the same turn, so the reply moves on to its first field.
    harness.interpreter.responses = [read("report_content", AIYELOJA.key)];
    expect(await harness.say(ADA, "the family garden")).toEqual([
      "Got it: Tree planting at Aiyeloja Family Garden. 3 quick questions, then a summary to check.",
      "1 of 3 · Seedlings planted? Send just the number (seedlings).",
    ]);
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
const OTHER_ACCOUNT_HINT =
  "The page opens with the account your browser last used. To link another, tap “Use a different account” there.";
const STORY = "Today I planted twelve baobab seedlings by the fence";
const ONLY_GARDEN =
  "is your only garden, so I'll use it for this report. Send GARDEN to change it, or JOIN to join another garden.";
const OWN_GARDEN_QUESTION =
  "Which of your gardens is this report for?\n1. TAS\n2. Aiyeloja Family Garden\n3. Join another garden";
const OFFER =
  "Hi! I help you report garden work on Green Goods. Want to connect your account first, so I can show your gardens? You can also just tell me what you did, and I'll ask you to connect when you publish.\n1. Connect account";
const disconnected = (account: string) =>
  `Done. This chat is no longer connected to ${account}, and any chat reporting permission you approved for it is paused. Send CONNECT to link an account.`;

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
  it("offers linking on START, then reports within the account's own gardens", async () => {
    harness.chain.grantRole(AIYELOJA.address, adaAccount.address, { gardener: true });
    const welcome = await started();
    expect(welcome[1]).toBe(OFFER);
    expect(await harness.press(ADA, "Connect account")).toEqual([CONNECT_LINK, PAIR_HINT]);
    expect(await pairAda()).toEqual([
      `Your account ${ada} is now linked.\nYour gardens: Aiyeloja Family Garden.`,
    ]);

    // The account's only garden is taken without a question, and so is that garden's one activity.
    expect(await harness.say(ADA, STORY)).toEqual([
      `Aiyeloja Family Garden ${ONLY_GARDEN}`,
      "Got it: Tree planting at Aiyeloja Family Garden. 3 quick questions, then a summary to check.",
      "1 of 3 · Seedlings planted? Send just the number (seedlings).",
    ]);
    // START no longer offers linking, and must not replace the report's open question.
    expect((await harness.say(ADA, "START"))[0]).toContain("Green Goods reporting:");
    expect((await harness.say(ADA, "12"))[0]).toContain("2 of 3 · Main species?");
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
    // Linked mid-report, the report takes the account's only garden and moves on to its activities.
    expect(await harness.say(ADA, `PAIR ${proof.body.pairingCode}`)).toEqual([
      `Your account ${ada} is now linked.`,
      `TAS ${ONLY_GARDEN}`,
      "Which activity in TAS best matches your work?\n1. Tree planting\n2. Weeding",
    ]);

    expect(await harness.say(ADA, bolaAccount.address)).toEqual([
      `This chat is linked to a different account. Verify with ${ada} or contact ${harness.core.settings.supportContact}.`,
    ]);
    expect(await harness.say(ADA, "CONNECT")).toEqual([
      `This chat is connected to ${ada}.\nYour gardens: TAS.\nTo use a different account, send SWITCH.`,
    ]);
  });

  it("welcomes a hello instead of starting a report, and reads a request to log in at any point", async () => {
    harness.chain.grantRole(TAS.address, adaAccount.address, { gardener: true });
    harness.chain.grantRole(AIYELOJA.address, adaAccount.address, { gardener: true });
    expect((await harness.say(ADA, "hello"))[0]).toContain("Do you agree?");
    // The held hello gets the welcome and the offer to link; it is not taken for a report.
    expect((await harness.press(ADA, "I agree")).at(-1)).toBe(OFFER);
    expect(harness.core.db.query("SELECT count(*) AS n FROM work_drafts").get()).toEqual({ n: 0 });

    expect((await harness.say(ADA, STORY))[0]).toBe(GARDEN_QUESTION);
    // With the garden question open, a request to log in is never read as a garden.
    expect(await harness.say(ADA, "I would like to log in")).toEqual([CONNECT_LINK, PAIR_HINT]);
    // Linked, the open garden question is asked again within the account's own gardens.
    expect(await pairAda()).toEqual([`Your account ${ada} is now linked.`, OWN_GARDEN_QUESTION]);
    // A hello in the middle of a report says so and asks the open question again.
    expect(await harness.say(ADA, "hi")).toEqual([
      "Hi! Your report is still open, so here's where we were.",
      OWN_GARDEN_QUESTION,
    ]);
  });

  it("puts an open summary again when the account changes, so the old one cannot be confirmed", async () => {
    harness.chain.grantRole(TAS.address, adaAccount.address, { gardener: true });
    await started();
    await harness.say(ADA, "CONNECT");
    await pairAda();
    // TAS is the account's only garden, so the report starts at its activities.
    await harness.say(ADA, STORY);
    await harness.press(ADA, "Tree planting");
    await harness.say(ADA, "12");
    await harness.say(ADA, "2");
    const summary = await harness.say(ADA, "3 hours");
    expect(summary.at(-1)).toContain(`It will be published by your account ${ada}.`);

    // Unlinking shows the summary again without the account, and retires the one that named it.
    const unlinked = await harness.say(ADA, "DISCONNECT");
    expect(unlinked[0]).toBe(disconnected(ada));
    expect(unlinked[1]).toContain("Please check your report for TAS");
    expect(unlinked[1]).not.toContain("published by your account");
    const prompts = () =>
      harness.core.db
        .query(
          "SELECT state FROM conversation_prompts WHERE kind = 'confirm_report' ORDER BY rowid"
        )
        .all() as Array<{ state: string }>;
    expect(prompts().map((prompt) => prompt.state === "open")).toEqual([false, true]);

    // Linking again shows it once more, naming the account that will publish.
    await harness.say(ADA, "CONNECT");
    const relinked = await pairAda();
    expect(relinked.at(-1)).toContain(`It will be published by your account ${ada}.`);
    expect(prompts().map((prompt) => prompt.state === "open")).toEqual([false, false, true]);
  });

  it("disconnects the account on request, so another can be linked", async () => {
    const bola = bolaAccount.address.toLowerCase();
    await started();
    await harness.say(ADA, "CONNECT");
    await pairAda();
    // START from a linked, idle chat says which account it reports as.
    expect((await harness.say(ADA, "START"))[0]).toContain(`This chat is connected to ${ada}.`);

    expect(await harness.say(ADA, "log out")).toEqual([disconnected(ada)]);
    expect(harness.core.db.query("SELECT status FROM account_bindings").all()).toEqual([
      { status: "revoked" },
    ]);
    expect(await harness.say(ADA, "DISCONNECT")).toEqual([
      "This chat isn't connected to an account. Send CONNECT to link one.",
    ]);

    // The chat is free to link a different account, and the old one is free for another chat.
    // A chat that had an account is told the page will open on it, and how to use another.
    expect(await harness.say(ADA, "SWITCH")).toEqual([CONNECT_LINK, PAIR_HINT, OTHER_ACCOUNT_HINT]);
    const browser = new TestBrowser(harness.app);
    await browser.open(latestLink(harness));
    const proof = await browser.prove(bolaAccount);
    expect((await harness.say(ADA, `PAIR ${proof.body.pairingCode}`))[0]).toContain(
      `Your account ${bola} is now linked.`
    );
    // From a linked chat, SWITCH unlinks and sends the next link in one reply.
    expect(await harness.say(ADA, "connect another account")).toEqual([
      disconnected(bola),
      CONNECT_LINK,
      PAIR_HINT,
      OTHER_ACCOUNT_HINT,
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
