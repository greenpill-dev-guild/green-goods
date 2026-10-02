import { describe, expect, it, vi } from "vitest";
import { SeedFlowFooter } from "@/views/Garden/Pool/Seed/SeedFlowFooter";
import type { SeedStatusView } from "@/views/Garden/Pool/Seed/seedStatus";
import { SetupFlowFooter } from "@/views/Garden/Pool/SetupFlow/SetupFlowFooter";
import { stepBlockedReason } from "@/views/Garden/Pool/SetupFlow/setupFlowModel";
import { renderWithProviders, screen } from "../test-utils";

const noop = vi.fn();

const seedStatus = (phase: SeedStatusView["phase"], retry = 0): SeedStatusView => ({
  phase,
  tone: "neutral",
  busy: false,
  title: "",
  description: "",
  progress: null,
  retry,
});

const seedFooter = {
  stepIndex: 3,
  isLast: true,
  mode: "bundle" as const,
  total: 10,
  addAnotherDisabled: false,
  onCancel: noop,
  onBack: noop,
  onNext: noop,
  onAddAnother: noop,
  onCreate: noop,
  onDone: noop,
};

describe("the flow footers", () => {
  it("say why creating is off, under the buttons", () => {
    renderWithProviders(
      <SeedFlowFooter
        {...seedFooter}
        status={seedStatus("ready")}
        canAddAnother
        createDisabled
        blockedReason="Open the pool before seeding into it."
      />
    );

    expect(screen.getByRole("button", { name: "Create 10 Promises" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Open the pool before seeding into it.");
  });

  it("say how many times the wallet asks, beside the button that asks", () => {
    renderWithProviders(
      <SeedFlowFooter
        {...seedFooter}
        status={seedStatus("ready")}
        canAddAnother
        createDisabled={false}
      />
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Your wallet will ask you once, for all 10."
    );
  });

  it("say why Try Again is off once a pass has left promises unsent", () => {
    renderWithProviders(
      <SeedFlowFooter
        {...seedFooter}
        status={seedStatus("partial", 2)}
        canAddAnother={false}
        createDisabled
        blockedReason="A reward is in dollars, and today's G$ price can't be read to convert it."
      />
    );

    expect(screen.getByRole("button", { name: "Try Again (2)" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("today's G$ price can't be read");
  });

  it("say why Next is off in the setup flow", () => {
    renderWithProviders(
      <SetupFlowFooter
        title="Set Up"
        intent="first-run"
        isCampaign={false}
        stepIndex={0}
        isLast={false}
        submitting={false}
        canContinue={false}
        blockedReason="Say what this pool is for."
        failed={false}
        complete={false}
        retryable={false}
        isOnline
        onBack={noop}
        onNext={noop}
        onSubmit={noop}
        onRetry={noop}
        onDone={noop}
      />
    );

    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Say what this pool is for.");
  });

  it("name the first thing a setup step still needs", () => {
    const ready = {
      purpose: "Tools shared across the valley.",
      capValue: 3n,
      name: "Spring",
      datesValid: true,
      secondSeasonBlocked: false,
      splitValid: true,
    };
    expect(stepBlockedReason("how", { ...ready, purpose: " " })?.id).toBe(
      "cockpit.garden.pool.setup.blocked.purpose"
    );
    expect(stepBlockedReason("how", { ...ready, capValue: 0n })?.id).toBe(
      "cockpit.garden.pool.setup.blocked.cap"
    );
    expect(stepBlockedReason("cycle", { ...ready, datesValid: false })?.id).toBe(
      "cockpit.garden.pool.setup.blocked.dates"
    );
    expect(stepBlockedReason("split", { ...ready, splitValid: false })?.id).toBe(
      "cockpit.garden.pool.setup.blocked.split"
    );
    expect(stepBlockedReason("how", ready)).toBeNull();
  });
});
