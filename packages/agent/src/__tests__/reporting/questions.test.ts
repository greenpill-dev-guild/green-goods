import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ActionDefinition } from "@green-goods/shared/modules/agent-reporting";
import type { WorkInput } from "@green-goods/shared/types/domain";
import { describe, expect, it } from "vitest";
import { EN_REPORTING_COPY } from "../../services/reporting/copy/en";
import {
  acceptsAmount,
  profiledInput,
  profiledQuestion,
  profileRef,
  QUESTION_PROFILES,
  type QuestionProfile,
  questionProfileFor,
} from "../../services/reporting/questions";
import { planting, snapshot } from "./support/fixtures";

/**
 * Question profiles against the definitions they were written for: a profile is used only where
 * its fields still match, and never invents a meaning the activity has not been given.
 */
interface PublishedAction {
  slug: string;
  uiConfig: { details: { inputs: WorkInput[] } };
}

const published = (
  JSON.parse(
    readFileSync(join(__dirname, "../../../../contracts/config/actions.json"), "utf8")
  ) as { actions: PublishedAction[] }
).actions;

function definitionOf(
  slug: string,
  change: (inputs: WorkInput[]) => WorkInput[] = (inputs) => inputs
) {
  const action = published.find((candidate) => candidate.slug === slug);
  if (!action) throw new Error(`No published activity ${slug}`);
  const definition: ActionDefinition = {
    ...planting(),
    slug,
    inputs: change(action.uiConfig.details.inputs.map((input) => ({ ...input }))),
  };
  return snapshot(definition);
}

describe("question profiles", () => {
  it.each(
    QUESTION_PROFILES.map((profile) => [profile.slug, profile] as const)
  )("fits the published definition of %s, and asks in words the catalog has", (slug, profile) => {
    expect(questionProfileFor(definitionOf(slug), QUESTION_PROFILES)).toBe(profile);
    const keys = Object.values(profile.fields).flatMap((field) => [
      ...(field.ask ? [field.ask] : []),
      ...Object.values(field.by?.choices ?? {}).map((choice) => choice.ask),
    ]);
    for (const key of keys) expect(EN_REPORTING_COPY[key]).toMatch(/\?/u);
  });

  it("is not used once the definition no longer has its fields as it knew them", () => {
    const retyped = definitionOf("solar.install_milestone", (inputs) =>
      inputs.map((input) =>
        input.key === "milestoneValue" ? { ...input, type: "text" as const } : input
      )
    );
    const renamed = definitionOf("solar.install_milestone", (inputs) =>
      inputs.map((input) =>
        input.key === "milestoneType"
          ? { ...input, options: input.options.filter((option) => !option.startsWith("Solar")) }
          : input
      )
    );
    const removed = definitionOf("agro.planting_event", (inputs) =>
      inputs.filter((input) => input.key !== "participants")
    );
    for (const changed of [retyped, renamed, removed])
      expect(questionProfileFor(changed, QUESTION_PROFILES)).toBeNull();
    expect(questionProfileFor(snapshot(planting()), QUESTION_PROFILES)).toBeNull();
  });

  it("gives a new report the newest version, and a report in progress only the one it has", () => {
    const [first] = QUESTION_PROFILES;
    if (!first) throw new Error("no built-in profile");
    const second: QuestionProfile = { ...first, version: first.version + 1 };
    const definition = definitionOf(first.slug);

    expect(questionProfileFor(definition, [first, second])).toBe(second);
    expect(questionProfileFor(definition, [first, second], profileRef(first))).toBe(first);
    // Its version is gone, or it never had one: the definition's own words ask.
    expect(questionProfileFor(definition, [second], profileRef(first))).toBeNull();
    expect(questionProfileFor(definition, [first, second], null)).toBeNull();
  });

  it("gives a milestone's number the question, and the unit, its type was given", () => {
    const definition = definitionOf("solar.install_milestone");
    const profile = questionProfileFor(definition, QUESTION_PROFILES);
    const value = definition.definition.inputs.find((input) => input.key === "milestoneValue");
    if (!value) throw new Error("milestoneValue missing");
    const asked = (milestoneType: string) => ({
      unit: profiledInput(profile, value, { milestoneType }).unit,
      question: profiledQuestion(profile, "milestoneValue", { milestoneType }),
    });

    expect(asked("Solar kW installed")).toEqual({
      unit: "kW",
      question: "question.milestoneSolar",
    });
    expect(asked("Battery kWh added")).toEqual({
      unit: "kWh",
      question: "question.milestoneBattery",
    });
    expect(asked("Internet Mbps provisioned")).toEqual({
      unit: "Mbps",
      question: "question.milestoneInternet",
    });
    // The two completion types are counts: a question of their own, and no unit to show.
    expect(asked("Retrofit completed")).toEqual({
      unit: undefined,
      question: "question.milestoneRetrofit",
    });
    expect(asked("Commissioning")).toEqual({
      unit: undefined,
      question: "question.milestoneCommissioning",
    });
    // A type the activity gains later has no agreed meaning: the definition's own words ask it.
    expect(asked("Grid connection")).toEqual({ unit: undefined, question: null });
  });

  it("takes only a whole number of one or more for a count, and any amount for a measure", () => {
    const profile = questionProfileFor(definitionOf("solar.install_milestone"), QUESTION_PROFILES);
    const accepts = (milestoneType: string, value: number) =>
      acceptsAmount(profile, "milestoneValue", { milestoneType }, value);

    expect([2, 1].map((value) => accepts("Retrofit completed", value))).toEqual([true, true]);
    expect([0, 0.5, 2.5].map((value) => accepts("Commissioning", value))).toEqual([
      false,
      false,
      false,
    ]);
    expect([0.5, 5.5].map((value) => accepts("Solar kW installed", value))).toEqual([true, true]);
  });
});
