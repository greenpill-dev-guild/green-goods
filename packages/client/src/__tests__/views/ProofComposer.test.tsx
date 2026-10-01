/**
 * ProofComposer renders the shared controller contract. Draft persistence,
 * commitment authority, payload shaping, the send and its toasts are covered by
 * the controller suite; this file owns the client journey, its copy, and the
 * hand-over to the promise.
 *
 * @vitest-environment happy-dom
 */

import type { ProofComposerController } from "@green-goods/shared/hooks/client-ui/commitment/proof-controller.types";
import { proofComposerControllerFixture } from "@green-goods/shared/__tests__/test-utils/controller-fixtures";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "../test-utils";

const VIEWER = "0x1111111111111111111111111111111111111111" as const;
const OTHER = "0x2222222222222222222222222222222222222222" as const;
const GARDEN = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;

const mockUseController = vi.fn();
let controller: ProofComposerController;

vi.mock("@green-goods/shared/config/default-chain", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    DEFAULT_CHAIN_ID: 42161,
  };
});

vi.mock(
  "@green-goods/shared/hooks/client-ui/commitment/useProofComposerController",
  async (importOriginal) => {
    return {
      ...(await importOriginal()),
      useProofComposerController: (...args: unknown[]) => mockUseController(...args),
    };
  }
);

vi.mock("@green-goods/shared/hooks/app/useOffline", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    useOffline: () => ({ isOnline: true, pendingCount: 0, syncStatus: "idle" }),
  };
});

vi.mock("@green-goods/shared/hooks/app/useOnlineStatus", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    useOnlineStatus: () => true,
  };
});

const { ProofComposer } = await import("../../views/Home/Garden/Proof");

function PromiseDestination() {
  const navigate = useNavigate();
  const { state } = useLocation();
  return (
    <>
      <p>Back on the promise</p>
      {state?.from === "dashboard" ? <p>Its Back reopens Your Work</p> : null}
      <button onClick={() => navigate(-1)}>Native Back</button>
    </>
  );
}

const PROOF = `/home/${GARDEN}/commitments/9/proof`;
const ENTRIES = {
  direct: [PROOF],
  promise: [
    "/origin",
    `/home/${GARDEN}/commitments/9`,
    { pathname: PROOF, state: { proofOrigin: `/home/${GARDEN}/commitments/9` } },
  ],
  dashboard: [{ pathname: PROOF, state: { from: "dashboard" } }],
};

const render = (openedFrom: keyof typeof ENTRIES = "direct") =>
  renderWithProviders(
    <MemoryRouter initialEntries={ENTRIES[openedFrom]}>
      <Routes>
        <Route path="/origin" element={<p>Real origin</p>} />
        <Route path="/home/:id/commitments/:commitmentId/proof" element={<ProofComposer />} />
        <Route path="/home/:id/commitments/:commitmentId" element={<PromiseDestination />} />
      </Routes>
    </MemoryRouter>
  );

