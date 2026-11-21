import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pendingGoal } from "../../services/reporting/dialogue-goal";
import { MODEL_INPUT_POLICY } from "../../services/reporting/model-policy";
import type { InterpretationResult } from "../../services/reporting/interpretation";
import { TestBrowser } from "./support/browser";
import { AIYELOJA, TAS } from "./support/fixtures";
import { adaAccount, latestLink, stewardAccount } from "./support/flows";
import { ADA, BOLA, Harness } from "./support/harness";

/**
 * The bounded view of a conversation a model reads, built through the real stores: what it holds,
 * what it never holds, where it begins again, and the goal that outlives an account link. A model
 * answer read for a revision that has since changed is covered with the other stale work in
 * resilience.sqlite.test.ts.
 */
let harness: Harness;

beforeEach(() => {
  harness = new Harness({ controls: { model_processing: true } });
});

afterEach(() => {
  harness.close();
});

const read = (intent: InterpretationResult["intent"] = "unclear"): InterpretationResult => ({
  intent,
  gardenKey: null,
  actionUID: null,
  facts: [],
  models: ["fixture-model"],
});

/** Says something a model reads, and returns the request that model was given. */
async function heard(person: typeof ADA, text: string) {
  harness.interpreter.responses = [read()];
  await harness.say(person, text);
  const request = harness.interpreter.requests.at(-1);
  if (!request) throw new Error("No model request was made");
  return request;
}

async function consented(person: typeof ADA, story: string): Promise<void> {
  // The story waits for consent, and is read once it is given.
  harness.interpreter.responses = [read("report_content")];
  await harness.say(person, story);
  await harness.press(person, "I agree");
}

async function link(person: typeof ADA, account = adaAccount): Promise<string[]> {
  const browser = new TestBrowser(harness.app);
  await browser.open(latestLink(harness));
  const proof = await browser.prove(account);
  return harness.say(person, `PAIR ${proof.body.pairingCode}`);
}

