import { afterEach, describe, expect, it, vi } from "vitest";
import { forSeededCases } from "./seeded-cases";

const CASE_LABEL = /^Seeded case 1 of 100 \(GG_PROPERTY_SEED=\d+\): /;

function failureOf(run: () => void): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error("expected the seeded run to fail");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("forSeededCases", () => {
  it("names the seed and case when a check throws a DOMException, keeping it as the cause", () => {
    const failure = failureOf(() =>
      forSeededCases(() => {
        // btoa refuses characters outside Latin-1 with a DOMException, whose message has no setter.
        btoa("中");
      })
    );

    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toMatch(CASE_LABEL);
    expect((failure as Error).message).toContain("InvalidCharacterError");
    // The DOM environment's own DOMException class, so match it by name, not by constructor.
    expect((failure as Error).cause).toMatchObject({ name: "InvalidCharacterError" });
  });

  it("keeps an assertion's own error, with its diff, and adds the seed and case", () => {
    let thrown: unknown;
    const failure = failureOf(() =>
      forSeededCases(() => {
        try {
          expect(1).toBe(2);
        } catch (error) {
          thrown = error;
          throw error;
        }
      })
    );

    expect(failure).toBe(thrown);
    expect((failure as Error).message).toMatch(CASE_LABEL);
    expect(failure).toMatchObject({ actual: 1, expected: 2 });
  });

  it("names the seed and case when a check throws something that is not an error", () => {
    const failure = failureOf(() =>
      forSeededCases(() => {
        throw "plain text";
      })
    );

    expect((failure as Error).message).toMatch(CASE_LABEL);
    expect((failure as Error).message).toContain("plain text");
    expect((failure as Error).cause).toBe("plain text");
  });

  it("replays the same inputs for a seed, and other inputs for another seed", () => {
    const draw = () => {
      const values: number[] = [];
      forSeededCases((source) => {
        values.push(source.int(0, 1_000_000));
      }, 20);
      return values;
    };

    vi.stubEnv("GG_PROPERTY_SEED", "17");
    const first = draw();
    expect(draw()).toEqual(first);

    vi.stubEnv("GG_PROPERTY_SEED", "18");
    expect(draw()).not.toEqual(first);
  });
});
