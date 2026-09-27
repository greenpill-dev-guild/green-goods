import { describe, expect, it } from "vitest";
import {
  pageChoices,
  parseDurationAnswer,
  parseFieldAnswer,
  validateDetailValue,
} from "../../../modules/agent-reporting/field-answers";
import type { WorkInput } from "../../../types/domain";

const input = (overrides: Partial<WorkInput>): WorkInput => ({
  key: "field",
  title: "Field",
  placeholder: "",
  type: "text",
  required: true,
  options: [],
  ...overrides,
});

const seedlings = input({ key: "seedlings", type: "number", unit: "seedlings" });
const species = input({
  key: "species",
  type: "select",
  options: ["moringa", "baobab", "neem"],
  optionLabels: { moringa: "Moringa", baobab: "Baobab", neem: "Neem" },
});
const methods = input({
  key: "methods",
  type: "multi-select",
  options: ["mulch", "compost", "water"],
});
const size = input({ key: "size", type: "band", options: [], bands: ["small", "large"] });
const crew = input({ key: "crew", type: "repeater" });

describe("parseFieldAnswer", () => {
  it.each([
    [seedlings, "12", { ok: true, value: 12 }],
    [seedlings, "2,5", { ok: true, value: 2.5 }],
    [seedlings, "12 seedlings", { ok: true, value: 12 }],
    [seedlings, "twelve", { ok: false, reason: "not_a_number" }],
    [seedlings, "1.200", { ok: false, reason: "ambiguous_number" }],
    [seedlings, "-3", { ok: false, reason: "negative" }],
    [seedlings, "10 bags", { ok: false, reason: "unit_mismatch", statedUnit: "bags" }],
    [species, "2", { ok: true, value: "baobab" }],
    [species, "neem", { ok: true, value: "neem" }],
    [species, "Oak", { ok: false, reason: "unknown_option" }],
    [methods, "1, 3", { ok: true, value: ["mulch", "water"] }],
    [methods, "mulch and compost", { ok: true, value: ["mulch", "compost"] }],
    [methods, "mulch, rocks", { ok: false, reason: "unknown_option" }],
    [size, "large", { ok: true, value: "large" }],
    [crew, "Ada and Bola", { ok: false, reason: "unsupported_input" }],
    [input({ type: "textarea" }), "  Cleared the bed  ", { ok: true, value: "Cleared the bed" }],
    [input({ type: "text" }), "   ", { ok: false, reason: "empty" }],
  ])("%#: %s answers %j", (field, answer, expected) => {
    expect(parseFieldAnswer(field, answer)).toMatchObject(expected);
  });

  it("numbers options by the page the question actually showed", () => {
    expect(parseFieldAnswer(species, "1", ["neem"])).toMatchObject({ ok: true, value: "neem" });
  });
});

describe("parseDurationAnswer", () => {
  it.each([
    ["2 hours", { ok: true, minutes: 120, unit: "hours" }],
    ["1.5h", { ok: true, minutes: 90, unit: "hours" }],
    ["90 min", { ok: true, minutes: 90, unit: "minutes" }],
    ["2 horas", { ok: true, minutes: 120, unit: "hours" }],
    ["1h30", { ok: true, minutes: 90 }],
    ["1:45", { ok: true, minutes: 105 }],
    ["3", { ok: false, reason: "unit_required" }],
    ["3 bags", { ok: false, reason: "unit_mismatch" }],
    ["", { ok: false, reason: "empty" }],
  ])("%s", (answer, expected) => {
    expect(parseDurationAnswer(answer)).toMatchObject(expected);
  });
});

describe("validateDetailValue", () => {
  it.each([
    [seedlings, 4, true],
    [seedlings, "4", false],
    [species, "baobab", true],
    [species, "oak", false],
    [methods, ["mulch", "mulch"], true],
    [methods, [], false],
    [crew, [{ name: "Ada" }], false],
  ])("%#", (field, value, ok) => {
    expect(validateDetailValue(field, value).ok).toBe(ok);
  });
});

describe("pageChoices", () => {
  it("pages a long option list instead of truncating it", () => {
    const many = input({ type: "select", options: Array.from({ length: 12 }, (_, i) => `o${i}`) });
    expect(pageChoices(many, 0, 10)).toMatchObject({ hasMore: true });
    expect(pageChoices(many, 1, 10)).toEqual({
      keys: ["o10", "o11"],
      labels: ["o10", "o11"],
      hasMore: false,
    });
  });
});
