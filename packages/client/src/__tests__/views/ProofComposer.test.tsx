/**
 * ProofComposer — adding proof to a commitment.
 *
 * The rules: only the people doing the work reach the form; credit is chosen
 * in full view and travels exactly as chosen; the photos, the words and the
 * credited people leave as one queued job with no CID, because the phone may
 * have no signal; and a failed enqueue never reads as success.
 *
 * @vitest-environment jsdom
 */

import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "../test-utils";

const VIEWER = "0x1111111111111111111111111111111111111111" as const;
const OTHER = "0x2222222222222222222222222222222222222222" as const;
const HELPER = "0x3333333333333333333333333333333333333333" as const;
const GARDEN = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;

const mockUseCommitment = vi.fn();
const mockUseOffline = vi.fn();
const mockEnqueue = vi.fn();

const AVAILABLE = { status: "available", capability: {} } as const;

function commitment(overrides: Record<string, unknown> = {}) {
  return {
    id: "42161-9",
    chainId: 42161,
    commitmentId: 9n,
    creationSeen: true,
    onchainState: "ACCEPTED",
    derivedState: "ACTIVE",
    state: "ACCEPTED",
    approvedUnits: 0n,
    evidenceCount: 0,
    cycleId: null,
    declaredUnitValue: null,
    declaredValueBasis: null,
    targetUnits: 3n,
    poolId: 7n,
    unitLabel: "hours",
    creator: VIEWER,
    leadProvider: VIEWER,
    counterparty: OTHER,
    direction: "OFFER",
    commitmentType: "DOMAIN_IMPACT",
    confirmers: [],
    contributorCount: 2,
    contributorsFrozen: false,
    metadataCID: null,
    ...overrides,
  };
}

function detail(overrides: Record<string, unknown> = {}) {
  return {
    detail: {
      commitment: commitment(overrides.commitment as Record<string, unknown>),
      contributors: (overrides.contributors as unknown[]) ?? [
        { contributor: VIEWER, active: true, isLead: true },
        { contributor: HELPER, active: true, isLead: false },
      ],
      requirements: [],
    },
    availability: AVAILABLE,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  };
}

vi.mock("@green-goods/shared", async () => {
  const actual = await vi.importActual<typeof import("@green-goods/shared")>("@green-goods/shared");
  return {
    ...actual,
    DEFAULT_CHAIN_ID: 42161,
    usePrimaryAddress: () => VIEWER,
    useCommitment: () => mockUseCommitment(),
    useCommitmentMetadataFor: () => ({ version: 1, title: "Prune the north beds" }),
    useCommitmentJobs: () => ({
      enqueue: mockEnqueue,
      isPending: false,
      error: null,
      viewer: VIEWER,
    }),
    useOffline: () => mockUseOffline(),
    useAudioRecording: () => ({
      isRecording: false,
      isRequesting: false,
      elapsed: 0,
      toggle: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    }),
    // The real pipeline converts HEIC and compresses through a worker; the
    // composition rules under test do not depend on either.
    normalizeWorkMediaFiles: async (files: File[]) => ({
      accepted: files.map((file) => ({ file })),
      rejected: [],
      converted: [],
    }),
    imageCompressor: { ...actual.imageCompressor, shouldCompress: () => false },
  };
});

const { ProofComposer } = await import("../../views/Home/Garden/Proof");

const render = () =>
  renderWithProviders(
    <MemoryRouter initialEntries={[`/home/${GARDEN}/commitments/9/proof`]}>
      <Routes>
        <Route path="/home/:id/commitments/:commitmentId/proof" element={<ProofComposer />} />
        <Route path="/home/:id/commitments/:commitmentId" element={<p>Back on the commitment</p>} />
      </Routes>
    </MemoryRouter>
  );

const next = () => screen.getByRole("button", { name: "Next" });
const photo = () => new File(["jpeg-bytes"], "beds.jpg", { type: "image/jpeg" });

