import { describe, expect, it } from "vitest";
import { IntlProvider, FormattedMessage } from "react-intl";
import { render, screen } from "@testing-library/react";
import enMessages from "@green-goods/shared/i18n/en.json";
import esMessages from "@green-goods/shared/i18n/es.json";
import ptMessages from "@green-goods/shared/i18n/pt.json";

describe("conviction page title", () => {
  it("renders 'Conviction Strategies' in English (avoids vault-strategy confusion)", () => {
    render(
      <IntlProvider locale="en" messages={enMessages as Record<string, string>}>
        <FormattedMessage id="app.conviction.title" />
      </IntlProvider>
    );
    expect(screen.getByText("Conviction Strategies")).toBeInTheDocument();
  });

  it("renders 'Estrategias de Convicción' in Spanish", () => {
    render(
      <IntlProvider locale="es" messages={esMessages as Record<string, string>}>
        <FormattedMessage id="app.conviction.title" />
      </IntlProvider>
    );
    expect(screen.getByText("Estrategias de Convicción")).toBeInTheDocument();
  });

  it("renders 'Estratégias de Convicção' in Portuguese", () => {
    render(
      <IntlProvider locale="pt" messages={ptMessages as Record<string, string>}>
        <FormattedMessage id="app.conviction.title" />
      </IntlProvider>
    );
    expect(screen.getByText("Estratégias de Convicção")).toBeInTheDocument();
  });
});
