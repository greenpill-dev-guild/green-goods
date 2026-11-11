import { describe, expect, it } from "vitest";
import { IntlProvider, createIntl } from "react-intl";
import en from "@green-goods/shared/i18n/en";
import es from "@green-goods/shared/i18n/es";
import pt from "@green-goods/shared/i18n/pt";
import { renderWithProviders as render, screen } from "../test-utils";
import { ServiceRewardsSection } from "../../views/Home/Garden/Commitment/ServiceRewardsSection";
import { serviceRewardsView } from "../../views/Home/Garden/Commitment/serviceRewards";
import { memberRewardStorySnapshot } from "../../../../shared/.storybook/voucherMemberRewardFixtures";
import { LESSON_STORY_ISSUER } from "../../../../shared/.storybook/voucherLessonFixtures";
import { requestRewardDeliveries } from "@green-goods/shared/commitment-pooling";

function view(
  locale: string,
  messages: typeof en,
  receivedAt: number | null,
  status: "received" | "on-the-way" = "received"
) {
  const snapshot = memberRewardStorySnapshot("received");
  const reward = requestRewardDeliveries(snapshot)![0]!;
  delete snapshot.pilot;
  snapshot.earnedReward = { ...reward, receivedAt, status };
  return serviceRewardsView(
    {
      snapshot,
      coreState: "FULFILLED",
      issuer: LESSON_STORY_ISSUER,
      garden: "Test garden",
      takeUp: null,
    },
    createIntl({ locale, messages })
  )!;
}

describe("rendered voucher reward facts", () => {
  it.each([
    ["en", en, "Integration lesson: 60 minutes for 1 voucher", "Arrived"],
    ["es", es, "Clase de integración: 60 minutos por 1 vale", "Llegó el"],
    ["pt", pt, "Aula de integração: 60 minutos por 1 vale", "Chegou em"],
  ] as const)("renders the service and a semantic arrival time in %s", (locale, messages, service, arrival) => {
    const { container } = render(
      <IntlProvider locale={locale} messages={messages}>
        <ServiceRewardsSection view={view(locale, messages, 1792862400)} />
      </IntlProvider>
    );
    expect(screen.getByText(service)).toBeInTheDocument();
    expect(container.querySelector("time")).toHaveAttribute(
      "datetime",
      new Date(1792862400 * 1000).toISOString()
    );
    expect(container.querySelector("time")).toHaveTextContent(arrival);
  });
  it("keeps a received reward visible and says nothing about an arrival time it doesn't know", () => {
    const { container } = render(<ServiceRewardsSection view={view("en", en, null)} />);
    expect(screen.getByText("Received")).toBeInTheDocument();
    expect(screen.getByText("Integration lesson: 60 minutes for 1 voucher")).toBeInTheDocument();
    expect(screen.queryByText(/unavailable/)).not.toBeInTheDocument();
    expect(container.querySelector("time")).toBeNull();
  });
  it("does not show an arrival time before delivery", () => {
    const { container } = render(
      <ServiceRewardsSection view={view("en", en, 1792862400, "on-the-way")} />
    );
    expect(screen.getByText("On the way")).toBeInTheDocument();
    expect(screen.queryByText(/Arrived/)).not.toBeInTheDocument();
    expect(container.querySelector("time")).toBeNull();
  });
});
