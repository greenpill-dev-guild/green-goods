import { afterEach, describe, expect, it } from "vitest";
import { createModelInterpreter } from "../../services/reporting/interpretation";
import { extractWithOpenAI } from "../../services/reporting/model-extraction";
import { loadDraft } from "../../services/reporting/drafts";
import { openPrompt } from "../../services/reporting/prompts";
import { planting, snapshot, TAS } from "./support/fixtures";
import { ADA, Harness } from "./support/harness";

/**
 * Whole stories read against the activity's own fields, through the real OpenAI adapter with its
 * replies recorded. The stories use number words, which the reader that works without a model
 * cannot place, so every value below came through a model reading and the core's checks. These
 * prove the requests and what the core does with the replies, not the quality of a live model.
 */
interface Sent {
  message: string;
  fields: string[];
  activities: number[];
  gardens: string[];
}

function recordedModel(replies: unknown[]) {
  const sent: Sent[] = [];
  const fetchStub = (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    const snapshotText = body.input[1].content[0].text as string;
    const given = JSON.parse(snapshotText);
    sent.push({
      message: given.message,
      fields: body.text.format.schema.properties.facts.items.properties.field.enum,
      activities: given.activities.map((activity: { uid: number }) => activity.uid),
      gardens: given.gardens.map((garden: { key: string }) => garden.key),
    });
    const reply = replies.shift();
    if (reply === undefined) return new Response("no recorded reply", { status: 500 });
    return new Response(
      JSON.stringify({
        model: "gpt-4.1-mini-2025-04-14",
        status: "completed",
        output: [
          { type: "message", content: [{ type: "output_text", text: JSON.stringify(reply) }] },
        ],
      }),
      { status: 200 }
    );
  }) as unknown as typeof fetch;
  const config = { apiKey: "sk-recorded", baseUrl: "https://openai.test/v1", model: "recorded" };
  const interpreter = createModelInterpreter({
    route: null,
    extract: (request, signal, meter) =>
      extractWithOpenAI({ ...config, fetch: fetchStub }, request, signal, meter),
  });
  if (!interpreter) throw new Error("no interpreter");
  return { interpreter, sent };
}

const fact = (field: string, value: unknown, original: string, unit: string | null = null) => ({
  field,
  value,
  original,
  unit,
});

let harness: Harness;

afterEach(() => {
  harness.close();
});

function report() {
  const row = harness.core.db.query("SELECT id FROM work_drafts").get() as { id: string };
  const draft = loadDraft(harness.core, row.id);
  if (!draft) throw new Error("No report was started");
  const prompt = openPrompt(harness.core, draft.conversationId);
  return {
    content: draft.content,
    question: prompt?.kind ?? null,
    field: prompt?.fieldKey ?? null,
  };
}

const STORY = "At TAS today I planted twelve baobab seedlings by the fence. It took three hours.";
const DETAIL_FIELDS = ["details.seedlings", "details.species", "details.notes"];

