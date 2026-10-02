/**
 * @vitest-environment happy-dom
 */

import { commitmentFixture } from "@green-goods/shared/__tests__/test-utils/commitment-pooling-fixtures";
import type { CommitmentEventRecord } from "@green-goods/shared/modules/commitment-pooling/types-core";
import { describe, expect, it, vi } from "vitest";
import { CommitmentSummary } from "@/views/Garden/Pool/CommitmentDialog/CommitmentSummary";
import { CommitmentTimeline } from "@/views/Garden/Pool/CommitmentDialog/CommitmentTimeline";
import { CommitmentPeople } from "@/views/Garden/Pool/CommitmentPeople";
import { renderWithProviders, screen } from "../test-utils";

const ASKER = "0x1111111111111111111111111111111111111111" as const;
const HELPER = "0x2222222222222222222222222222222222222222" as const;
const GARDEN_ACCOUNT = "0x4444444444444444444444444444444444444444" as const;

const names = vi.hoisted(
  () =>
    ({
      "0x1111111111111111111111111111111111111111": "ada.eth",
      "0x2222222222222222222222222222222222222222": "bea.eth",
    }) as Record<string, string>
);
vi.mock("@green-goods/shared/hooks/blockchain/useEnsName", () => ({
  useEnsName: (address?: string) => ({
    data: address ? (names[address.toLowerCase()] ?? null) : null,
    isLoading: false,
  }),
}));

function event(overrides: Partial<CommitmentEventRecord>): CommitmentEventRecord {
  return {
    id: "e-1",
    chainId: 42161,
    poolId: 7n,
    cycleId: null,
    commitmentId: 1001n,
    eventType: "CREATED",
    actor: HELPER,
    configurationKey: null,
    previousValue: null,
    newValue: null,
    units: null,
    data: null,
    txHash: `0x${"a".repeat(64)}`,
    timestamp: 1_700_000_000,
    ...overrides,
  };
}

describe("who a commitment is between, by name", () => {
  it("says the provider for the receiver, whichever side asked", () => {
    // An individual claim: the contract writes the taker as counterparty and lead provider.
    const request = commitmentFixture({
      direction: "REQUEST",
      creator: ASKER,
      counterparty: HELPER,
      leadProvider: HELPER,
    });
    const { container } = renderWithProviders(<CommitmentPeople commitment={request} />);
    expect(container).toHaveTextContent("bea.eth for ada.eth");
  });

  it("names the person a garden claim put forward, not the garden's account", () => {
    // On a request taken up as a garden claim, the garden's account is the
    // counterparty and the person doing the work is the lead provider.
    const gardenClaim = commitmentFixture({
      direction: "REQUEST",
      creator: ASKER,
      counterparty: GARDEN_ACCOUNT,
      leadProvider: HELPER,
    });
    const { container } = renderWithProviders(<CommitmentPeople commitment={gardenClaim} />);
    expect(container).toHaveTextContent("bea.eth for ada.eth");
  });

  it("names people in the inspector's summary and timeline, not truncated addresses", () => {
    const offer = commitmentFixture({
      direction: "OFFER",
      creator: HELPER,
      leadProvider: HELPER,
      counterparty: ASKER,
    });
    renderWithProviders(
      <>
        <CommitmentSummary
          commitment={offer}
          title="Water the north beds"
          note={null}
          isDue={false}
          fallbackPath={null}
          stage={0}
        />
        <CommitmentTimeline events={[event({ actor: ASKER, eventType: "CLAIM_ACCEPTED" })]} />
      </>
    );

    expect(
      screen.getByRole("heading", { name: "Water the north beds" }).parentElement
    ).toHaveTextContent("bea.eth for ada.eth");
    expect(screen.queryByText(/→/)).toBeNull();
    const timeline = screen.getByRole("region", { name: "Timeline" });
    expect(timeline).toHaveTextContent("ada.eth");
  });
});
