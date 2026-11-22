import type { ActionDefinition } from "@green-goods/shared/modules/agent-reporting";
import { describe, expect, it } from "vitest";
import { readStory, type StoryContext } from "../../services/reporting/coordinator/story-answers";
import { QUESTION_PROFILES, questionProfileFor } from "../../services/reporting/questions";
import { planting, snapshot } from "./support/fixtures";

/**
 * The deterministic reader: what one message may fill with no model, and what it must leave alone.
 */
const number = (key: string, title: string, unit?: string) => ({
  key,
  title,
  placeholder: "",
  type: "number" as const,
  required: true,
  options: [],
  ...(unit ? { unit } : {}),
});

const plantingEvent: ActionDefinition = {
  ...planting(),
  slug: "agro.planting_event",
  inputs: [
    number("seedlingsPlanted", "Seedlings planted"),
    number("participants", "Participants"),
    {
      key: "speciesTags",
      title: "Species",
      placeholder: "",
      type: "multi-select",
      required: true,
      options: ["Baobab", "Neem", "Moringa", "Fruit tree", "Shade tree", "Native hardwood"],
    },
  ],
};

const milestone: ActionDefinition = {
  ...planting(),
  slug: "solar.install_milestone",
  inputs: [
    number("milestoneValue", "Milestone Value"),
    {
      key: "milestoneType",
      title: "Milestone Type",
      placeholder: "Select the type of milestone",
      type: "select",
      required: true,
      options: [
        "Solar kW installed",
        "Battery kWh added",
        "Internet Mbps provisioned",
        "Retrofit completed",
        "Commissioning",
      ],
    },
  ],
};

const serviceSession: ActionDefinition = {
  ...planting(),
  slug: "solar.service_session",
  inputs: [number("hoursOpen", "Hours open", "hours"), number("usersServed", "Users served")],
};

function reading(
  text: string,
  definition: ActionDefinition,
  context: Partial<StoryContext> = {}
): Record<string, unknown> {
  const frozen = snapshot(definition);
  const facts = readStory(text, {
    snapshot: frozen,
    profile: questionProfileFor(frozen, QUESTION_PROFILES),
    details: {},
    locale: "en",
    ...context,
  });
  return Object.fromEntries(facts.map((fact) => [fact.field, fact.value]));
}

