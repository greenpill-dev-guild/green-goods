import { describe, expect, it } from "vitest";
import { reviseDescription } from "../../services/reporting/coordinator/description";

/** A corrected value against the description that stated the old one. */
describe("keeping a description in step with a correction", () => {
  it.each([
    [
      "digits",
      "At TAS today I planted 12 baobab seedlings by the fence. It took 3 hours.",
      { kind: "number", before: 12, after: 14 },
      "At TAS today I planted 14 baobab seedlings by the fence. It took 3 hours.",
    ],
    [
      "a number word",
      "Today I planted twelve baobab seedlings by the fence",
      { kind: "number", before: 12, after: 14 },
      "Today I planted 14 baobab seedlings by the fence",
    ],
    [
      "a Spanish number word with an accent elsewhere",
      "Plantamos doce plantones en el jardín",
      { kind: "number", before: 12, after: 14 },
      "Plantamos 14 plantones en el jardín",
    ],
    [
      "a choice's name",
      "We planted 12 Baobab seedlings",
      { kind: "words", before: "baobab", after: "Neem" },
      "We planted 12 Neem seedlings",
    ],
    [
      "a stated duration",
      "It took 3 hours in the sun",
      { kind: "words", before: "3 hours", after: "2 hours" },
      "It took 2 hours in the sun",
    ],
  ] as const)("replaces %s", (_name, description, change, revised) => {
    expect(reviseDescription(description, change)).toEqual({ revised, stale: false });
  });

  it("picks the mention inside the words the value was read from", () => {
    const description = "12 of us planted 12 baobab seedlings";
    expect(
      reviseDescription(description, {
        kind: "number",
        before: 12,
        after: 14,
        beforeWords: "12 baobab seedlings",
      })
    ).toEqual({ revised: "12 of us planted 14 baobab seedlings", stale: false });
  });

  it("leaves the description alone and says so when it cannot tell which mention is meant", () => {
    expect(
      reviseDescription("12 of us planted 12 seedlings", { kind: "number", before: 12, after: 14 })
    ).toEqual({ revised: null, stale: true });
  });

  it.each([
    ["the value is not in it", "We planted seedlings by the fence"],
    [
      "the digits belong to a date, a time or a larger number",
      "On 12/11 at 12:30 we planted 120 trees, 1.12 kg each",
    ],
  ])("changes nothing when %s", (_name, description) => {
    expect(reviseDescription(description, { kind: "number", before: 12, after: 14 })).toEqual({
      revised: null,
      stale: false,
    });
  });
});
