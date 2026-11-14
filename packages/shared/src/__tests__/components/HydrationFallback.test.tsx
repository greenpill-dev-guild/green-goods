/**
 * @vitest-environment happy-dom
 */

import { render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { describe, expect, it } from "vitest";
import { HydrationFallback } from "../../components/HydrationFallback";
import en from "../../i18n/en.json";
import es from "../../i18n/es.json";
import pt from "../../i18n/pt.json";

describe("HydrationFallback", () => {
  it.each([
    { locale: "en", messages: en, label: "Loading Green Goods Hub", line: "Loading..." },
    { locale: "es", messages: es, label: "Cargando Green Goods Hub", line: "Cargando..." },
    { locale: "pt", messages: pt, label: "Carregando Green Goods Hub", line: "Carregando..." },
  ])("names the app and shows its loading line in $locale", ({ locale, messages, label, line }) => {
    render(
      <IntlProvider locale={locale} messages={messages}>
        <HydrationFallback appName="Green Goods Hub" showMessage />
      </IntlProvider>
    );

    expect(screen.getByRole("status", { name: label })).toBeInTheDocument();
    expect(screen.getByText(line)).toBeInTheDocument();
  });

  it("shows no loading line unless one is asked for", () => {
    render(
      <IntlProvider locale="en" messages={en}>
        <HydrationFallback />
      </IntlProvider>
    );

    expect(screen.getByRole("status", { name: "Loading Green Goods" })).toBeInTheDocument();
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
  });
});
