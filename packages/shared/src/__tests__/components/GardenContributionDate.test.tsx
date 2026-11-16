/** @vitest-environment happy-dom */
import { render, screen } from "@testing-library/react";
import { IntlProvider, createIntl, createIntlCache } from "react-intl";
import { describe, expect, it } from "vitest";
import {
  GardenContributionDate,
  gardenContributionDetail,
} from "../../components/GardenContributionDate";
import en from "../../i18n/en.json";
import es from "../../i18n/es.json";
import pt from "../../i18n/pt.json";
const show = (props: Parameters<typeof GardenContributionDate>[0], locale = "en", messages = en) =>
  render(
    <IntlProvider locale={locale} messages={messages} timeZone="UTC">
      <GardenContributionDate {...props} />
    </IntlProvider>
  );
describe("GardenContributionDate", () => {
  it.each([
    ["en", en, "Last recorded contribution"],
    ["es", es, "Última contribución registrada"],
    ["pt", pt, "Última contribuição registrada"],
  ] as const)("labels and formats the recorded date in %s", (locale, messages, label) => {
    const { container } = show(
      { contribution: { status: "recorded", at: Date.UTC(2026, 10, 15, 12) } },
      locale,
      messages
    );
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(container.querySelector("time")).toHaveAttribute("datetime", "2026-11-15T12:00:00.000Z");
  });
  it.each([
    ["none", "No recorded contributions"],
    ["unavailable", "Contribution date unavailable"],
    ["loading", "Loading contributions…"],
  ] as const)("states %s without inventing a timestamp", (status, text) => {
    const { container } = show({ contribution: { status } });
    expect(screen.getByText(new RegExp(text))).toBeInTheDocument();
    expect(container.querySelector("time")).toBeNull();
  });
  it("renders no fact when the authorized caller withholds the state", () => {
    const { container } = show({});
    expect(container).toBeEmptyDOMElement();
  });
  it.each([
    ["en", en, "Contributed 11/15/2026"],
    ["es", es, "Contribuyó el 15/11/2026"],
    ["pt", pt, "Contribuiu em 15/11/2026"],
  ] as const)("uses an accurate short row label and complete localized date in %s", (locale, messages, text) => {
    const intl = createIntl({ locale, messages, timeZone: "UTC" }, createIntlCache());
    expect(
      gardenContributionDetail({ status: "recorded", at: Date.UTC(2026, 10, 15, 12) }, intl)
    ).toMatchObject({ text, dateTime: "2026-11-15T12:00:00.000Z", title: expect.any(String) });
    expect(gardenContributionDetail({ status: "recorded", at: NaN }, intl)).toMatchObject({
      text: intl.formatMessage({ id: "app.garden.contribution.rowUnavailable" }),
    });
  });
});