describe("what a model is given", () => {
  it("carries the open question and the turns before it, and nothing that identifies anyone", async () => {
    await consented(
      ADA,
      "Planted 12 baobabs. Call me on +234 800 000 0001 or ada@example.org, my wallet is " +
        `${adaAccount.address} and the photos are at https://photos.example.org/a?key=1`
    );
    const request = await heard(ADA, "which one is mine?");

    expect(request.version).toBe(1);
    expect(request.goal).toBe("report");
    expect(request.message.text).toBe("which one is mine?");
    expect(request.question).toMatchObject({
      kind: "select_garden",
      options: ["TAS", "Aiyeloja Family Garden"],
    });
    expect(request.question?.text).toContain("Which garden is this report for?");
    // The story the report opened with is its description, read back without its identifiers.
    expect(request.content.feedback).toBe(
      "Planted 12 baobabs. Call me on [phone] or [email], my wallet is [address] and the photos are at [link]"
    );
    expect(request.provenance.feedback).toEqual({ origin: "gardener", stated: true });
    expect(request.requirements.map((need) => need.kind)).toContain("garden");
    // Gardens are named by identifiers made up for the turn, not by their addresses.
    expect(request.gardens).toEqual([
      { key: "g1", label: "TAS" },
      { key: "g2", label: "Aiyeloja Family Garden" },
    ]);
    const sent = JSON.stringify(request).toLowerCase();
    // A model that answers with a garden's own key, and not the identifier it was given, names
    // nothing: the report still has no garden.
    harness.interpreter.responses = [{ ...read("report_content"), gardenKey: TAS.key }];
    expect((await harness.say(ADA, "it was at the school garden")).at(-1)).toContain(
      "Which garden is this report for?"
    );
    for (const secret of [
      "800 000 0001",
      "ada@example.org",
      adaAccount.address.toLowerCase(),
      "photos.example.org",
      ADA.subjectId,
      ADA.chatId,
      TAS.address.toLowerCase(),
      AIYELOJA.address.toLowerCase(),
    ]) {
      expect(sent).not.toContain(secret.toLowerCase());
    }
  });

  it("keeps the last few turns in order, and leaves out commands, codes and summaries", async () => {
    await consented(ADA, "Today I planted twelve baobab seedlings by the fence");
    await heard(ADA, "is the family garden one of mine?");
    await harness.say(ADA, "STATUS");
    await harness.press(ADA, "TAS");
    const request = await heard(ADA, "what counts as tree planting here?");

    const gardenQuestion = {
      role: "assistant",
      text: "Which garden is this report for?\n1. TAS\n2. Aiyeloja Family Garden",
    };
    // STATUS, its reply and the tap on TAS are not turns: the state already holds what they did.
    expect(request.turns).toEqual([
      { role: "person", text: "Today I planted twelve baobab seedlings by the fence" },
      gardenQuestion,
      { role: "person", text: "is the family garden one of mine?" },
      gardenQuestion,
    ]);
    expect(request.question?.kind).toBe("select_action");
    // However long the conversation runs, the view holds no more than its bound.
    for (let turn = 0; turn < 6; turn += 1) await heard(ADA, `question number ${turn}?`);
    const later = harness.interpreter.requests.at(-1);
    expect(later?.turns).toHaveLength(MODEL_INPUT_POLICY.maxTurns);
    expect(later?.turns.at(-1)).toEqual({ role: "person", text: "question number 4?" });
    expect(later?.message.text).toBe("question number 5?");
  });

  it("bounds a long message and a long catalogue, and keeps the report's own activity", async () => {
    const planting = harness.catalog.actions.get(TAS.key)?.[0];
    if (!planting) throw new Error("fixture activity missing");
    harness.catalog.actions.set(TAS.key, [
      ...Array.from({ length: 400 }, (_, index) => ({
        ...planting,
        definition: {
          ...planting.definition,
          actionUID: 1_000 + index,
          title: `Activity ${index} ${"with a long name ".repeat(20)}`,
        },
      })),
      planting,
    ]);
    await consented(ADA, "Today I planted twelve baobab seedlings by the fence");
    await harness.press(ADA, "TAS");
    // The last of 401 activities, chosen by its name; then a long reply to its species question.
    harness.interpreter.responses = [read()];
    await harness.say(ADA, "Tree planting");
    await harness.say(ADA, "12");
    const request = await heard(ADA, `it was mostly ${"digging and watering ".repeat(150)}`);

    expect(request.message.text).toHaveLength(MODEL_INPUT_POLICY.maxMessageChars);
    expect(request.actions.length).toBeLessThanOrEqual(MODEL_INPUT_POLICY.maxActivities);
    expect(request.actions[0]?.uid).toBe(planting.definition.actionUID);
    expect(request.actions[1]?.title.length).toBeLessThanOrEqual(MODEL_INPUT_POLICY.maxLabelChars);
    expect(JSON.stringify(request).length).toBeLessThanOrEqual(MODEL_INPUT_POLICY.maxSnapshotChars);
  });

  it("leaves out a choice whose value it would have to alter, and sends nothing past the bound", async () => {
    const planting = harness.catalog.actions.get(AIYELOJA.key)?.[0];
    if (!planting) throw new Error("fixture activity missing");
    const species = (options: string[]) => [
      {
        ...planting,
        definition: {
          ...planting.definition,
          inputs: [
            {
              key: "species",
              title: "Species",
              placeholder: "",
              type: "select" as const,
              required: true,
              options,
            },
          ],
        },
      },
    ];
    const wallet = adaAccount.address;
    const [named] = species(["baobab", wallet, "neem"]);
    if (!named) throw new Error("fixture activity missing");
    // A second field whose own key is shaped like an address.
    const keyed = { ...named.definition.inputs[0], key: wallet, title: "Steward", required: false };
    harness.catalog.actions.set(TAS.key, [
      {
        ...named,
        definition: { ...named.definition, inputs: [...named.definition.inputs, keyed] },
      },
    ]);
    await consented(ADA, "Today I planted twelve baobab seedlings by the fence");
    await harness.press(ADA, "TAS");
    const request = await heard(ADA, "which species do you mean?");
    expect(request.actions[0]?.inputs.map((input) => input.key)).toEqual(["species"]);
    expect(request.actions[0]?.inputs[0]?.options).toEqual(["baobab", "neem"]);
    expect(JSON.stringify(request).toLowerCase()).not.toContain(wallet.toLowerCase());

    // One activity too large for the bound: the question is still answered, with no model.
    harness.catalog.actions.set(
      TAS.key,
      species(Array.from({ length: 600 }, (_, index) => `species ${index} ${"x".repeat(100)}`))
    );
    const asked = harness.interpreter.requests.length;
    expect((await harness.say(ADA, "and now?")).length).toBeGreaterThan(0);
    expect(harness.interpreter.requests).toHaveLength(asked);
  });

  it("names a disputed garden by its identifier, never by its address", async () => {
    await consented(ADA, "Today I planted twelve baobab seedlings by the fence");
    await harness.press(ADA, "TAS");
    // The gardener chose TAS; a model then reads the family garden in a later message.
    harness.interpreter.responses = [{ ...read("report_content"), gardenKey: "g2" }];
    await harness.say(ADA, "we worked beside the family garden");
    const request = await heard(ADA, "what are you asking me?");

    expect(request.conflicts).toEqual([{ field: "garden", proposed: "g2" }]);
    expect(JSON.stringify(request).toLowerCase()).not.toContain(AIYELOJA.address.toLowerCase());
  });

  it("answers without the model when an earlier message can no longer be read", async () => {
    await consented(ADA, "Today I planted twelve baobab seedlings by the fence");
    const asked = harness.interpreter.requests.length;
    harness.core.db
      .query("UPDATE inbox_events SET payload_ciphertext = 'unreadable' WHERE state = 'consumed'")
      .run();

    const replies = await harness.say(ADA, "which one is mine?");
    expect(replies.at(-1)).toContain("Which garden is this report for?");
    expect(harness.interpreter.requests).toHaveLength(asked);
  });

  it("gives one chat nothing another chat said", async () => {
    await consented(ADA, "Ada planted twelve baobab seedlings by the fence");
    await heard(ADA, "does the fence side count?");
    await consented(BOLA, "Bola weeded the north beds");
    const request = await heard(BOLA, "which one is mine?");

    expect(request.content.feedback).toBe("Bola weeded the north beds");
    // Bola's own story is the one earlier turn; the garden question is the open question.
    expect(request.turns).toEqual([{ role: "person", text: "Bola weeded the north beds" }]);
    expect(JSON.stringify(request)).not.toMatch(/Ada|fence|baobab/);
  });

  it("starts again after consent is withdrawn, and after the account changes", async () => {
    await consented(ADA, "Today I planted twelve baobab seedlings by the fence");
    await heard(ADA, "is the fence side part of TAS?");
    await harness.say(ADA, "STOP");
    harness.clock.advance(60_000);
    await harness.say(ADA, "START");
    await harness.press(ADA, "I agree");
    const afterConsent = await heard(ADA, "I weeded the north beds");
    expect(afterConsent.turns).toEqual([]);
    expect(JSON.stringify(afterConsent)).not.toContain("fence");

    await heard(ADA, "do the north beds count?");
    harness.clock.advance(60_000);
    await harness.say(ADA, "CONNECT");
    await link(ADA);
    const afterLink = await heard(ADA, "and the south beds?");
    expect(afterLink.turns.filter((turn) => turn.role === "person")).toEqual([]);
  });
});

