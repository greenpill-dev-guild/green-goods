import { describe, expect, it, vi } from "vitest";
import { SeedFlowFooter } from "@/views/Garden/Pool/Seed/SeedFlowFooter";
import { SetupFlowFooter } from "@/views/Garden/Pool/SetupFlow/SetupFlowFooter";
import { stepBlockedReason } from "@/views/Garden/Pool/SetupFlow/setupFlowModel";
import { renderWithProviders, screen } from "../test-utils";

const noop = vi.fn();

describe("the flow footers", () => {
  it("say why the seed act is off, under the buttons", () => {
    renderWithProviders(
      <SeedFlowFooter
        phase="compose"
        busy={false}
        stepIndex={3}
        isLast
        seedDisabled
        blockedReason="Open the pool before seeding into it."
        count={1}
        addAnotherDisabled={false}
        unsent={false}
        onCancel={noop}
        onBack={noop}
        onNext={noop}
        onAddAnother={noop}
        onSeed={noop}
        onDone={noop}
        onBackToTray={noop}
      />
    );

    expect(screen.getByRole("status")).toHaveTextContent("Open the pool before seeding into it.");
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
