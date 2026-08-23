/**
 * ProofComposer renders the shared controller contract. Draft persistence,
 * commitment authority, payload shaping, and queue failure behavior are
 * covered by the controller suite; this file owns the client journey and copy.
 *
 * @vitest-environment jsdom
 */

import type { ProofComposerController } from "@green-goods/shared";
import {
  commitmentDetailFixture,
  commitmentFixture,
  proofComposerControllerFixture,
} from "@green-goods/shared/testing";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "../test-utils";

const VIEWER = "0x1111111111111111111111111111111111111111" as const;
const OTHER = "0x2222222222222222222222222222222222222222" as const;
const GARDEN = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;

const mockUseController = vi.fn();
let controller: ProofComposerController;

vi.mock("@green-goods/shared", async () => {
  const actual = await vi.importActual<typeof import("@green-goods/shared")>("@green-goods/shared");
  return {
    ...actual,
    DEFAULT_CHAIN_ID: 42161,
    useProofComposerController: (...args: unknown[]) => mockUseController(...args),
    useOffline: () => ({ isOnline: true, pendingCount: 0, syncStatus: "idle" }),
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
const reachReview = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(next());
  await user.click(next());
};

describe("ProofComposer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    controller = proofComposerControllerFixture({
      viewer: VIEWER,
      note: "Beds cleared",
      credited: [VIEWER],
      roster: [
        { address: VIEWER, isLead: true },
        { address: OTHER, isLead: false },
      ],
      metadata: { version: 1, title: "Prune the north beds" },
      removeMedia: vi.fn(),
      removeAudio: vi.fn(),
      toggleCredit: vi.fn(),
      pick: vi.fn(async () => ({ rejectedCount: 0 })),
      submit: vi.fn(async () => true),
      refetch: vi.fn(async () => undefined),
    });
    mockUseController.mockImplementation(() => controller);
  });

  it("passes the parsed route identity to the controller", () => {
    render();

    expect(mockUseController).toHaveBeenCalledWith({
      chainId: 42161,
      commitmentId: 9n,
      routeGarden: GARDEN,
    });
  });

  it("renders controller states without exposing the form", () => {
    controller = proofComposerControllerFixture({ status: "notYours", commitment: null });
    render();

    expect(screen.getByText("Nothing for you to add here")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
  });

  it("renders attached media and delegates removal", async () => {
    const user = userEvent.setup();
    const file = new File(["jpeg-bytes"], "beds.jpg", { type: "image/jpeg" });
    controller = proofComposerControllerFixture({
      note: "Beds cleared",
      media: [file],
      imageUrls: ["blob:beds.jpg"],
      removeMedia: vi.fn(),
    });
    render();

    expect(screen.getByRole("button", { name: "Open beds.jpg" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove beds.jpg" }));
    expect(controller.removeMedia).toHaveBeenCalledWith(0);
  });

  it("shows visible credit choices and delegates selection", async () => {
    const user = userEvent.setup();
    render();
    await user.click(next());

    const me = screen.getByRole("checkbox", { name: "Credit 0x1111...1111" });
    expect(me).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Credit 0x2222...2222" })).not.toBeChecked();
    await user.click(screen.getByRole("checkbox", { name: "Credit 0x2222...2222" }));
    expect(controller.toggleCredit).toHaveBeenCalledWith(OTHER);
  });

  it("explains why an empty proof cannot advance", async () => {
    const user = userEvent.setup();
    controller = proofComposerControllerFixture({ note: "", credited: [VIEWER] });
    render();
    await user.click(next());

    expect(next()).toBeDisabled();
    expect(
      screen.getByText("Add a photo, a voice note, a link or a few words first.")
    ).toBeInTheDocument();
  });

  it("keeps beat stepping and renders the commitment consequence", async () => {
    const user = userEvent.setup();
    const detail = commitmentDetailFixture({
      commitment: commitmentFixture({
        direction: "REQUEST",
        creator: OTHER,
        leadProvider: VIEWER,
        counterparty: VIEWER,
        commitmentType: "SUPPORT_SERVICE",
      }),
    });
    controller = proofComposerControllerFixture({
      detail,
      commitment: detail.commitment,
      viewer: VIEWER,
      note: "Done",
      credited: [VIEWER],
    });
    render();
    await reachReview(user);

    expect(screen.getByText("Before you add this")).toBeInTheDocument();
    expect(screen.getByText(/goes to the person who asked for the help/i)).toBeInTheDocument();
  });

  it("shows offline queue copy and delegates submission", async () => {
    const user = userEvent.setup();
    controller = proofComposerControllerFixture({
      isOnline: false,
      note: "Done",
      submit: vi.fn(async () => true),
    });
    render();
    await reachReview(user);

    expect(screen.getByText(/will wait on your phone, photos and all/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add this proof" }));
    expect(controller.submit).toHaveBeenCalledTimes(1);
  });

  it("stays on review when the controller cannot queue the proof", async () => {
    const user = userEvent.setup();
    controller = proofComposerControllerFixture({
      note: "Done",
      submit: vi.fn(async () => false),
    });
    render();
    await reachReview(user);
    await user.click(screen.getByRole("button", { name: "Add this proof" }));

    expect(controller.submit).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Before you add this")).toBeInTheDocument();
  });

  it("renders the queued outcome from the controller", () => {
    controller = proofComposerControllerFixture({ status: "queued" });
    render();

    expect(screen.getByText("Proof added")).toBeInTheDocument();
  });
});
