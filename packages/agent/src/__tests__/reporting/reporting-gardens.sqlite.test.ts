import sharp from "sharp";
import type { PrivateKeyAccount } from "viem/accounts";
import { afterEach, describe, expect, it } from "vitest";
import type { ReportingGarden } from "../../services/reporting/gardens";
import { TestBrowser } from "./support/browser";
import { AIYELOJA, TAS } from "./support/fixtures";
import { adaAccount, bolaAccount, latestLink } from "./support/flows";
import { ADA, BOLA, Harness, type Person } from "./support/harness";

/**
 * Which gardens a linked chat may report to: its account's own, read from the garden directory.
 * The fixture directory follows the fake chain's roles, so granting a role there is the account
 * joining a garden, and `gardens.unavailable` is the indexer being down.
 */
let harness: Harness;

afterEach(() => {
  harness.close();
});

const KENYA: ReportingGarden = {
  key: "kenya",
  chainId: 42161,
  address: "0x00000000000000000000000000000000000000a3",
  label: "Greenpill Kenya",
};
const STORY = "Today I planted twelve baobab seedlings by the fence";
const ada = adaAccount.address.toLowerCase();
const bola = bolaAccount.address.toLowerCase();
const BROWSER_HINT =
  "Open it in Safari or Chrome. If it opens inside the chat app, use that page's menu to open it in your browser, or copy the link.";
const ONLY_GARDEN =
  "is your only garden, so I'll use it for this report. Send GARDEN to change it, or JOIN to join another garden.";
const OWN_GARDENS =
  "Which of your gardens is this report for?\n1. TAS\n2. Aiyeloja Family Garden\n3. Join another garden";
const TAS_ACTIVITIES =
  "Which activity in TAS best matches your work?\n1. Tree planting\n2. Weeding";
const CANNOT_LOAD =
  "I can't load your gardens right now. That's a problem on my side, and your report is saved. Tap Try again or send any message.\n1. Try again";

const joins = (account: PrivateKeyAccount, ...gardens: ReportingGarden[]) => {
  for (const garden of gardens)
    harness.chain.grantRole(garden.address, account.address, { gardener: true });
};

/** Proves an account on the latest link and sends its code from the chat. */
async function pair(account: PrivateKeyAccount, person: Person = ADA): Promise<string[]> {
  const browser = new TestBrowser(harness.app);
  await browser.open(latestLink(harness));
  const proof = await browser.prove(account);
  return harness.say(person, String(proof.body.pairingCode));
}

/** Sends a small photo with no words. */
async function sendPhoto(person: Person, id: string): Promise<string[]> {
  const photo = await sharp({
    create: { width: 64, height: 48, channels: 3, background: "#2d6a4f" },
  })
    .jpeg()
    .toBuffer();
  harness.mediaFiles.set(id, new Uint8Array(photo));
  const media = [{ providerMediaId: id, declaredMime: "image/jpeg" }];
  return harness.say(person, "", { text: undefined, media });
}

/** Opens the chat, agrees to processing and links an account before any report. */
async function linked(account = adaAccount, person: Person = ADA): Promise<void> {
  await harness.say(person, "START");
  await harness.say(person, "yes");
  await harness.say(person, "CONNECT");
  await pair(account, person);
}

