import { describe, expect, it, vi } from "vitest";
import {
  FlowSendFooter,
  type FlowSendFooterProps,
  flowSendPhase,
  SingleSendNote,
} from "@/components/Layout/FlowSendFooter";
import { SeedFlowFooter } from "@/views/Garden/Pool/Seed/SeedFlowFooter";
import type { SeedStatusView } from "@/views/Garden/Pool/Seed/seedStatus";
import { SetupFlowFooter } from "@/views/Garden/Pool/SetupFlow/SetupFlowFooter";
import { stepBlockedReason } from "@/views/Garden/Pool/SetupFlow/setupFlowModel";
import { fireEvent, renderWithProviders, screen } from "../test-utils";

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

/** A create flow's footer on its Review, at one moment of the send. */
function sendFooter(props: Partial<FlowSendFooterProps> = {}) {
  const handlers = {
    onCancel: vi.fn(),
    onBack: vi.fn(),
    onNext: vi.fn(),
    onSend: vi.fn(),
    onDone: vi.fn(),
    onAnother: vi.fn(),
  };
  const phase = props.phase ?? "ready";
  renderWithProviders(
    <FlowSendFooter
      stepIndex={3}
      isLast
      phase={phase}
      sendLabel="Submit Assessment"
      note={<SingleSendNote phase={phase} />}
      another={{ label: "Create Another", onClick: handlers.onAnother }}
      {...handlers}
      {...props}
    />
  );
  return handlers;
}

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

  it.each([
    [{ sending: false, sent: false, failed: false }, "ready"],
    [{ sending: true, sent: false, failed: false }, "sending"],
    [{ sending: false, sent: false, failed: true }, "failed"],
    // A retry is under way: the last failure no longer reads.
    [{ sending: true, sent: false, failed: true }, "sending"],
    // A send that landed stays sent, whatever a stale flag says.
    [{ sending: false, sent: true, failed: true }, "sent"],
  ] as const)("read a create flow's send %o as %s", (send, phase) => {
    expect(flowSendPhase(send)).toBe(phase);
  });

  it("send from the Review, and say how often the wallet asks", () => {
    const handlers = sendFooter();

    expect(screen.getByRole("status")).toHaveTextContent("Your wallet will ask you once.");
    fireEvent.click(screen.getByRole("button", { name: "Submit Assessment" }));
    expect(handlers.onSend).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Done" })).not.toBeInTheDocument();
  });

  it("hold every button while a create flow sends", () => {
    sendFooter({ phase: "sending" });

    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Submit Assessment" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "The dialog stays open until your wallet answers."
    );
  });

  it("offer Try Again and the way back after a send that failed", () => {
    const handlers = sendFooter({ phase: "failed" });

    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(handlers.onSend).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Back" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Submit Assessment" })).not.toBeInTheDocument();
  });

  it("leave only Done and a fresh start once a create flow has sent", () => {
    const handlers = sendFooter({ phase: "sent" });

    // No way back into the steps, and nothing left to send.
    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Create Another",
      "Done",
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Create Another" }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(handlers.onAnother).toHaveBeenCalledTimes(1);
    expect(handlers.onDone).toHaveBeenCalledTimes(1);
  });

  it("hold only the act while what it would send is incomplete", () => {
    const handlers = sendFooter({ sendDisabled: true });

    expect(screen.getByRole("button", { name: "Submit Assessment" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Back" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Submit Assessment" }));
    expect(handlers.onSend).not.toHaveBeenCalled();
  });

  it("go back and on before the Review, and wait while work outside the send runs", () => {
    const handlers = sendFooter({ stepIndex: 0, isLast: false, held: true });

    // The first step leaves by Cancel; nothing sends from here.
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Submit Assessment" })).not.toBeInTheDocument();
    expect(handlers.onSend).not.toHaveBeenCalled();
  });
});
