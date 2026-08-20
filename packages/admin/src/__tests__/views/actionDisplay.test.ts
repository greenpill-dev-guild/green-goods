import type { Action } from "@green-goods/shared";
import esMessages from "@green-goods/shared/i18n/es.json";
import ptMessages from "@green-goods/shared/i18n/pt.json";
import type { IntlShape } from "react-intl";
import { describe, expect, it } from "vitest";
import actionsConfig from "../../../../contracts/config/actions.json";
import { localizeActionForDisplay } from "@/views/Hub/actionDisplay";

function createIntl(locale: "es" | "pt", messages: Record<string, string>) {
  const formatMessage = ((descriptor: { id: string; defaultMessage?: string }) =>
    messages[descriptor.id] ??
    descriptor.defaultMessage ??
    descriptor.id) as IntlShape["formatMessage"];
  return { locale, formatMessage };
}

const canonicalActions = actionsConfig.actions as unknown as Action[];

describe("actionDisplay", () => {
  it("localizes every deployed canonical action title and description", () => {
    expect(canonicalActions).toHaveLength(23);

    for (const action of canonicalActions) {
      const spanish = localizeActionForDisplay(action, createIntl("es", esMessages));
      const portuguese = localizeActionForDisplay(action, createIntl("pt", ptMessages));

      expect(spanish.title, `${action.slug} Spanish title`).not.toBe(action.title);
      expect(spanish.description, `${action.slug} Spanish description`).not.toBe(
        action.description
      );
      expect(portuguese.title, `${action.slug} Portuguese title`).not.toBe(action.title);
      expect(portuguese.description, `${action.slug} Portuguese description`).not.toBe(
        action.description
      );
    }
  });

  it("preserves custom copy even when an action reuses a canonical slug", () => {
    const source = canonicalActions[0];
    const custom = {
      ...source,
      title: "Community-owned solar readiness",
      description: "A custom description written by this garden.",
    };

    const display = localizeActionForDisplay(custom, createIntl("pt", ptMessages));

    expect(display.title).toBe(custom.title);
    expect(display.description).toBe(custom.description);
  });

  it("prefers reviewed per-action translations over canonical fallbacks", () => {
    const source = canonicalActions[0];
    const reviewed: Action = {
      ...source,
      inputs: [],
      translations: {
        pt: {
          status: "reviewed",
          data: {
            title: "Prontidão solar da comunidade",
            description: "Descrição revisada pela comunidade.",
          },
        },
      },
    };

    const display = localizeActionForDisplay(reviewed, createIntl("pt", ptMessages));

    expect(display.title).toBe("Prontidão solar da comunidade");
    expect(display.description).toBe("Descrição revisada pela comunidade.");
  });
});