describe("the goal a chat was asked for", () => {
  it("shows a steward the work to review once linked, after a restart, without asking again", async () => {
    harness.chain.grantRole(TAS.address, stewardAccount.address, { operator: true });
    await harness.say(BOLA, "REVIEW");
    await harness.press(BOLA, "I agree");
    harness.restart();

    const replies = await link(BOLA, stewardAccount);
    expect(replies).toEqual([
      `Your account ${stewardAccount.address.toLowerCase()} is now linked.\nYour gardens: TAS.`,
      "There's no work waiting for your review.",
    ]);
    // The goal is met: linking again later does not list the work a second time.
    expect(harness.core.db.query("SELECT count(*) AS n FROM dialogue_goals").get()).toEqual({
      n: 0,
    });
  });

  it("forgets the goal when consent is withdrawn before the account is linked", async () => {
    harness.chain.grantRole(TAS.address, stewardAccount.address, { operator: true });
    await harness.say(BOLA, "REVIEW");
    await harness.press(BOLA, "I agree");
    await harness.say(BOLA, "STOP");
    await harness.say(BOLA, "START");
    await harness.press(BOLA, "I agree");
    await harness.say(BOLA, "CONNECT");

    expect(await link(BOLA, stewardAccount)).toEqual([
      `Your account ${stewardAccount.address.toLowerCase()} is now linked.\nYour gardens: TAS.`,
    ]);
  });

  it("is read only by the identity that set it", async () => {
    harness.chain.grantRole(TAS.address, stewardAccount.address, { operator: true });
    await harness.say(BOLA, "REVIEW");
    await harness.press(BOLA, "I agree");
    const { conversation_id: conversationId, participant_id: participantId } = harness.core.db
      .query("SELECT conversation_id, participant_id FROM dialogue_goals")
      .get() as { conversation_id: string; participant_id: string };

    expect(pendingGoal(harness.core, { conversationId, participantId, identityEpoch: 1 })).toBe(
      "review"
    );
    // The same person after recovering the account elsewhere, and anyone else in the chat.
    expect(pendingGoal(harness.core, { conversationId, participantId, identityEpoch: 2 })).toBe(
      null
    );
    expect(
      pendingGoal(harness.core, { conversationId, participantId: "someone-else", identityEpoch: 1 })
    ).toBe(null);
  });

  it("leaves a goal a day old alone", async () => {
    harness.chain.grantRole(TAS.address, stewardAccount.address, { operator: true });
    await harness.say(BOLA, "REVIEW");
    await harness.press(BOLA, "I agree");
    harness.clock.advance(24 * 60 * 60 * 1000 + 1);
    await harness.say(BOLA, "CONNECT");

    expect(await link(BOLA, stewardAccount)).toHaveLength(1);
  });
});
