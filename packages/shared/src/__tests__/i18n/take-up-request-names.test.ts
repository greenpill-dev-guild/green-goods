import { describe, expect, it } from "vitest";
import en from "../../i18n/en.json";
import es from "../../i18n/es.json";
import pt from "../../i18n/pt.json";

type LocaleCatalog = Record<string, string>;

/**
 * DL-175: an ask is a kind of promise, and "request" names only what waits on a steward's yes.
 * A take-up request is one, so the words for it are request in English and solicitar or
 * solicitud (solicitação) in Spanish and Portuguese, never ask, pedir or pedido.
 *
 * Every claim message speaks of a take-up request, so this scans them all; the take-up
 * request's lines elsewhere are named.
 */
const TAKE_UP_REQUEST_LINES = [
  "app.commitment.act.askToTakeUp",
  "app.commitment.history.claimRequested",
  "app.commitment.history.claimDeclined",
  "app.compose.claimMode.APPROVAL_GATED.body",
  "app.home.attention.takeUp",
  "app.home.notifications.event.takeUpRequested",
];

const locales: Array<{ locale: string; messages: LocaleCatalog; asked: RegExp }> = [
  { locale: "en", messages: en, asked: /\bask/i },
  { locale: "es", messages: es, asked: /\bp[ei]d[ií]/i },
  { locale: "pt", messages: pt, asked: /\bp[ei]d[ie]/i },
];

describe("a take-up request is called a request (DL-175)", () => {
  describe.each(locales)("$locale", ({ messages, asked }) => {
    it("never calls it an ask", () => {
      const lines = Object.keys(messages).filter(
        (key) => key.startsWith("app.claim.") || TAKE_UP_REQUEST_LINES.includes(key)
      );
      const offenders = lines
        .filter((key) => asked.test(messages[key]))
        .map((key) => `${key}: ${messages[key]}`);

      expect(lines).toEqual(expect.arrayContaining(TAKE_UP_REQUEST_LINES));
      expect(offenders).toEqual([]);
    });
  });

  it("offers a declined request again as Request Again", () => {
    expect([en, es, pt].map((messages) => messages["app.claim.askAgain"])).toEqual([
      "Request Again",
      "Solicitar de nuevo",
      "Solicitar de novo",
    ]);
  });
});
