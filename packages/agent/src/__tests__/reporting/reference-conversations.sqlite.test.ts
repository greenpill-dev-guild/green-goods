import type { ActionDefinition } from "@green-goods/shared/modules/agent-reporting";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setControl } from "../../services/reporting/controls";
import { lifecycleState } from "../../services/reporting/coordinator/draft-commit";
import { reportingText } from "../../services/reporting/copy";
import { loadDraft } from "../../services/reporting/drafts";
import { decryptConversationChat } from "../../services/reporting/identity-store";
import { openPrompt } from "../../services/reporting/prompts";
import { QUESTION_PROFILES, type QuestionProfile } from "../../services/reporting/questions";
import { TestBrowser } from "./support/browser";
import { planting, snapshot, TAS } from "./support/fixtures";
import { adaAccount, latestLink } from "./support/flows";
import { shadedPhoto } from "./support/media";
import { ADA, BOLA, Harness, type Person } from "./support/harness";

/**
 * Reference conversations with every model off, in English, Spanish and Portuguese, checked by
 * what the report holds after each turn: which fields were taken and which are still missing,
 * which question is open, and whether an earlier confirmation still stands. Wording is asserted
 * only where the wording is the point.
 */
let harness: Harness;

beforeEach(() => {
  harness = new Harness();
  harness.catalog.actions.set(TAS.key, [snapshot(plantingEvent), snapshot(milestone)]);
});

afterEach(() => {
  harness.close();
});

const number = (key: string, title: string) => ({
  key,
  title,
  placeholder: "",
  type: "number" as const,
  required: true,
  options: [],
});

const plantingEvent: ActionDefinition = {
  ...planting(),
  actionUID: 21,
  slug: "agro.planting_event",
  title: "Planting Event",
  inputs: [
    number("seedlingsPlanted", "Seedlings planted"),
    number("participants", "Participants"),
    {
      key: "speciesTags",
      title: "Species",
      placeholder: "",
      type: "multi-select",
      required: true,
      options: ["Baobab", "Neem", "Moringa", "Fruit tree", "Native hardwood"],
    },
  ],
};