describe("ProofComposer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseOffline.mockReturnValue({ isOnline: true });
    mockUseCommitment.mockReturnValue(detail());
    mockEnqueue.mockResolvedValue("job-1");
  });

  it("turns away anyone who is not doing the work", () => {
    mockUseCommitment.mockReturnValue(
      detail({
        commitment: { creator: OTHER, leadProvider: OTHER, counterparty: VIEWER },
        contributors: [{ contributor: OTHER, active: true, isLead: true }],
      })
    );
    render();

    expect(screen.getByText("Nothing for you to add here")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
  });

  it("lets someone on the team add proof, not only the lead", () => {
    mockUseCommitment.mockReturnValue(
      detail({
        commitment: { creator: OTHER, leadProvider: OTHER, counterparty: null },
        contributors: [
          { contributor: OTHER, active: true, isLead: true },
          { contributor: VIEWER, active: true, isLead: false },
        ],
      })
    );
    render();

    expect(screen.getByText("Show what was done")).toBeInTheDocument();
  });

  it("shows an attached photo as the picture, and lets it be removed", async () => {
    const user = userEvent.setup();
    render();

    await user.upload(document.getElementById("proof-media-upload") as HTMLInputElement, photo());

    expect(screen.getByRole("button", { name: "Open beds.jpg" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove beds.jpg" }));
    expect(screen.queryByRole("button", { name: "Open beds.jpg" })).not.toBeInTheDocument();
  });

  it("credits the signed-in member visibly by default, and refuses proof that credits nobody", async () => {
    const user = userEvent.setup();
    render();
    await user.click(next());

    const me = screen.getByRole("checkbox", { name: "Credit 0x1111...1111" });
    expect(me).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Credit 0x3333...3333" })).not.toBeChecked();

    await user.type(screen.getByLabelText("A few words (optional)"), "Beds cleared");
    expect(next()).toBeEnabled();
    await user.click(me);
    expect(next()).toBeDisabled();
    expect(screen.getByText("Name at least one person who did this.")).toBeInTheDocument();
  });

  it("refuses proof with nothing in it", async () => {
    const user = userEvent.setup();
    render();
    await user.click(next());

    expect(next()).toBeDisabled();
    expect(
      screen.getByText("Add a photo, a voice note, a link or a few words first.")
    ).toBeInTheDocument();
  });

  it("queues the photo, the words, the links and the credited people as one job with no CID", async () => {
    const user = userEvent.setup();
    render();

    const file = photo();
    await user.upload(document.getElementById("proof-media-upload") as HTMLInputElement, file);
    await user.click(next());
    await user.click(screen.getByRole("checkbox", { name: "Credit 0x3333...3333" }));
    await user.type(screen.getByLabelText("A few words (optional)"), "Beds cleared");
    await user.type(screen.getByLabelText("Add a link"), "https://example.org/before");
    await user.click(screen.getByRole("button", { name: "Add" }));
    await user.click(next());

    expect(screen.getByText("Before you add this")).toBeInTheDocument();
    expect(screen.getByText("1 photo or video · no voice note · 1 link")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add this proof" }));

    expect(mockEnqueue).toHaveBeenCalledTimes(1);
    const call = mockEnqueue.mock.calls[0]?.[0] as {
      act: string;
      payload: Record<string, unknown>;
    };
    expect(call.act).toBe("evidence");
    expect(call.payload.commitmentId).toBe(9n);
    expect(call.payload.gardenAddress).toBe(GARDEN);
    expect(call.payload.creditedContributors).toEqual([VIEWER, HELPER]);
    expect(call.payload.note).toBe("Beds cleared");
    expect(call.payload.links).toEqual(["https://example.org/before"]);
    expect(call.payload.media).toEqual([file]);
    expect(typeof call.payload.clientEvidenceId).toBe("string");
    expect(call.payload).not.toHaveProperty("cid");
    expect(await screen.findByText("Proof added")).toBeInTheDocument();
  });

  it("says the consequence from the commitment's cast, not the form", async () => {
    const user = userEvent.setup();
    mockUseCommitment.mockReturnValue(
      detail({
        commitment: {
          direction: "REQUEST",
          creator: OTHER,
          leadProvider: VIEWER,
          counterparty: VIEWER,
          commitmentType: "SUPPORT_SERVICE",
        },
      })
    );
    render();
    await user.click(next());
    await user.type(screen.getByLabelText("A few words (optional)"), "Done");
    await user.click(next());

    expect(screen.getByText(/goes to the person who asked for the help/i)).toBeInTheDocument();
  });

  it("tells a member on a dead connection that it is saved, photos and all", async () => {
    const user = userEvent.setup();
    mockUseOffline.mockReturnValue({ isOnline: false });
    render();
    await user.click(next());
    await user.type(screen.getByLabelText("A few words (optional)"), "Done");
    await user.click(next());

    expect(screen.getByText(/will wait on your phone, photos and all/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add this proof" }));
    expect(await screen.findByText("Saved on this phone")).toBeInTheDocument();
  });

  it("stays on the review when the proof could not be queued", async () => {
    const user = userEvent.setup();
    mockEnqueue.mockRejectedValue(new Error("no sender"));
    render();
    await user.click(next());
    await user.type(screen.getByLabelText("A few words (optional)"), "Done");
    await user.click(next());
    await user.click(screen.getByRole("button", { name: "Add this proof" }));

    expect(screen.queryByText("Proof added")).not.toBeInTheDocument();
    expect(screen.getByText("Before you add this")).toBeInTheDocument();
  });
});