describe("reading several facts from one message", () => {
  it.each([
    [
      "a whole story",
      "At TAS today I planted 12 baobab seedlings by the fence. It took 3 hours.",
      { "details.seedlings": 12, "details.species": "baobab", timeSpentMinutes: 180 },
    ],
    [
      "a correction that names the old value",
      "Actually it was 14 seedlings, not 12.",
      { "details.seedlings": 14 },
    ],
    ["a choice after its field's name", "species: neem", { "details.species": "neem" }],
    ["hours and minutes together", "it took 1 hour 30 minutes", { timeSpentMinutes: 90 }],
    ["an hour in words", "it took an hour and 15 minutes", { timeSpentMinutes: 75 }],
    ["hours written onto minutes", "levou 1h30", { timeSpentMinutes: 90 }],
    ["a half hour", "tardamos 2 horas y media", { timeSpentMinutes: 150 }],
    ["a decimal comma", "trabajamos 1,5 horas", { timeSpentMinutes: 90 }],
    [
      "time named as work",
      "It was 40 minutes of work at the nursery today.",
      { timeSpentMinutes: 40 },
    ],
  ])("reads %s", (_name, text, expected) => {
    expect(reading(text, planting())).toEqual(expected);
  });

  it.each([
    ["a quantity in another unit", "12 kg"],
    ["two different counts for one field", "watered 30 seedlings and planted 12 seedlings"],
    ["a number that names nothing", "we were 5 friends on plot 7"],
    ["a date and a clock time", "on 21/11/2026 at 10:30"],
    ["a thousands separator that could be a decimal", "1.200 seedlings"],
    ["two separate durations", "3 hours on Monday and 2 hours on Tuesday"],
    ["a choice named in passing", "the neem tree by the gate fell over"],
    ["a duration that is not about the work", "give me 5 minutes, I'll send the photos"],
    ["numbers with no word for work done", "12 baobab seedlings, 3 hours"],
  ])("takes nothing from %s", (_name, text) => {
    expect(reading(text, planting())).toEqual({});
  });

  // Each of these once filled a field. A clause the reader cannot account for word by word, or
  // that says the number is not work done, leaves the whole message to a question.
  it.each([
    ["we lost 3 trees to goats", "en"],
    ["murieron 3 árboles por las cabras", "es"],
    ["we expected 50 people but it rained", "en"],
    ["faltaron 5 voluntarios", "es"],
    ["we couldn't plant the 30 seedlings", "en"],
    ["não plantamos 30 mudas", "pt"],
    ["plantamos entre 10 y 12 plántulas", "es"],
    ["12 seedlings? no, more like 20", "en"],
    ["40 mudas não, 45", "pt"],
    ["the 3rd seedling died", "en"],
    ["50% of trees survived", "en"],
    ["next week we will plant 100 trees", "en"],
    ["1 500 mudas plantadas", "pt"],
    ["We planted 40 trees along 200 m of fence", "en"],
    ["Começamos às 8 horas e plantamos 40 mudas com 6 pessoas", "pt"],
    ["Terminamos às 14h, plantamos 40 mudas", "pt"],
    ["I'll send photos of the 40 trees in 2 hours", "en"],
    ["it took me 2 hours to get there", "en"],
    ["12 other people came too", "en"],
    ["my 3 trees at home are fine", "en"],
  ])("takes nothing from %j", (text, locale) => {
    expect(reading(text, plantingEvent, { locale })).toEqual({});
  });

  it("takes nothing an open question did not get", () => {
    const seedlings = { asked: "details.seedlingsPlanted" } as const;
    for (const text of ["see you at 5", "I'll count and tell you at 6", "we were on plot 7"])
      expect(reading(text, plantingEvent, seedlings)).toEqual({});
    const species = { asked: "details.speciesTags" } as const;
    for (const text of [
      "no fruit trees, only shade trees",
      "I don't know the species, ask the other volunteers",
      "mango and guava, 12 trees total",
    ])
      expect(reading(text, plantingEvent, species)).toEqual({});
    expect(
      reading("I don't know, give me 5 minutes to ask", planting(), { asked: "timeSpentMinutes" })
    ).toEqual({});
  });

  it("takes a count and species named in many words, as the grouped question asks them", () => {
    const asked = { asked: ["details.seedlingsPlanted", "details.speciesTags"] as const };
    expect(
      reading("40 fruit trees and shade trees", plantingEvent, { asked: [...asked.asked] })
    ).toEqual({
      "details.seedlingsPlanted": 40,
      "details.speciesTags": ["Fruit tree", "Shade tree"],
    });
    expect(reading("Native hardwood", plantingEvent, { asked: [...asked.asked] })).toEqual({
      "details.speciesTags": ["Native hardwood"],
    });
  });

  it("gives a bare number, and a choice named alone, to the open question", () => {
    expect(reading("12, 3 hours", planting(), { asked: "details.seedlings" })).toEqual({
      "details.seedlings": 12,
      timeSpentMinutes: 180,
    });
    expect(reading("12 and 45 min", planting(), { asked: "details.seedlings" })).toEqual({
      "details.seedlings": 12,
      timeSpentMinutes: 45,
    });
    expect(reading("12 baobab", planting(), { asked: "details.seedlings" })).toEqual({
      "details.seedlings": 12,
      "details.species": "baobab",
    });
    expect(reading("it was mostly baobab", planting(), { asked: "details.species" })).toEqual({
      "details.species": "baobab",
    });
    // With no question open, a bare number is nobody's.
    expect(reading("12", planting())).toEqual({});
  });

  it("reads a field by the words its profile lists, in each language", () => {
    expect(reading("We planted 40 trees with 6 volunteers", plantingEvent)).toEqual({
      "details.seedlingsPlanted": 40,
      "details.participants": 6,
    });
    expect(
      reading("Plantamos 40 plántulas de neem con 6 personas en 2 horas", plantingEvent, {
        locale: "es",
      })
    ).toEqual({
      "details.seedlingsPlanted": 40,
      "details.speciesTags": ["Neem"],
      "details.participants": 6,
      timeSpentMinutes: 120,
    });
    expect(
      reading("Plantamos 40 mudas com 6 pessoas, levou 90 minutos", plantingEvent, {
        locale: "pt",
      })
    ).toEqual({
      "details.seedlingsPlanted": 40,
      "details.participants": 6,
      timeSpentMinutes: 90,
    });
  });

  it("reads a milestone's number only in the unit its type measures", () => {
    const solar = { details: { milestoneType: "Solar kW installed" } };
    expect(reading("we installed 5 kW", milestone, solar)).toEqual({ "details.milestoneValue": 5 });
    expect(reading("we added 5 kWh", milestone, solar)).toEqual({});
    // A completion type counts things, in the words for them, and only in whole numbers.
    const retrofit = { details: { milestoneType: "Retrofit completed" } };
    expect(reading("2 retrofits done", milestone, retrofit)).toEqual({
      "details.milestoneValue": 2,
    });
    expect(reading("concluímos 2 reformas", milestone, { ...retrofit, locale: "pt" })).toEqual({
      "details.milestoneValue": 2,
    });
    expect(reading("0.5 retrofits done", milestone, retrofit)).toEqual({});
  });

  it("leaves a duration to the field that counts it, unless time is what was asked", () => {
    expect(reading("open 6 hours for 30 users", serviceSession)).toEqual({
      "details.hoursOpen": 6,
      "details.usersServed": 30,
    });
    expect(reading("6 hours", serviceSession, { asked: "timeSpentMinutes" })).toEqual({
      timeSpentMinutes: 360,
    });
  });
});
