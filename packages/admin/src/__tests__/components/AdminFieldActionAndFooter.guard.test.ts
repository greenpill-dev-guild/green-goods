// TEST-QUALITY: allow-small-test-file - two sweeps of admin source, plus the anchor that keeps the exception list to files that still need it
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard for two layouts the Hub kept building by hand, each a few pixels off:
 *
 * 1. A button beside a field goes in the field's `action` slot
 *    (`AdminTextField`, `AdminSelect`), which centres it on the control. Laid
 *    beside the whole field it lines up with the label and the reserved message
 *    line as well, so every site carried its own lift (`mb-9`, `sm:mt-8`) and
 *    sat 6 to 8px off the control's centre.
 * 2. The actions a dialog or flow stacks under its body are the shared
 *    `SheetActions` bar: 40px buttons 8px apart, the primary on top below 640px.
 *    A hand-built footer stacks the Hub's 32px buttons with their finger-box
 *    reserve, which leaves 20px between them.
 */

const ADMIN_SRC = join(__dirname, "..", "..");

/** A margin that lifts one element at one breakpoint, or the message line's own height. */
const HAND_LIFT = /(?<![\w:-])(?:mb-9|(?:sm|md|lg|xl):m[tb]-[\d.]+)(?![\w.-])/g;
/** Full width when stacked, its own width in a row: the hand-built footer's button. */
const HAND_STACKED_BUTTON = /(?<![\w:-])w-full sm:w-auto(?![\w.-])/g;

/**
 * Lifts the slot cannot replace. Each entry says why; the list only shrinks.
 */
const LIFT_EXCEPTIONS: Record<string, string> = {
  // Its Remove sits beside Outcome below the `@xl` container width and beside
  // Target from it, so no one field's slot can hold it at both.
  "components/Assessment/CreateAssessmentSteps/AssessmentOutcomeFields.tsx": "responsive grid",
};

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "__tests__" || entry === "__mocks__" || entry === "node_modules") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
      continue;
    }
    if (!entry.endsWith(".tsx") || entry.includes(".test.") || entry.includes(".stories."))
      continue;
    out.push(full);
  }
  return out;
}

const files = sourceFiles(ADMIN_SRC).map((file) => ({
  path: relative(ADMIN_SRC, file).split("\\").join("/"),
  text: readFileSync(file, "utf8"),
}));

const hits = (text: string, pattern: RegExp) =>
  [...text.matchAll(pattern)].map((match) => match[0]);

describe("a field's button and a sheet's actions come from the system", () => {
  it("puts a button beside a field in the field's action slot, never on a hand-tuned lift", () => {
    const lifted = files
      .filter((file) => /<Admin(?:TextField|Select)\b/.test(file.text))
      .filter((file) => !(file.path in LIFT_EXCEPTIONS))
      .flatMap((file) => hits(file.text, HAND_LIFT).map((lift) => `${file.path}: ${lift}`));
    expect(lifted).toEqual([]);
  });

  it("keeps the exception list to files that still lift something", () => {
    for (const path of Object.keys(LIFT_EXCEPTIONS)) {
      const file = files.find((entry) => entry.path === path);
      expect(file ? hits(file.text, HAND_LIFT).length : 0, path).toBeGreaterThan(0);
    }
  });

  it("stacks a dialog's or flow's actions with the shared SheetActions bar", () => {
    const handBuilt = files.flatMap((file) =>
      hits(file.text, HAND_STACKED_BUTTON).map((found) => `${file.path}: ${found}`)
    );
    expect(handBuilt).toEqual([]);
  });
});
