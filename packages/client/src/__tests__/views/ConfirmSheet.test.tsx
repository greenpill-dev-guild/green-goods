/**
 * @vitest-environment happy-dom
 */

import type { CommitmentReadModel, ResolvedEvidence } from "@green-goods/shared/commitment-pooling";
import { commitmentFixture } from "@green-goods/shared/__tests__/test-utils/commitment-pooling-fixtures";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, within } from "../test-utils";

const mocks = vi.hoisted(() => ({ evidence: [] as ResolvedEvidence[] }));

vi.mock("@green-goods/shared/commitment-pooling", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@green-goods/shared/commitment-pooling")>()),
  useCommitmentEvidence: () => ({ evidence: mocks.evidence, isLoading: false }),
}));

const { ConfirmSheet } = await import("../../views/Home/Garden/Commitment/ConfirmSheet");

const VIEWER = "0x1111111111111111111111111111111111111111" as const;
const PROVIDER = "0x2222222222222222222222222222222222222222" as const;
const STEWARD = "0x3333333333333333333333333333333333333333" as const;

function evidence(cid: string): ResolvedEvidence {
  return {
    cid,
    contributor: PROVIDER,
    attacher: PROVIDER,
    createdAt: 1_700_000_000,
    document: null,
    isLoading: false,
    mediaUrls: [],
    audioUrls: [],
  };
}

function sheet(
  indexedEvidenceCount: number,
  overrides: Partial<CommitmentReadModel> = {},
  open = true,
  startInNotYet = false
) {
  return (
    <ConfirmSheet
      open={open}
      startInNotYet={startInNotYet}
      onOpenChange={vi.fn()}
      commitment={commitmentFixture({
        creator: PROVIDER,
        leadProvider: PROVIDER,
        counterparty: VIEWER,
        derivedState: "READY_FOR_CONFIRMATION",
        onchainState: "READY_FOR_CONFIRMATION",
        evidenceCount: indexedEvidenceCount,
        ...overrides,
      })}
      requirements={[]}
      contributors={[]}
      viewer={VIEWER}
      isOnline
      phase="ask"
      isPending={false}
      notYetFailed={false}
      canNotYet
      onConfirm={vi.fn()}
      onNotYet={vi.fn()}
      onDone={vi.fn()}
    />
  );
}

function renderSheet(indexedEvidenceCount: number, overrides: Partial<CommitmentReadModel> = {}) {
  return renderWithProviders(sheet(indexedEvidenceCount, overrides));
}

describe("ConfirmSheet proof summary", () => {
  beforeEach(() => {
    mocks.evidence = [];
  });

  afterEach(() => vi.restoreAllMocks());

  it("shows the plain empty sentence when nothing is recorded at all", () => {
    renderSheet(0);
    expect(screen.getByText("No proof has been attached yet.")).toBeInTheDocument();
  });

  it("says recorded proof cannot be shown rather than claiming none was attached", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    renderSheet(2);

    const summary = document.querySelector('[data-component="ConfirmSummary"]');
    expect(summary).toBeInstanceOf(HTMLDivElement);
    expect(summary?.querySelector("span > div")).toBeNull();
    expect(screen.getByText("2 items")).toBeInTheDocument();
    // The chain says 2 pieces exist; zero rows resolved. The sheet must never
    // contradict the detail's count by claiming nothing was attached (F5).
    expect(
      screen.getByText("2 pieces of proof are recorded but cannot be shown right now.")
    ).toBeInTheDocument();
    expect(consoleError.mock.calls.flat().join(" ")).not.toMatch(
      /cannot be a descendant|validateDOMNesting|hydration/i
    );
  });

  it("shows one resolved proof without empty copy", () => {
    mocks.evidence = [evidence("bafy-one")];
    renderSheet(1);

    expect(screen.getByText("1 item")).toBeInTheDocument();
    expect(screen.queryByText("No proof has been attached yet.")).not.toBeInTheDocument();
  });

  it("shows multiple resolved proofs without empty copy", () => {
    mocks.evidence = [evidence("bafy-one"), evidence("bafy-two")];
    renderSheet(2);

    expect(screen.getByText("2 items")).toBeInTheDocument();
    expect(screen.queryByText("No proof has been attached yet.")).not.toBeInTheDocument();
  });
});

describe("ConfirmSheet words for a request that is not garden work", () => {
  it("asks whether the promise was kept, never whether help arrived", async () => {
    // A course a garden asked members to complete is the same kind of record as a ride
    // someone asked for, so the sheet asks in the promise's own words.
    renderSheet(1, {
      direction: "REQUEST",
      commitmentType: "SUPPORT_SERVICE",
      creator: VIEWER,
      counterparty: PROVIDER,
    });

    const sheet = screen.getByRole("dialog", { name: "Promise kept?" });
    expect(within(sheet).getByRole("button", { name: "Confirm It Was Kept" })).toBeInTheDocument();
    expect(within(sheet).queryByText(/help/i)).toBeNull();

    await userEvent.setup().click(within(sheet).getByRole("button", { name: "Not Yet" }));
    expect(
      within(sheet).getByRole("button", { name: "It hasn't happened yet" })
    ).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: "Not finished yet" })).toBeInTheDocument();
    expect(within(sheet).getByRole("textbox")).toHaveAttribute(
      "placeholder",
      "The last part is still to come…"
    );
  });
});

describe("ConfirmSheet words for a request with named confirmers", () => {
  it("says the asker confirms only to the asker, and names the group as who confirms", () => {
    // A steward can seed a request and name who confirms it. The contract then seats only those
    // people, so a named reader did not ask for it, and the asker does not confirm by asking.
    const request = {
      direction: "REQUEST",
      commitmentType: "SUPPORT_SERVICE",
      counterparty: PROVIDER,
    } as const;
    const { rerender } = renderWithProviders(
      sheet(1, { ...request, creator: STEWARD, confirmers: [VIEWER, STEWARD] })
    );
    const summary = () => document.querySelector('[data-component="ConfirmSummary"]');

    expect(summary()).toHaveTextContent("took this up. You are named to confirm it.");
    expect(summary()).not.toHaveTextContent("You asked");
    expect(screen.getByText(/The named people do\./)).toBeInTheDocument();
    expect(screen.queryByText(/The person who asked does\./)).toBeNull();

    rerender(sheet(1, { ...request, creator: VIEWER, confirmers: [VIEWER, STEWARD] }));
    expect(summary()).toHaveTextContent("took this up. You asked for it, so you confirm it.");
    expect(screen.getByText(/The named people do\./)).toBeInTheDocument();

    rerender(sheet(1, { ...request, creator: VIEWER, confirmers: [] }));
    expect(summary()).toHaveTextContent("took this up. You asked for it, so you confirm it.");
    expect(screen.getByText(/The person who asked does\./)).toBeInTheDocument();
  });
});

describe("ConfirmSheet opening", () => {
  it("opens Confirm It Was Kept on its ask after Report a Problem closed from the page", () => {
    const { rerender } = renderWithProviders(sheet(0, {}, true, true));
    expect(screen.getByRole("button", { name: "Send to the Stewards" })).toBeInTheDocument();
    // The page closes the sheet itself once the report is sent, so the dialog never says so.
    rerender(sheet(0, {}, false, true));
    rerender(sheet(0, {}, true, false));
    expect(screen.getByRole("button", { name: "Confirm It Was Kept" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send to the Stewards" })).toBeNull();
  });
});
