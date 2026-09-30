import { describe, expect, it } from "vitest";
import en from "../../i18n/en.json";
import es from "../../i18n/es.json";
import pt from "../../i18n/pt.json";

type LocaleCatalog = Record<string, string>;

const locales: Array<{ locale: string; messages: LocaleCatalog }> = [
  { locale: "en", messages: en },
  { locale: "es", messages: es },
  { locale: "pt", messages: pt },
];

// Copy read on one device that tells a gardener what to tap on another. The sign-in
// screen labels its username door by whether this browser already holds a passkey
// (views/Login/index.tsx), so on the other device it reads haveAccount, never
// recoverWithUsername. Naming the wrong one sends people to a link that isn't there.
const otherDeviceInstructions = [
  "app.identity.passkeyRecovery.device",
  "app.identity.passkeyRecovery.deviceGeneric",
  "app.profile.help.faq.accountRecovery.answer",
  "app.profile.help.faq.signingIn.answer",
];

describe("sign-in label references", () => {
  describe.each(locales)("$locale", ({ messages }) => {
    it.each(
      otherDeviceInstructions
    )("%s names the door a browser without a passkey shows", (id) => {
      expect(messages[id]).toContain(messages["app.login.button.haveAccount"]);
      expect(messages[id]).not.toContain(messages["app.login.button.recoverWithUsername"]);
    });
  });
});
