import { describe, expect, it } from "vitest";
import en from "../../i18n/en.json";
import es from "../../i18n/es.json";
import pt from "../../i18n/pt.json";

type LocaleCatalog = Record<string, string>;

/**
 * DL-196 (superseding DL-175): Offer and Request are the two kinds of promise, and nothing else
 * is called a request. Taking a promise up is Ask to Take Up and joining a garden is Ask to Join;
 * Ask is only a verb. Spanish says solicitud for what waits on a steward and Portuguese moves
 * every take-up and join line from pedido to solicitação; both keep pedido for the kind.
 *
 * Every claim and join message speaks of a take-up or a join, so this scans them all; the take-up
 * and join lines elsewhere are named.
 */
const TAKE_UP_AND_JOIN_LINES = [
  "app.commitment.act.askToTakeUp",
  "app.commitment.history.claimRequested",
  "app.commitment.history.claimDeclined",
  "app.compose.claimMode.APPROVAL_GATED.body",
  "app.home.attention.takeUp",
  "app.home.attention.joinRequests",
  "app.home.notifications.event.takeUpRequested",
  "app.home.notifications.event.joinRequested",
  "app.commitment.join.request",
  "app.commitment.join.serviceUnavailable",
  "app.voucher.rw.sh.consent",
  "hub.garden.pool.claims.paused",
  "hub.garden.pool.declineClaim.confirm",
  "hub.garden.pool.declineClaim.title",
  "hub.garden.pool.declineClaim.description",
];

const isTakeUpOrJoin = (key: string) =>
  key.startsWith("app.claim.") ||
  key.startsWith("app.garden.joinRequest.") ||
  key.startsWith("app.garden.joinQueue.") ||
  key.startsWith("hub.community.joinRequests.") ||
  TAKE_UP_AND_JOIN_LINES.includes(key);

const locales: Array<{ locale: string; messages: LocaleCatalog; retired: RegExp }> = [
  { locale: "en", messages: en, retired: /\brequest/i },
  { locale: "es", messages: es, retired: /\bpedid/i },
  { locale: "pt", messages: pt, retired: /\bpedid/i },
];

describe("taking a promise up and joining a garden are asked, not requested (DL-196)", () => {
  describe.each(locales)("$locale", ({ messages, retired }) => {
    it("never calls a take-up or a join by the retired word", () => {
      const lines = Object.keys(messages).filter(isTakeUpOrJoin);
      const offenders = lines
        .filter((key) => retired.test(messages[key]))
        .map((key) => `${key}: ${messages[key]}`);

      expect(lines).toEqual(expect.arrayContaining(TAKE_UP_AND_JOIN_LINES));
      expect(offenders).toEqual([]);
    });
  });

  it("names the acts Ask to Take Up, Ask to Join and Ask Again", () => {
    expect(
      [
        "app.commitment.act.askToTakeUp",
        "app.pool.group.act.askToTakeUpOne",
        "app.garden.joinRequest.action",
        "app.claim.askAgain",
      ].map((key) => en[key as keyof typeof en])
    ).toEqual(["Ask to Take Up", "Ask to Take Up One", "Ask to Join", "Ask Again"]);
    expect([es, pt].map((messages) => messages["app.claim.askAgain"])).toEqual([
      "Solicitar de nuevo",
      "Solicitar de novo",
    ]);
  });

  it("calls the kinds Offer and Request in English, never an ask", () => {
    expect(
      [
        "app.commitments.filter.requests",
        "app.commitments.row.request",
        "app.pool.create.open",
        "hub.garden.pool.promises.title",
        "hub.garden.pool.row.state.requested",
      ].map((key) => en[key as keyof typeof en])
    ).toEqual(["Requests", "Request", "Offer or Request", "Offers and Requests", "Requested"]);
    const askAsNoun = Object.entries(en as LocaleCatalog)
      .filter(
        ([key, value]) =>
          (key.startsWith("app.") || key.startsWith("hub.")) &&
          /\b(an|the|this|every|your|another|any) asks?\b/i.test(value)
      )
      .map(([key, value]) => `${key}: ${value}`);
    expect(askAsNoun).toEqual([]);
  });
});
