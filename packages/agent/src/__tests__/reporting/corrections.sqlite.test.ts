import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { lifecycleState } from "../../services/reporting/coordinator/draft-commit";
import { setControl } from "../../services/reporting/controls";
import { loadDraft } from "../../services/reporting/drafts";
import { openPrompt } from "../../services/reporting/prompts";
import { confirmLinkAndPublish, openSigningPage, reserve } from "./support/flows";
import { ADA, Harness } from "./support/harness";

/**
 * Corrections to a report that has shown its summary: every field the correction touches changes
 * together, the summary that was showing confirms nothing afterwards, and a report already on its
 * way to the chain is left exactly as it was confirmed.
 */
let harness: Harness;

beforeEach(() => {
  harness = new Harness();
});

afterEach(() => {
  harness.close();
});

function report() {
  const row = harness.core.db.query("SELECT id FROM work_drafts").get() as { id: string };
  const draft = loadDraft(harness.core, row.id);
  if (!draft) throw new Error("No report was started");
  const prompt = openPrompt(harness.core, draft.conversationId);
  return {
    id: draft.id,
    details: draft.content.details,
    minutes: draft.content.timeSpentMinutes,
    description: draft.content.feedback,
    conflicts: draft.content.conflicts.map((conflict) => conflict.field),
    stated: draft.content.provenance["details.seedlings"]?.gardenerStated ?? null,
    revision: draft.revision,
    state: lifecycleState(draft),
    question: prompt?.kind ?? null,
    token: prompt?.token ?? null,
  };
}

const liveConfirmations = () =>
  (
    harness.core.db
      .query("SELECT count(*) AS n FROM confirmations WHERE invalidated_at IS NULL")
      .get() as { n: number }
  ).n;

const STORY = "At TAS today I planted 12 baobab seedlings by the fence. It took 3 hours.";

/** The story, consent, TAS and Tree planting: everything is read from the story, so the summary shows. */
async function summarized(story = STORY): Promise<void> {
  await harness.say(ADA, story);
  await harness.press(ADA, "I agree");
  await harness.press(ADA, "TAS");
  await harness.press(ADA, "Tree planting");
  expect(report().question).toBe("confirm_report");
}

/** The reply id of a button on the first summary sent, which a later summary has replaced. */
function firstSummaryButton(label: string): string {
  const summary = harness.transport.sent.find((sent) =>
    sent.message.choices?.some((choice) => choice.label === label)
  );
  const id = summary?.message.choices?.find((choice) => choice.label === label)?.id;
  if (!id) throw new Error(`No ${label} button was sent`);
  return id;
}