describe("a linked account's reporting gardens", () => {
  it("sends an account with no garden to join one, and takes the garden once it has", async () => {
    harness = new Harness({ settings: { communityGarden: TAS.address } });
    await linked();
    const join = `I don't see ${ada} in a garden yet, so there's nowhere to send this report. It's saved.\n\nJoin the Community Garden below, or ask a steward of your garden to add this account. A garden you just joined can take a few minutes to show here.\n1. Check again\n\n${BROWSER_HINT}`;
    expect(await harness.say(ADA, STORY)).toEqual([join]);
    const { link, copy } = harness.transport.last().message;
    expect(link?.label).toBe("Join the Community Garden");
    expect(copy?.text).toBe(ada);
    // Every garden's name is known to the directory, but one outside the account's own is no answer.
    expect(await harness.say(ADA, "TAS")).toEqual([join]);

    joins(adaAccount, TAS);
    expect(await harness.press(ADA, "Check again")).toEqual([`TAS ${ONLY_GARDEN}`, TAS_ACTIVITIES]);
  });

  it("takes a sole garden without asking, with changing it and joining another one word away", async () => {
    harness = new Harness();
    joins(adaAccount, AIYELOJA);
    await linked();
    expect(await harness.say(ADA, STORY)).toEqual([
      `Aiyeloja Family Garden ${ONLY_GARDEN}`,
      "Got it: Tree planting at Aiyeloja Family Garden. 3 quick questions, then a summary to check.",
      "1 of 3 · Seedlings planted? Send just the number (seedlings).",
    ]);

    expect(await harness.say(ADA, "GARDEN")).toEqual([
      "Which of your gardens is this report for?\n1. Aiyeloja Family Garden\n2. Join another garden",
    ]);
    // Choosing the garden it already has keeps the activity, and the report goes on where it was.
    expect(await harness.say(ADA, "1")).toEqual([
      "1 of 3 · Seedlings planted? Send just the number (seedlings).",
    ]);
    // No garden is open to join from the chat here, so another one takes a steward.
    const askSteward = `Your account ${ada} can report to the gardens it's in. To add one, ask a steward of that garden to add this account. It can take a few minutes to show here once they do.\n1. Show my gardens`;
    expect(await harness.say(ADA, "JOIN")).toEqual([askSteward]);
    joins(adaAccount, TAS);
    // On a numbered list, a choice typed out in its own words is picked like any other.
    expect(await harness.say(ADA, "show my gardens")).toEqual([OWN_GARDENS]);
    expect(await harness.say(ADA, "Join another garden")).toEqual([askSteward]);
    expect(await harness.press(ADA, "Show my gardens")).toEqual([OWN_GARDENS]);
    // Another garden has its own activities, so the activity is asked again.
    expect(await harness.say(ADA, "1")).toEqual([TAS_ACTIVITIES]);
  });

  it("offers several gardens as the only choices, to the person and to a model", async () => {
    harness = new Harness({
      gardens: [TAS, AIYELOJA, KENYA],
      controls: { model_processing: true },
    });
    joins(adaAccount, TAS, AIYELOJA);
    await linked();
    harness.interpreter.responses = [
      {
        intent: "report_content",
        gardenKey: KENYA.key,
        actionUID: null,
        facts: [],
        models: ["fixture-model"],
      },
    ];
    // The model names a garden the account is not in: it was never offered, and is not taken.
    expect(await harness.say(ADA, STORY)).toEqual([OWN_GARDENS]);
    expect(harness.interpreter.requests.at(-1)?.gardens.map((garden) => garden.label)).toEqual([
      "TAS",
      "Aiyeloja Family Garden",
    ]);
    expect(await harness.say(ADA, "Greenpill Kenya")).toEqual([
      "These are the gardens your account is in. Pick the one where you did this work, or join another garden.",
      OWN_GARDENS,
    ]);
    expect((await harness.say(ADA, "Aiyeloja Family Garden"))[0]).toContain(
      "Which activity in Aiyeloja Family Garden"
    );
  });

  it("says it cannot load an account's gardens, and never reads that as an account with none", async () => {
    harness = new Harness({ settings: { communityGarden: TAS.address } });
    joins(bolaAccount, TAS);
    await linked();
    await linked(bolaAccount, BOLA);
    harness.gardens.unavailable = true;
    // The last good read placed Ada in no garden. Neither the invitation to join nor the list of
    // every garden stands in for the read that failed.
    expect(await harness.say(ADA, STORY)).toEqual([CANNOT_LOAD]);
    expect(await harness.say(ADA, "TAS")).toEqual([CANNOT_LOAD]);
    expect(harness.transport.last().message.link).toBeUndefined();
    expect(await harness.say(ADA, "CONNECT")).toEqual([
      `This chat is connected to ${ada}.\nI can't load your gardens right now.\nTo use a different account, send SWITCH.`,
    ]);
    // It placed Bola in TAS, and that still counts while the indexer is down.
    expect(await harness.say(BOLA, STORY)).toEqual([`TAS ${ONLY_GARDEN}`, TAS_ACTIVITIES]);

    // A steward adds Ada to TAS and the indexer comes back. A failed read is left alone for half
    // a minute, but never by the person asking: Try again reads at once, even tapped on the
    // question's first copy.
    joins(adaAccount, TAS);
    harness.gardens.unavailable = false;
    const first = harness.transport.sent
      .flatMap((sent) => sent.message.choices ?? [])
      .find((choice) => choice.label === "Try again");
    expect(await harness.say(ADA, "Try again", { replyId: first?.id })).toEqual([
      `TAS ${ONLY_GARDEN}`,
      TAS_ACTIVITIES,
    ]);
  });

  it("holds a report at the garden question when its new account's gardens cannot be read", async () => {
    harness = new Harness();
    await harness.say(ADA, "START");
    await harness.say(ADA, "yes");
    await harness.say(ADA, STORY);
    expect(await harness.say(ADA, "1")).toEqual([TAS_ACTIVITIES]);
    await harness.say(ADA, "CONNECT");
    // The indexer is down when Ada links, so the garden her report names cannot be checked
    // against hers. The activity question gives way to the garden question, which says so.
    harness.gardens.unavailable = true;
    expect(await pair(adaAccount)).toEqual([`Your account ${ada} is now linked.`, CANNOT_LOAD]);
    // A steward has added her to TAS by the time it is back, and the report carries on from her
    // gardens.
    joins(adaAccount, TAS);
    harness.gardens.unavailable = false;
    expect(await harness.press(ADA, "Try again")).toEqual([
      "Which of your gardens is this report for?\n1. TAS\n2. Join another garden",
    ]);
    expect(await harness.say(ADA, "1")).toEqual([TAS_ACTIVITIES]);
  });

  it("asks again within the next account's gardens after a switch, dropping a garden it is not in", async () => {
    harness = new Harness({ gardens: [TAS, AIYELOJA, KENYA] });
    harness.catalog.actions.set(KENYA.key, harness.catalog.actions.get(TAS.key) ?? []);
    joins(adaAccount, TAS, KENYA);
    joins(bolaAccount, AIYELOJA, KENYA);
    await linked();
    const gardensOf = (...names: string[]) =>
      `Which of your gardens is this report for?\n1. ${names[0]}\n2. ${names[1]}\n3. Join another garden`;
    expect(await harness.say(ADA, STORY)).toEqual([gardensOf("TAS", "Greenpill Kenya")]);

    // The open question listed Ada's gardens; the next account is asked within its own.
    expect((await harness.say(ADA, "SWITCH"))[0]).toContain(`no longer connected to ${ada}`);
    expect(await pair(bolaAccount)).toEqual([
      `Your account ${bola} is now linked.`,
      gardensOf("Aiyeloja Family Garden", "Greenpill Kenya"),
    ]);
    expect((await harness.say(ADA, "1"))[0]).toContain("Which activity in Aiyeloja Family Garden");

    // Ada is not in the garden Bola chose, so back under her account it comes off the report.
    await harness.say(ADA, "SWITCH");
    expect(await pair(adaAccount)).toEqual([
      `Your account ${ada} is now linked.`,
      "This account isn't in Aiyeloja Family Garden, so your report needs another garden.",
      gardensOf("TAS", "Greenpill Kenya"),
    ]);

    // Both accounts are in Greenpill Kenya, so it stays, and so does the question that was open.
    await harness.say(ADA, "2");
    await harness.say(ADA, "SWITCH");
    expect(await pair(bolaAccount)).toEqual([`Your account ${bola} is now linked.`]);
    expect((await harness.press(ADA, "Weeding"))[0]).toMatch(
      /^Got it: Weeding at Greenpill Kenya\./
    );
  });

  it("takes the sole garden for a photo sent on its own, and says so once", async () => {
    harness = new Harness();
    joins(adaAccount, TAS);
    await linked();
    expect(await sendPhoto(ADA, "photo-1")).toEqual([
      `TAS ${ONLY_GARDEN}`,
      "Photo added to your report.",
      TAS_ACTIVITIES,
    ]);
  });

  it("reads the garden list again before an account's gardens are shown or used", async () => {
    harness = new Harness();
    harness.gardens.cached = true;
    joins(adaAccount, AIYELOJA);
    await linked();
    await harness.say(ADA, STORY);
    // A steward adds Ada to TAS. The list was read a moment ago, so that read still serves.
    joins(adaAccount, TAS);
    await harness.say(ADA, "EDIT");
    expect((await harness.press(ADA, "Garden"))[0]).not.toContain("TAS");
    // Ten seconds on it is read again, here for an answer about a report that has its garden.
    await harness.say(ADA, "EDIT");
    harness.clock.advance(10_000);
    expect(await harness.press(ADA, "Garden")).toEqual([OWN_GARDENS]);

    // A file can be processed long after the turn that brought it: Bola's photo fails to
    // download, Bola is added to TAS, and the retry must not find Bola in no garden.
    await linked(bolaAccount, BOLA);
    harness.mediaFailures.remaining = 1;
    expect(await sendPhoto(BOLA, "photo-2")).toEqual([]);
    joins(bolaAccount, TAS);
    harness.clock.advance(20_000);
    const sent = harness.transport.sent.length;
    await harness.drain();
    expect(harness.transport.texts().slice(sent)).toEqual([
      `TAS ${ONLY_GARDEN}`,
      "Photo added to your report.",
      TAS_ACTIVITIES,
    ]);
  });

  it("answers HELP and STOP without waiting on the garden list or a garden's activities", async () => {
    harness = new Harness();
    joins(adaAccount, TAS);
    await linked();
    // Long enough on that a turn which uses the account's gardens would read the list again.
    harness.clock.advance(60_000);
    const before = { list: harness.gardens.reads, activities: harness.catalog.calls };
    expect((await harness.say(ADA, "HELP"))[0]).toContain("Green Goods reporting:");
    expect((await harness.say(ADA, "STOP"))[0]).toContain("You've stopped the assistant.");
    expect({ list: harness.gardens.reads, activities: harness.catalog.calls }).toEqual(before);
  });

  it("still reads the account's role from the chain before publishing to a garden it was offered", async () => {
    harness = new Harness();
    joins(adaAccount, TAS);
    await linked();
    await harness.say(ADA, STORY);
    // The report has its garden. Nothing it asks from here waits on the garden list, however old
    // that has become, and neither does Confirm.
    harness.clock.advance(60_000);
    const reads = harness.gardens.reads;
    await harness.press(ADA, "Tree planting");
    await harness.say(ADA, "12");
    await harness.say(ADA, "2");
    await harness.say(ADA, "3 hours");
    // The role is gone by the time the report is confirmed. Having been offered the garden, and
    // even having had it chosen for the report, is no authority to publish there.
    harness.chain.grantRole(TAS.address, adaAccount.address, {});
    // A tap carries no words; sent with its label, Confirm would be read as the command.
    const confirm = harness.transport
      .last()
      .message.choices?.find((choice) => choice.label === "Confirm");
    const reply = await harness.say(ADA, "", { text: undefined, replyId: confirm?.id });
    expect(harness.gardens.reads).toBe(reads);
    expect(reply.join("\n")).toContain("Your account isn't a gardener in TAS");
    expect(harness.core.db.query("SELECT count(*) AS n FROM execution_operations").get()).toEqual({
      n: 0,
    });
  });

  it.each([
    {
      locale: "es",
      join: `Aún no veo ${ada} en ningún huerto, así que no hay adónde enviar este reporte. Está guardado.\n\nÚnete al Huerto Comunitario aquí abajo, o pide a un administrador de tu huerto que agregue esta cuenta. Un huerto al que acabas de unirte puede tardar unos minutos en aparecer aquí.\n1. Revisar de nuevo`,
      again: "Revisar de nuevo",
      taken:
        "Aiyeloja Family Garden es tu único huerto, así que lo usaré para este reporte. Envía GARDEN para cambiarlo, o JOIN para unirte a otro huerto.",
      own: "¿Para cuál de tus huertos es este reporte?\n1. TAS\n2. Aiyeloja Family Garden\n3. Unirse a otro huerto",
      failed:
        "No puedo cargar tus huertos en este momento. Es un problema de mi lado y tu reporte está guardado. Toca Intentar de nuevo o envía cualquier mensaje.\n1. Intentar de nuevo",
      retry: "Intentar de nuevo",
    },
    {
      locale: "pt",
      join: `Ainda não vejo ${ada} em nenhuma horta, então não há para onde enviar este relato. Ele está guardado.\n\nEntre no Jardim Comunitário aqui abaixo, ou peça a um responsável pela sua horta para adicionar esta conta. Uma horta em que você acabou de entrar pode levar alguns minutos para aparecer aqui.\n1. Verificar de novo`,
      again: "Verificar de novo",
      taken:
        "Aiyeloja Family Garden é a sua única horta, então vou usá-la para este relato. Envie GARDEN para trocar, ou JOIN para entrar em outra horta.",
      own: "Para qual das suas hortas é este relato?\n1. TAS\n2. Aiyeloja Family Garden\n3. Entrar em outra horta",
      failed:
        "Não consigo carregar suas hortas agora. O problema é do meu lado e seu relato está guardado. Toque em Tentar de novo ou envie qualquer mensagem.\n1. Tentar de novo",
      retry: "Tentar de novo",
    },
  ])("answers in $locale for no garden, a failed read, one garden and several", async (copy) => {
    harness = new Harness({ settings: { communityGarden: TAS.address } });
    const person: Person = { ...ADA, locale: copy.locale };
    await linked(adaAccount, person);
    expect((await harness.say(person, STORY))[0]?.startsWith(copy.join)).toBe(true);
    harness.gardens.unavailable = true;
    expect(await harness.press(person, copy.again)).toEqual([copy.failed]);

    // Typed out, the one choice is an answer in each language, never a command word.
    joins(adaAccount, AIYELOJA);
    harness.gardens.unavailable = false;
    expect((await harness.say(person, copy.retry))[0]).toBe(copy.taken);
    joins(adaAccount, TAS);
    expect(await harness.say(person, "GARDEN")).toEqual([copy.own]);
  });
});
