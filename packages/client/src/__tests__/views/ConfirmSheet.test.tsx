/**
 * @vitest-environment jsdom
 */

import type { ResolvedEvidence } from "@green-goods/shared/commitment-pooling";
import { commitmentFixture } from "@green-goods/shared/__tests__/test-utils/commitment-pooling-fixtures";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "../test-utils";

const mocks = vi.hoisted(() => ({ evidence: [] as ResolvedEvidence[] }));

vi.mock("@green-goods/shared/commitment-pooling", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@green-goods/shared/commitment-pooling")>()),
  useCommitmentEvidence: () => ({ evidence: mocks.evidence, isLoading: false }),
}));

const { ConfirmSheet } = await import("../../views/Home/Garden/Commitment/ConfirmSheet");

const VIEWER = "0x1111111111111111111111111111111111111111" as const;
const PROVIDER = "0x2222222222222222222222222222222222222222" as const;

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

function renderSheet(indexedEvidenceCount: number) {
  return renderWithProviders(
    <ConfirmSheet
      open
      onOpenChange={vi.fn()}
      commitment={commitmentFixture({
        creator: PROVIDER,
        leadProvider: PROVIDER,
        counterparty: VIEWER,
        derivedState: "READY_FOR_CONFIRMATION",
        onchainState: "READY_FOR_CONFIRMATION",
        evidenceCount: indexedEvidenceCount,
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

describe("ConfirmSheet proof summary", () => {
  beforeEach(() => {
    mocks.evidence = [];
  });

  afterEach(() => vi.restoreAllMocks());

  it("shows an empty count and sentence for zero resolved proofs", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    renderSheet(2);

    expect(document.querySelector('[data-component="ConfirmSummary"]')).toBeInstanceOf(
      HTMLDivElement
    );
    expect(screen.getByText("No items yet")).toBeInTheDocument();
    expect(screen.getByText("No proof has been attached yet.")).toBeInTheDocument();
    expect(consoleError.mock.calls.flat().join(" ")).not.toMatch(
      /cannot be a descendant|validateDOMNesting|hydration/i
    );
  });

  it("shows one resolved proof without empty copy", () => {
    mocks.evidence = [evidence("bafy-one")];
    renderSheet(0);

    expect(screen.getByText("1 item")).toBeInTheDocument();
    expect(screen.queryByText("No proof has been attached yet.")).not.toBeInTheDocument();
  });

  it("shows multiple resolved proofs without empty copy", () => {
    mocks.evidence = [evidence("bafy-one"), evidence("bafy-two")];
    renderSheet(1);

    expect(screen.getByText("2 items")).toBeInTheDocument();
    expect(screen.queryByText("No proof has been attached yet.")).not.toBeInTheDocument();
  });
});