describe("a whole story, read with a model", () => {
  it("names the garden, then the activity and its details from the same words, in two readings", async () => {
    const model = recordedModel([
      // First reading: no activity can be offered until the garden is known.
      {
        intent: "report_content",
        gardenKey: "g1",
        actionUID: null,
        facts: [fact("timeSpentMinutes", 180, "three hours")],
      },
      // Second reading: the same words against the garden's activities.
      {
        intent: "report_content",
        gardenKey: "g1",
        actionUID: 7,
        facts: [
          fact("details.seedlings", 12, "twelve baobab seedlings", "seedlings"),
          fact("details.species", "baobab", "baobab"),
          // An activity TAS does not offer under this report, and a field no activity has.
          fact("details.area", "large", "by the fence"),
        ],
      },
    ]);
    harness = new Harness({ controls: { model_processing: true }, interpreter: model.interpreter });
    await harness.say(ADA, STORY);
    const replies = await harness.press(ADA, "I agree");

    expect(model.sent).toHaveLength(2);
    expect(model.sent[0]).toMatchObject({ gardens: ["g1", "g2"], activities: [] });
    expect(model.sent[0]?.fields).toEqual(["title", "timeSpentMinutes", "feedback"]);
    // The second reading is given TAS alone, its two activities and all their fields.
    expect(model.sent[1]).toMatchObject({ message: STORY, gardens: ["g1"], activities: [7, 8] });
    expect(model.sent[1]?.fields).toEqual(
      expect.arrayContaining([...DETAIL_FIELDS, "details.area"])
    );

    const { content, question } = report();
    expect(content.garden?.address).toBe(TAS.address);
    expect(content.actionUID).toBe(7);
    expect(content.details).toEqual({ seedlings: 12, species: "baobab" });
    expect(content.timeSpentMinutes).toBe(180);
    // Nothing is asked again: the reply is the summary.
    expect(question).toBe("confirm_report");
    expect(replies.at(-1)).toContain("Seedlings planted: 12 seedlings");
    // A model's reading is never the gardener's statement.
    expect(content.provenance["details.seedlings"]).toMatchObject({
      origin: "model",
      gardenerStated: false,
    });
  });

  it("reads the story again when the gardener picks the activity, and asks only what is left", async () => {
    const model = recordedModel([
      // The story names neither garden nor activity clearly enough.
      { intent: "report_content", gardenKey: null, actionUID: null, facts: [] },
      // Read again once Tree planting is chosen: the count is there, the species is not.
      {
        intent: "report_content",
        gardenKey: null,
        actionUID: 7,
        facts: [
          fact("details.seedlings", 12, "twelve seedlings", "seedlings"),
          fact("timeSpentMinutes", 180, "three hours"),
        ],
      },
    ]);
    harness = new Harness({ controls: { model_processing: true }, interpreter: model.interpreter });
    await harness.say(ADA, "Today I planted twelve seedlings by the fence. It took three hours.");
    await harness.press(ADA, "I agree");
    await harness.press(ADA, "TAS");
    const replies = await harness.press(ADA, "Tree planting");

    expect(model.sent).toHaveLength(2);
    expect(model.sent[1]).toMatchObject({ activities: [7] });
    expect(model.sent[1]?.fields).toEqual([
      "title",
      "timeSpentMinutes",
      "feedback",
      ...DETAIL_FIELDS,
    ]);
    expect(report()).toMatchObject({
      content: { details: { seedlings: 12 }, timeSpentMinutes: 180 },
      question: "field",
      field: "species",
    });
    expect(replies).toHaveLength(1);
    expect(replies[0]).toContain("1 quick question");
  });

  it("gives a correction after the summary the report's own fields to change", async () => {
    const model = recordedModel([
      { intent: "report_content", gardenKey: null, actionUID: null, facts: [] },
      {
        intent: "report_content",
        gardenKey: null,
        actionUID: 7,
        facts: [
          fact("details.seedlings", 12, "twelve seedlings", "seedlings"),
          fact("details.species", "baobab", "baobab"),
          fact("timeSpentMinutes", 180, "three hours"),
        ],
      },
      // The correction: the catalogue is not read this turn, yet the count's field is on offer.
      {
        intent: "correction",
        gardenKey: null,
        actionUID: null,
        facts: [fact("details.seedlings", 14, "fourteen seedlings", "seedlings")],
      },
    ]);
    harness = new Harness({ controls: { model_processing: true }, interpreter: model.interpreter });
    await harness.say(ADA, STORY);
    await harness.press(ADA, "I agree");
    await harness.press(ADA, "TAS");
    await harness.press(ADA, "Tree planting");
    expect(report().question).toBe("confirm_report");
    const reads = harness.catalog.calls;

    const replies = await harness.say(ADA, "Actually it was fourteen seedlings, not twelve.");
    expect(harness.catalog.calls).toBe(reads);
    expect(model.sent[2]).toMatchObject({ activities: [7] });
    expect(model.sent[2]?.fields).toEqual(expect.arrayContaining(DETAIL_FIELDS));
    expect(report()).toMatchObject({
      content: { details: { seedlings: 14 } },
      question: "confirm_report",
    });
    expect(replies[0]).toContain("14 seedlings (was 12 seedlings)");
  });

  it("leaves out an amount read in another unit, and falls back to its question when the model fails", async () => {
    const model = recordedModel([
      { intent: "report_content", gardenKey: null, actionUID: null, facts: [] },
      {
        intent: "report_content",
        gardenKey: null,
        actionUID: 7,
        facts: [fact("details.seedlings", 12, "twelve kilos of seedlings", "kg")],
      },
      // No third reply is recorded: the next reading fails.
    ]);
    harness = new Harness({ controls: { model_processing: true }, interpreter: model.interpreter });
    harness.catalog.actions.set(TAS.key, [snapshot(planting())]);
    await harness.say(ADA, "I planted twelve kilos of seedlings today");
    await harness.press(ADA, "I agree");
    await harness.press(ADA, "TAS");
    await harness.press(ADA, "Tree planting");

    // Twelve kilos is not a count of seedlings: the field stays empty and is asked.
    expect(report()).toMatchObject({
      content: { details: {} },
      question: "field",
      field: "seedlings",
    });
    // Typed at the species question later, words the failed model cannot read get the question again.
    await harness.say(ADA, "12");
    const replies = await harness.say(ADA, "the big ones");
    expect(replies.at(-1)).toContain("Main species");
    expect(report().content.details).toEqual({ seedlings: 12 });
  });
});
