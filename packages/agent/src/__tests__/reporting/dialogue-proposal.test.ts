import { describe, expect, it } from "vitest";
import {
  type DialogueProposal,
  parseProposal,
  proposalFromInterpretation,
  validateProposal,
} from "../../services/reporting/dialogue-proposal";
import type { InterpretationRequest } from "../../services/reporting/interpretation";

/**
 * What a model may propose, and what the validator does with what it should not have. The request
 * stands for a report with its activity chosen, two gardens on offer and two questions left.
 */
const request = {
  version: 1,
  locale: "en",
  goal: "report",
  draftRevision: 4,
  message: { sourceEntryId: "src-1", text: "12 baobab seedlings" },
  turns: [],
  question: null,
  content: { actionUID: 7, title: null, timeSpentMinutes: null, feedback: null, details: {} },
  provenance: {},
  conflicts: [],
  requirements: [{ kind: "detail", key: "seedlings" }, { kind: "time" }],
  gardens: [
    { key: "g1", label: "TAS" },
    { key: "g2", label: "Aiyeloja Family Garden" },
  ],
  actions: [
    {
      uid: 7,
      title: "Tree planting",
      inputs: [
        {
          key: "seedlings",
          title: "Seedlings planted",
          placeholder: "",
          type: "number",
          required: true,
          options: [],
        },
      ],
    },
    {
      uid: 8,
      title: "Weeding",
      inputs: [
        { key: "area", title: "Area", placeholder: "", type: "band", required: true, options: [] },
      ],
    },
  ],
  observations: [],
} as unknown as InterpretationRequest;

const proposal = (actions: unknown[], overrides: Partial<DialogueProposal> = {}) => ({
  version: 1,
  revision: 4,
  locale: "en",
  actions,
  models: ["test-model"],
  ...overrides,
});

const fact = (field: string, value: unknown) => ({ field, value, kind: "reported" });

describe("a model's proposal", () => {
  it.each([
    ["confirm the report", { kind: "confirm" }],
    ["publish", { kind: "publish", token: "1234" }],
    ["record consent", { kind: "consent", answer: "agree" }],
    ["switch account", { kind: "switch_account", account: "0xabc" }],
    ["state an outcome", { kind: "explain", topic: "published" }],
    ["say something of its own", { kind: "say", text: "Your report is published ✅" }],
    ["smuggle a field into a known action", { kind: "show_summary", confirm: true }],
  ])("is refused whole when it tries to %s", (_name, action) => {
    expect(parseProposal(proposal([fact("timeSpentMinutes", 60), action]))).toBeNull();
    expect(parseProposal(proposal([action]))).toBeNull();
  });

  it("is refused whole when it answers another revision or language, or is too long", () => {
    const set = { kind: "set_fields", facts: [fact("details.seedlings", 12)], corrects: false };
    const good = parseProposal(proposal([set]));
    expect(good && validateProposal(good, request)).not.toBeNull();
    const stale = parseProposal(proposal([set], { revision: 3 }));
    expect(stale && validateProposal(stale, request)).toBeNull();
    const elsewhere = parseProposal(proposal([set], { locale: "pt" }));
    expect(elsewhere && validateProposal(elsewhere, request)).toBeNull();
    expect(
      parseProposal(proposal(Array.from({ length: 9 }, () => ({ kind: "show_summary" }))))
    ).toBeNull();
    expect(
      parseProposal(
        proposal([{ kind: "ask", questions: ["details.seedlings", "timeSpentMinutes", "title"] }])
      )
    ).toBeNull();
  });

  it("keeps what the snapshot offered and leaves out the rest, one action at a time", () => {
    const parsed = parseProposal(
      proposal([
        { kind: "select_garden", garden: "0x00000000000000000000000000000000000000aa" },
        { kind: "select_activity", activity: 99 },
        {
          kind: "set_fields",
          corrects: false,
          facts: [
            fact("details.seedlings", 12),
            // A field of the other candidate activity, and one nobody defined.
            fact("details.area", "large"),
            fact("details.authorAccount", "0xabc"),
          ],
        },
        { kind: "ask", questions: ["timeSpentMinutes", "garden"] },
        { kind: "select_garden", garden: "g2" },
      ])
    );
    const validated = parsed && validateProposal(parsed, request);
    expect(validated?.interpretation).toMatchObject({
      intent: "report_content",
      gardenKey: null,
      actionUID: null,
      facts: [{ field: "details.seedlings", value: 12 }],
    });
    expect(validated?.ask).toEqual(["timeSpentMinutes"]);
    expect(validated?.refused).toEqual([
      { kind: "select_garden", reason: "not_offered" },
      { kind: "select_activity", reason: "not_offered" },
      { kind: "set_fields", reason: "not_allowed" },
      { kind: "ask", reason: "not_outstanding" },
      { kind: "select_garden", reason: "repeated" },
    ]);
  });

  it("reads an aside as an aside, and a report that also greets as a report", () => {
    const of = (actions: unknown[]) => {
      const parsed = parseProposal(proposal(actions));
      return parsed && validateProposal(parsed, request)?.interpretation.intent;
    };
    expect(of([{ kind: "explain", topic: "status" }])).toBe("status");
    expect(of([{ kind: "request_link" }])).toBe("connect");
    expect(
      of([
        { kind: "select_garden", garden: "g1" },
        { kind: "explain", topic: "help" },
      ])
    ).toBe("help");
    expect(
      of([
        { kind: "set_fields", facts: [fact("details.seedlings", 12)], corrects: true },
        { kind: "explain", topic: "greeting" },
      ])
    ).toBe("correction");
    expect(of([])).toBe("unclear");

    // A status question answered with the report's own values is still a status question.
    const held = { ...request, content: { ...request.content, details: { seedlings: 12 } } };
    const restating = parseProposal(
      proposal([
        { kind: "set_fields", facts: [fact("details.seedlings", 12)], corrects: false },
        { kind: "explain", topic: "status" },
      ])
    );
    const read = restating && validateProposal(restating, held as InterpretationRequest);
    expect(read?.interpretation).toMatchObject({ intent: "status", facts: [] });
  });

  it("restates the routing and extraction pair's reading without adding to it", () => {
    const restated = proposalFromInterpretation(
      {
        intent: "correction",
        gardenKey: "g1",
        actionUID: 7,
        facts: [{ field: "details.seedlings", value: 14, kind: "reported" }],
        models: ["jev", "openai"],
      },
      request
    );
    expect(restated).toEqual(
      proposal(
        [
          { kind: "select_garden", garden: "g1" },
          { kind: "select_activity", activity: 7 },
          { kind: "set_fields", facts: [fact("details.seedlings", 14)], corrects: true },
        ],
        { models: ["jev", "openai"] }
      )
    );
    expect(parseProposal(restated)).toEqual(restated);
  });
});