const milestone: ActionDefinition = {
  ...planting(),
  actionUID: 22,
  slug: "solar.install_milestone",
  title: "Infrastructure Milestone",
  inputs: [
    {
      ...number("milestoneValue", "Milestone Value"),
      placeholder: "Enter the numeric value for this milestone",
    },
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

const WORDS = {
  en: {
    story: "We planted 40 seedlings with 6 volunteers. It took 2 hours.",
    plain: "We worked in the garden today",
    several: "40 seedlings, 6 people, 2 hours",
    unread: "40 seedlings, 6 people, 2 hours and 4 buckets",
    hello: "hello",
    kids: "6 kids",
    correction: "Actually it was 45 seedlings, not 40.",
    species: "Which species did you plant?",
    kind: "What did you install or finish?",
    solar: "How much solar capacity did you install, in kW?",
    summary: "Please check your report",
  },
  es: {
    story: "Plantamos 40 plántulas con 6 voluntarios. Tardamos 2 horas.",
    plain: "Hoy trabajamos en el jardín",
    several: "40 plántulas, 6 personas, 2 horas",
    unread: "40 plántulas, 6 personas, 2 horas y 4 cubos",
    hello: "hola",
    kids: "6 niños",
    correction: "En realidad fueron 45 plántulas, no 40.",
    species: "¿Qué especies plantaste?",
    kind: "¿Qué instalaste o terminaste?",
    solar: "¿Qué potencia solar instalaste, en kW?",
    summary: "Revisa tu reporte",
  },
  pt: {
    story: "Plantamos 40 mudas com 6 voluntários. Levou 2 horas.",
    plain: "Hoje trabalhamos no jardim",
    several: "40 mudas, 6 pessoas, 2 horas",
    unread: "40 mudas, 6 pessoas, 2 horas e 4 baldes",
    hello: "olá",
    kids: "6 crianças",
    correction: "Na verdade foram 45 mudas, não 40.",
    species: "Quais espécies você plantou?",
    kind: "O que você instalou ou concluiu?",
    solar: "Qual foi a potência solar instalada, em kW?",
    summary: "Confira seu relato",
  },
} as const;

type Locale = keyof typeof WORDS;
const LOCALES = Object.keys(WORDS) as Locale[];

const speaker = (locale: Locale): Person => ({ ...ADA, locale });

/** The conversation a person's chat is, as the store names it. */
function conversationOf(person: Person): string {
  const rows = harness.core.db.query("SELECT id FROM conversations").all() as Array<{ id: string }>;
  return (
    rows.find(({ id }) => decryptConversationChat(harness.core, id)?.chatId === person.chatId)
      ?.id ?? ""
  );
}

/** What a person's newest report holds, and the question their conversation has open. */
function reportOf(person: Person) {
  const row = harness.core.db
    .query(
      `SELECT id FROM work_drafts WHERE conversation_id = $conversation
       ORDER BY created_at DESC, rowid DESC LIMIT 1`
    )
    .get({ conversation: conversationOf(person) }) as { id: string } | null;
  const draft = row ? loadDraft(harness.core, row.id) : null;
  if (!draft) throw new Error("No report was started");
  const prompt = openPrompt(harness.core, draft.conversationId);
  return {
    details: draft.content.details,
    minutes: draft.content.timeSpentMinutes,
    photos: draft.content.evidence.length,
    revision: draft.revision,
    state: lifecycleState(draft),
    stated: Object.entries(draft.content.provenance)
      .filter(([, read]) => read?.gardenerStated)
      .map(([field]) => field)
      .sort(),
    question: prompt ? `${prompt.kind}${prompt.fieldKey ? `:${prompt.fieldKey}` : ""}` : null,
    token: prompt?.token ?? null,
  };
}

/** The same for the one person most of these conversations have. */
const report = () => reportOf(ADA);

/** Sends the opening message, agrees to the notice, and picks TAS and then the activity. */
async function begin(
  locale: Locale,
  opening: string,
  activity: ActionDefinition = plantingEvent
): Promise<string[]> {
  const person = speaker(locale);
  await harness.say(person, opening);
  await harness.press(person, reportingText(locale, "consent.agree"));
  await harness.say(person, "1");
  return harness.say(person, activity.title);
}

describe.each(LOCALES)("reporting with models off, in %s", (locale) => {
  const words = WORDS[locale];
  const person = speaker(locale);

  it("takes what the story already said, and asks only for what it did not", async () => {
    const replies = await begin(locale, words.story);

    expect(report()).toMatchObject({
      details: { seedlingsPlanted: 40, participants: 6 },
      minutes: 120,
      question: "field:speciesTags",
    });
    // The story's own facts are the gardener's: nothing later may replace them silently.
    expect(report().stated).toEqual(
      expect.arrayContaining([
        "details.participants",
        "details.seedlingsPlanted",
        "timeSpentMinutes",
      ])
    );
    // One reply: what was taken, then the one question left, in the activity's reviewed words.
    expect(replies).toHaveLength(1);
    expect(replies[0]).toContain(words.species);
    expect(replies[0]).toMatch(/40[\s\S]*6[\s\S]*2 h/u);

    await harness.say(person, "1");
    expect(report()).toMatchObject({ question: "confirm_report", state: "review" });
  });

  it("accepts several facts in one answer and says only what it took", async () => {
    const asked = await begin(locale, words.plain);
    // The count and the species are asked together, in one question.
    expect(report().question).toBe("fields:seedlingsPlanted,speciesTags");
    expect(asked[0]).toContain(reportingText(locale, "question.seedlingsAndSpecies"));

    // A number that names nothing the activity asks for may change what the rest means, so the
    // answer is not read at all and the question is put again.
    await harness.say(person, words.unread);
    expect(report()).toMatchObject({
      details: {},
      question: "fields:seedlingsPlanted,speciesTags",
    });

    const [reply, ...more] = await harness.say(person, words.several);
    expect(more).toEqual([]);
    expect(report()).toMatchObject({
      details: { seedlingsPlanted: 40, participants: 6 },
      minutes: 120,
      question: "field:speciesTags",
    });
    // What it took is read back before the next question.
    expect(reply).toMatch(/40[^]*6[^]*2/u);
  });

  it("asks again when a count comes with a word the field does not name", async () => {
    await begin(locale, words.plain);
    await harness.say(person, "40 fruit trees");
    expect(report().question).toBe("field:participants");
    // "6 kids" may count the children alone, so it is not taken as the participants.
    await harness.say(person, words.kids);
    expect(report()).toMatchObject({ question: "field:participants" });
    expect(report().details.participants).toBeUndefined();
  });

  it("takes both halves of a paired question from one answer, or one and asks the other", async () => {
    await begin(locale, words.plain);
    // A choice of more than one word, as the published species are.
    await harness.say(person, "40 fruit trees");
    expect(report()).toMatchObject({
      details: { seedlingsPlanted: 40, speciesTags: ["Fruit tree"] },
      question: "field:participants",
    });

    await harness.say(person, "CANCEL");
    await harness.say(person, words.plain);
    await harness.say(person, "1");
    await harness.say(person, plantingEvent.title);
    await harness.say(person, "40");
    await harness.say(person, "6");
    // The count was given alone: the species is asked on its own, with its choices.
    expect(report()).toMatchObject({
      details: { seedlingsPlanted: 40, participants: 6 },
      question: "field:speciesTags",
    });
  });

  it("answers a hello without losing or changing anything, and asks its question again", async () => {
    await begin(locale, words.plain);
    await harness.say(person, "40");
    const before = report();

    const replies = await harness.say(person, words.hello);
    expect(replies.at(-1)).toContain("?");
    expect(report()).toEqual({ ...before, token: expect.any(String) });
  });

  it("applies a typed correction and stops the earlier summary from confirming", async () => {
    await begin(locale, words.story);
    await harness.say(person, "1");
    const shown = report();

    const replies = await harness.say(person, words.correction);
    const corrected = report();
    expect(corrected.details.seedlingsPlanted).toBe(45);
    expect(corrected.revision).toBeGreaterThan(shown.revision);
    expect(corrected.question).toBe("confirm_report");
    expect(corrected.token).not.toBe(shown.token);
    // The change is read back with the value it replaced, ahead of the new summary.
    expect(replies).toHaveLength(1);
    expect(replies[0]).toMatch(/45[\s\S]*40[\s\S]*/u);
    expect(replies[0]).toContain(words.summary);

    // Saying the same value again changes nothing, so the summary that shows it still stands.
    await harness.say(person, words.correction);
    expect(report()).toMatchObject({ revision: corrected.revision, token: corrected.token });

    // The code from the summary that showed 40 confirms nothing now.
    await harness.say(person, `CONFIRM ${shown.token}`);
    expect(report()).toMatchObject({ state: "review", revision: corrected.revision });
  });

  it("asks a milestone for what was installed first, then for its amount in that unit", async () => {
    const adopted = await begin(locale, words.plain, milestone);
    expect(report().question).toBe("field:milestoneType");
    expect(adopted[0]).toContain(words.kind);

    const [asked] = await harness.say(person, "1");
    expect(asked).toContain(words.solar);
    // An amount in another unit is asked again, not converted and not kept.
    await harness.say(person, "5 kWh");
    expect(report().details.milestoneValue).toBeUndefined();
    await harness.say(person, "5 kW");
    expect(report().details).toEqual({ milestoneType: "Solar kW installed", milestoneValue: 5 });

    // Saying the held value again from the edit menu changes nothing and asks nothing.
    await harness.say(person, "EDIT");
    await harness.say(person, "6");
    const [again] = await harness.say(person, "5 kW");
    expect(again).not.toContain("number");
    expect(report().details).toEqual({ milestoneType: "Solar kW installed", milestoneValue: 5 });

    // Changing what was installed takes out the amount in the old unit, so it is asked again.
    await harness.say(person, "EDIT");
    await harness.say(person, "7");
    await harness.say(person, "2");
    expect(report()).toMatchObject({
      details: { milestoneType: "Battery kWh added" },
      question: "field:milestoneValue",
    });
  });
});

const ASIDES = {
  en: {
    login: "I would like to log in",
    mine: "which one is mine?",
    caption: "We planted 40 seedlings",
  },
  es: {
    login: "quiero iniciar sesión",
    mine: "¿cuál es el mío?",
    caption: "Plantamos 40 plántulas",
  },
  pt: { login: "quero fazer login", mine: "qual é o meu?", caption: "Plantamos 40 mudas" },
} as const;

const drafts = () =>
  harness.core.db.query("SELECT count(*) AS n FROM work_drafts").get() as { n: number };

describe.each(LOCALES)("interruptions and other people, in %s", (locale) => {
  const words = WORDS[locale];
  const asides = ASIDES[locale];
  const person = speaker(locale);
  const agree = reportingText(locale, "consent.agree");

  it("answers a hello without starting a report", async () => {
    await harness.say(person, words.hello);
    const replies = await harness.press(person, agree);

    expect(drafts()).toEqual({ n: 0 });
    // The first reply after agreeing invites the story; nothing asks for a garden yet.
    expect(replies.join("\n")).not.toContain(reportingText(locale, "report.askGarden"));
    expect(openPrompt(harness.core, conversationOf(person))?.kind).not.toBe("select_garden");
  });

  it("sends the link when someone asks to log in at the garden question, and keeps the report", async () => {
    await harness.say(person, words.plain);
    await harness.press(person, agree);
    const before = report();
    expect(before.question).toBe("select_garden");

    const replies = await harness.say(person, asides.login);
    expect(harness.transport.sent.at(-replies.length)?.message.link?.url).toContain("https://");
    expect(report()).toMatchObject({ revision: before.revision, details: {}, state: "collecting" });
    // The report is still there to carry on with: the garden can be picked next.
    await harness.say(person, "1");
    expect(report().question).not.toBe("select_garden");
  });

  it("explains the garden question when asked which garden is theirs, and asks it again", async () => {
    await harness.say(person, words.plain);
    await harness.press(person, agree);
    const before = report();

    const replies = await harness.say(person, asides.mine);
    expect(replies).toHaveLength(2);
    expect(replies[0]).toBe(reportingText(locale, "report.explainGardenUnlinked"));
    expect(replies[1]).toContain(reportingText(locale, "report.askGarden"));
    expect(report()).toMatchObject({ revision: before.revision, question: "select_garden" });
  });

  it("takes a photo sent with no words, then the story that follows it", async () => {
    harness.mediaFiles.set("photo-1", await shadedPhoto(1));
    await harness.say(person, "", {
      text: undefined,
      media: [{ providerMediaId: "photo-1", declaredMime: "image/jpeg" }],
    });
    const replies = await harness.press(person, agree);
    expect(replies.join("\n")).toContain(reportingText(locale, "media.photoAdded"));
    expect(report()).toMatchObject({ photos: 1, details: {}, question: "select_garden" });

    await harness.say(person, "1");
    await harness.say(person, plantingEvent.title);
    await harness.say(person, asides.caption);
    // The photo proves nothing by itself: the count came from the words, and the photo stays.
    expect(report()).toMatchObject({ photos: 1, details: { seedlingsPlanted: 40 } });
  });

  it("keeps the report when the chat switches account, and unlinks the one it had", async () => {
    harness.chain.grantRole(TAS.address, adaAccount.address, { gardener: true });
    await begin(locale, words.plain);
    await harness.say(person, "40");
    await harness.say(person, "CONNECT");
    const browser = new TestBrowser(harness.app);
    await browser.open(latestLink(harness));
    const proof = await browser.prove(adaAccount);
    await harness.say(person, `PAIR ${proof.body.pairingCode}`);
    const linked = report();
    const active = () =>
      harness.core.db
        .query("SELECT count(*) AS n FROM account_bindings WHERE status = 'active'")
        .get() as { n: number };
    expect(active()).toEqual({ n: 1 });

    const replies = await harness.say(person, "SWITCH");
    expect(replies[0]).toContain(adaAccount.address.toLowerCase());
    expect(active()).toEqual({ n: 0 });
    // The unfinished report is saved as it was, for whichever account is linked next.
    expect(report()).toMatchObject({ details: linked.details, state: "collecting" });
  });

  it("keeps two people's reports apart when they report at the same time", async () => {
    const other: Person = { ...BOLA, locale };
    await harness.say(person, words.story);
    await harness.say(other, words.plain);
    await harness.press(person, agree);
    await harness.press(other, agree);
    await harness.say(person, "1");
    await harness.say(other, "1");
    await harness.say(person, plantingEvent.title);
    await harness.say(other, plantingEvent.title);

    expect(reportOf(person)).toMatchObject({
      details: { seedlingsPlanted: 40, participants: 6 },
      question: "field:speciesTags",
    });
    // The other chat's report holds none of it, and still waits at its own first question.
    expect(reportOf(other)).toMatchObject({
      details: {},
      minutes: null,
      question: "fields:seedlingsPlanted,speciesTags",
    });
  });
});

describe("what a profile decides, and what it leaves alone", () => {
  it("asks a completion milestone for a count, and takes only a whole number", async () => {
    await begin("en", "We finished the retrofits at the clinic today", milestone);
    const [asked] = await harness.say(ADA, "Retrofit completed");
    expect(asked).toContain("How many retrofits did you finish?");
    expect(asked).not.toMatch(/kW|Mbps/u);

    expect(await harness.say(ADA, "0.5")).toEqual([
      "Please reply with a whole number of one or more, for example 2.",
    ]);
    expect(report().details).toEqual({ milestoneType: "Retrofit completed" });
    await harness.say(ADA, "2");
    expect(report().details).toEqual({ milestoneType: "Retrofit completed", milestoneValue: 2 });
  });

  it("asks a milestone's amount again when a model gave it before the type", async () => {
    setControl(harness.core, "model_processing", true, {
      actor: "test",
      reason: "dependent value",
    });
    await begin("en", "We worked on the hub today", milestone);
    expect(report().question).toBe("field:milestoneType");
    // A model reads an amount from words that pick no type.
    harness.interpreter.responses = [
      {
        intent: "report_content",
        gardenKey: null,
        actionUID: null,
        facts: [
          { field: "details.milestoneValue", value: 10, kind: "reported", original: "ten units" },
        ],
        models: ["fixture-model"],
      },
    ];
    await harness.say(ADA, "it was ten units");
    expect(report().details.milestoneValue).toBe(10);
    // Choosing the type gives the number a unit it was never given in, so it is asked again.
    await harness.say(ADA, "1");
    expect(report()).toMatchObject({
      details: { milestoneType: "Solar kW installed" },
      question: "field:milestoneValue",
    });
  });

  it("asks two related fields together when a profile says so, and the rest one at a time", async () => {
    harness.close();
    const together: QuestionProfile = {
      slug: "tree-planting",
      version: 1,
      fields: { seedlings: { type: "number" }, species: { type: "select" } },
      // No activity ships a pair yet, so the test borrows a question the catalog already has.
      groups: [{ fields: ["seedlings", "species"], ask: "report.askFeedback" }],
    };
    harness = new Harness({ questions: [together] });
    await harness.say(ADA, "We worked by the fence today");
    await harness.press(ADA, "I agree");
    await harness.say(ADA, "1");
    const adopted = await harness.press(ADA, "Tree planting");
    expect(adopted[0]).toContain(reportingText("en", "report.askFeedback"));
    expect(report().question).toBe("fields:seedlings,species");

    // One of the two is given: it is kept, and the other is asked alone.
    await harness.say(ADA, "12");
    expect(report()).toMatchObject({ details: { seedlings: 12 }, question: "field:species" });
  });

  it("keeps asking a report with the profile version it started with", async () => {
    await begin("en", "We worked in the garden today");
    expect(
      harness.core.db.query("SELECT question_profile AS pinned FROM work_drafts").get()
    ).toEqual({ pinned: "agro.planting_event@1" });

    // A newer version that asks the count on its own does not change a report already started.
    const [first] = QUESTION_PROFILES.filter((profile) => profile.slug === "agro.planting_event");
    if (!first) throw new Error("planting profile missing");
    Object.assign(harness.core, {
      questions: [...QUESTION_PROFILES, { ...first, version: 2, groups: [] }],
    });
    expect((await harness.say(ADA, "hello")).join("\n")).toContain(
      "How many seedlings did you plant, and which species?"
    );
    expect(report().question).toBe("fields:seedlingsPlanted,speciesTags");

    // A report from before profiles existed has none pinned, and is asked from the definition.
    harness.core.db.query("UPDATE work_drafts SET question_profile = NULL").run();
    const [asked] = await harness.say(ADA, "hello");
    expect(asked).not.toContain("How many seedlings did you plant?");
    expect((await harness.say(ADA, "STATUS")).length).toBeGreaterThan(0);
  });
});