const forward = (name: string) => screen.getByRole("button", { name });
const reachReview = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(forward("Details"));
  await user.click(forward("Review Proof"));
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
      toggleCredit: vi.fn(),
      setSendToo: vi.fn(),
      submit: vi.fn(async () => true),
    });
    mockUseController.mockImplementation(() => controller);
  });

  it("passes the route identity, and a way to Your Work, to the controller", () => {
    render();

    expect(mockUseController).toHaveBeenCalledWith({
      chainId: 42161,
      commitmentId: 9n,
      routeGarden: GARDEN,
      onOpenYourWork: expect.any(Function),
    });
  });

  it("renders controller states without exposing the form", () => {
    controller = proofComposerControllerFixture({ status: "notYours", commitment: null });
    render();

    expect(screen.getByText("Nothing for you to add here")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Details" })).not.toBeInTheDocument();
  });

  it("offers restoration retry without showing an editable empty proof", async () => {
    const user = userEvent.setup();
    controller = proofComposerControllerFixture({
      status: "draftRestoreFailed",
      retryDraftRestore: vi.fn(),
      retryDraftSave: vi.fn(),
    });
    render();
    expect(screen.getByText("Couldn’t restore your proof")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Your saved draft has not been replaced. Try restoring it again before you continue."
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Details" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Restore draft" }));
    expect(controller.retryDraftRestore).toHaveBeenCalledOnce();
    expect(controller.retryDraftSave).not.toHaveBeenCalled();
  });

  it("shows retained media and save-latest retry while advance stays disabled", async () => {
    const user = userEvent.setup();
    const file = new File(["jpeg-bytes"], "beds.jpg", { type: "image/jpeg" });
    controller = proofComposerControllerFixture({
      media: [file],
      draftPersistence: "failed",
      retryDraftSave: vi.fn(),
      retryDraftRestore: vi.fn(),
      removeMedia: vi.fn(),
      submit: vi.fn(),
    });
    render();
    expect(screen.getByRole("button", { name: "Remove media 1" })).toBeVisible();
    expect(forward("Details")).toBeDisabled();
    expect(forward("Details")).toHaveAccessibleDescription(
      "Save your latest changes before continuing."
    );
    expect(
      screen.getByText(/Your latest changes are not saved on this device/)
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save latest changes" }));
    expect(controller.retryDraftSave).toHaveBeenCalledOnce();
    expect(controller.retryDraftRestore).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Remove media 1" }));
    expect(controller.removeMedia).toHaveBeenCalledWith(0);
    expect(controller.submit).not.toHaveBeenCalled();
  });

  it("names loading restoration and saving as pending, without a false saved claim", () => {
    controller = proofComposerControllerFixture({ status: "restoringDraft" });
    const { unmount } = render();
    expect(screen.getByRole("status")).toHaveTextContent("Restoring your proof…");
    expect(screen.queryByRole("button", { name: "Details" })).not.toBeInTheDocument();
    unmount();
    controller = proofComposerControllerFixture({ draftPersistence: "saving" });
    render();
    expect(forward("Details")).toBeDisabled();
    expect(forward("Details")).toHaveAccessibleDescription("Saving this proof on your device…");
    expect(screen.queryByRole("button", { name: "Save latest changes" })).not.toBeInTheDocument();
  });

  it("says what the proof holds as it is added, and removes a photo", async () => {
    const user = userEvent.setup();
    controller = { ...controller, note: "", contents: { ...controller.contents, words: false } };
    const { unmount } = render();
    expect(screen.getByRole("status")).toHaveTextContent("Nothing added yet");
    expect(screen.getByRole("button", { name: /Proof for Prune the north beds/ })).toBeVisible();
    unmount();

    const file = new File(["jpeg-bytes"], "beds.jpg", { type: "image/jpeg" });
    controller = proofComposerControllerFixture({
      note: "",
      media: [file],
      imageUrls: ["blob:beds.jpg"],
      removeMedia: vi.fn(),
    });
    render();

    expect(screen.getByRole("status")).toHaveTextContent("Proof added: 1 photo");
    await user.click(screen.getByRole("button", { name: "Remove media 1" }));
    expect(controller.removeMedia).toHaveBeenCalledWith(0);
  });

  it("shows visible credit choices and tells the truth about the note", async () => {
    const user = userEvent.setup();
    controller = { ...controller, contents: { ...controller.contents, links: 1, words: true } };
    render();
    await user.click(forward("Details"));

    expect(screen.getByRole("checkbox", { name: "Credit 0x1111...1111" })).toBeChecked();
    await user.click(screen.getByRole("checkbox", { name: "Credit 0x2222...2222" }));
    expect(controller.toggleCredit).toHaveBeenCalledWith(OTHER);
    expect(screen.getByText("Optional: your link is enough.")).toBeInTheDocument();
  });

  it("explains why an empty proof cannot go to Review", async () => {
    const user = userEvent.setup();
    controller = proofComposerControllerFixture({ note: "", credited: [VIEWER] });
    render();
    await user.click(forward("Details"));

    expect(forward("Review Proof")).toBeDisabled();
    expect(
      screen.getByText("Add a photo, a voice note, a link or a few words first.")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Needed if you add nothing else. Or add a link below, or go back for a photo."
      )
    ).toBeInTheDocument();
  });

  it("offers Add and Send to the lead, with what it costs", async () => {
    const user = userEvent.setup();
    controller = { ...controller, canSendToo: true, sendToo: true };
    render();
    await reachReview(user);

    const send = screen.getByRole("switch", { name: "Send for confirmation too" });
    expect(send).toBeChecked();
    expect(
      screen.getByText("You'll be asked to sign twice: once for the proof, once to send it.")
    ).toBeInTheDocument();
    await user.click(send);
    expect(controller.setSendToo).toHaveBeenCalledWith(false);
    await user.click(forward("Add and Send"));
    expect(controller.submit).toHaveBeenCalledTimes(1);
  });

  it("tells a teammate who sends it, with no switch", async () => {
    const user = userEvent.setup();
    controller = {
      ...controller,
      leads: false,
      seat: "contributor",
      roster: [
        { address: OTHER, isLead: true },
        { address: VIEWER, isLead: false },
      ],
    };
    render();
    await reachReview(user);

    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.getByText(/leads this one and sends it/)).toBeInTheDocument();
  });

  it("says an offline proof waits on the phone, and still adds it", async () => {
    const user = userEvent.setup();
    controller = { ...controller, isOnline: false };
    render();
    await reachReview(user);

    expect(screen.getByText(/It waits on this phone, photos and all/)).toBeInTheDocument();
    await user.click(forward("Add This Proof"));
    expect(controller.submit).toHaveBeenCalledTimes(1);
  });

  it("stays on Review while nothing is admitted", async () => {
    const user = userEvent.setup();
    controller = { ...controller, submit: vi.fn(async () => false) };
    render();
    await reachReview(user);
    await user.click(forward("Add This Proof"));

    expect(controller.submit).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Review Proof", { selector: "h6" })).toBeInTheDocument();
  });

  it("hands over to the promise it came from, so Back reaches the promise's origin", async () => {
    const user = userEvent.setup();
    controller = { ...controller, landing: "sending" };
    render("promise");

    expect(await screen.findByText("Back on the promise")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Native Back" }));
    expect(screen.getByText("Real origin")).toBeInTheDocument();
  });

  it("replaces a proof link opened directly with its promise", async () => {
    const user = userEvent.setup();
    controller = { ...controller, landing: "queued" };
    render();

    expect(await screen.findByText("Back on the promise")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Native Back" }));
    expect(screen.queryByText("Nothing added yet")).not.toBeInTheDocument();
  });

  it("hands a draft reopened from Your Work to its promise, whose Back reopens Your Work", async () => {
    controller = { ...controller, landing: "queued" };
    render("dashboard");

    expect(await screen.findByText("Back on the promise")).toBeInTheDocument();
    expect(screen.getByText("Its Back reopens Your Work")).toBeInTheDocument();
  });

  it("opens the promise from the pinned card and returns to the same step", async () => {
    const user = userEvent.setup();
    render();
    await user.click(forward("Details"));
    await user.click(screen.getByRole("button", { name: /Proof for Prune the north beds/ }));

    const sheet = await screen.findByRole("dialog", { name: "Prune the north beds" });
    expect(sheet).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(forward("Review Proof")).toBeInTheDocument();
  });
});