describe("a correction after the summary", () => {
  it("changes the value and the description that stated it, and the old summary confirms nothing", async () => {
    await summarized();
    const shown = report();
    const confirmButton = firstSummaryButton("Confirm");

    const replies = await harness.say(ADA, "Actually it was 14 seedlings, not 12.");
    const corrected = report();
    expect(corrected.details).toEqual({ seedlings: 14, species: "baobab" });
    expect(corrected.description).toBe(
      "At TAS today I planted 14 baobab seedlings by the fence. It took 3 hours."
    );
    expect(replies).toHaveLength(1);
    expect(replies[0]).toContain("Seedlings planted: 14 seedlings (was 12 seedlings)");
    expect(replies[0]).toContain(
      "Your description said 12 seedlings too, so I changed it to match."
    );
    expect(replies[0]).toContain("Description: At TAS today I planted 14 baobab seedlings");
    expect(corrected.token).not.toBe(shown.token);

    // Neither the old summary's button nor its code confirms the report as it now stands.
    await harness.say(ADA, "Confirm", { replyId: confirmButton });
    await harness.say(ADA, `CONFIRM ${shown.token}`);
    expect(report()).toMatchObject({ state: "review", revision: corrected.revision });
    expect(liveConfirmations()).toBe(0);
  });

  it("changes a choice and the time in the description too", async () => {
    await summarized();
    await harness.say(ADA, "it took 2 hours and the species: neem");

    expect(report()).toMatchObject({
      details: { seedlings: 12, species: "neem" },
      minutes: 120,
      description: "At TAS today I planted 12 Neem seedlings by the fence. It took 2 hours.",
    });
  });

  it("says the description still states the old value when it cannot tell which mention is meant", async () => {
    await harness.say(ADA, "We filled 12 rows with 12 of them");
    await harness.press(ADA, "I agree");
    await harness.press(ADA, "TAS");
    await harness.press(ADA, "Tree planting");
    await harness.say(ADA, "12");
    await harness.press(ADA, "Baobab");
    await harness.say(ADA, "3 hours");

    const replies = await harness.say(ADA, "Actually 14 seedlings");
    expect(report()).toMatchObject({
      details: { seedlings: 14 },
      description: "We filled 12 rows with 12 of them",
    });
    expect(replies[0]).toContain(
      "Your description still says 12 seedlings. Send EDIT to change its wording."
    );
  });

  it("takes a correction a model read in the gardener's own words, and questions any other reading", async () => {
    await harness.say(ADA, "Today I planted twelve baobab seedlings by the fence");
    await harness.press(ADA, "I agree");
    await harness.press(ADA, "TAS");
    await harness.press(ADA, "Tree planting");
    await harness.say(ADA, "12");
    await harness.press(ADA, "Baobab");
    await harness.say(ADA, "3 hours");
    setControl(harness.core, "model_processing", true, { actor: "test", reason: "corrections" });
    const reading = (original: string) => ({
      intent: "correction" as const,
      gardenKey: null,
      actionUID: null,
      facts: [
        { field: "details.seedlings" as const, value: 14, kind: "reported" as const, original },
      ],
      models: ["fixture-model"],
    });

    // The words the model read the value from are in the message: it is the gardener's correction.
    harness.interpreter.responses = [reading("fourteen seedlings")];
    await harness.say(ADA, "Actually it was fourteen seedlings");
    expect(report()).toMatchObject({
      details: { seedlings: 14 },
      stated: true,
      conflicts: [],
      description: "Today I planted 14 baobab seedlings by the fence",
    });

    // A value the message does not state in those words is only a proposal: it is asked about.
    harness.interpreter.responses = [
      { ...reading("20"), facts: reading("20").facts.map((fact) => ({ ...fact, value: 20 })) },
    ];
    await harness.say(ADA, "the photo shows more of them I think");
    expect(report()).toMatchObject({
      details: { seedlings: 14 },
      conflicts: ["details.seedlings"],
    });
  });
});

describe("a correction around confirmation", () => {
  it("withdraws a confirmation that has not been sent, and asks for the revised report to be confirmed", async () => {
    await summarized();
    await harness.say(ADA, `CONFIRM ${report().token}`);
    expect(report().state).not.toBe("review");
    expect(liveConfirmations()).toBe(1);

    await harness.say(ADA, "Actually it was 14 seedlings, not 12.");
    expect(report()).toMatchObject({
      details: { seedlings: 14 },
      state: "review",
      question: "confirm_report",
    });
    expect(liveConfirmations()).toBe(0);
    expect(
      harness.core.db
        .query("SELECT count(*) AS n FROM continuation_requests WHERE state = 'open'")
        .get()
    ).toEqual({ n: 0 });
  });

  it("applies the correction whichever of it and the old code is handled first", async () => {
    await summarized();
    const { token } = report();
    // Both arrive before either is handled: the code, then the correction.
    await harness.post(harness.message(ADA, { text: `CONFIRM ${token}` }));
    await harness.post(harness.message(ADA, { text: "Actually it was 14 seedlings, not 12." }));
    await harness.drain();
    expect(report()).toMatchObject({ details: { seedlings: 14 }, state: "review" });
    expect(liveConfirmations()).toBe(0);

    // And the other way round: the correction first, then the code of the summary it replaced.
    const again = report().token;
    await harness.post(harness.message(ADA, { text: "Actually it was 15 seedlings, not 14." }));
    await harness.post(harness.message(ADA, { text: `CONFIRM ${again}` }));
    await harness.drain();
    expect(report()).toMatchObject({ details: { seedlings: 15 }, state: "review" });
    expect(liveConfirmations()).toBe(0);
  });

  it("leaves a report that is on its way to the chain exactly as confirmed, and says so", async () => {
    await confirmLinkAndPublish(harness);
    const { browser, view, envelope } = await openSigningPage(harness);
    expect((await reserve(browser, view, envelope)).status).toBe(200);
    const before = report();

    const replies = await harness.say(ADA, "Actually it was 14 seedlings, not 12.");
    expect(replies).toEqual(["This report is being published, so I can't change it now."]);
    expect(report()).toMatchObject({
      details: before.details,
      description: before.description,
      revision: before.revision,
      state: before.state,
    });
  });
});
