/**
 * SubmitWorkPhotos is the staged media on Submit Work's media step: it says whether the action's
 * photo requirement is met, opens a photo in the shared preview, removes one, and lets go of the
 * object URLs it made.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor, within } from "@/__tests__/test-utils";
import { SubmitWorkPhotos } from "./SubmitWorkPhotos";

const photo = (name: string, sizeBytes = 2048) =>
  new File([new Uint8Array(sizeBytes)], name, { type: "image/jpeg" });
const video = (name: string) => new File([new Uint8Array(2048)], name, { type: "video/mp4" });

function staged(count: number) {
  return Array.from({ length: count }, (_, index) => photo(`photo-${index + 1}.jpg`));
}

let revoked: string[];

beforeEach(() => {
  let made = 0;
  revoked = [];
  vi.spyOn(URL, "createObjectURL").mockImplementation(() => `blob:photo-${++made}`);
  vi.spyOn(URL, "revokeObjectURL").mockImplementation((url) => {
    revoked.push(url);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SubmitWorkPhotos", () => {
  it.each([
    { stagedCount: 0, state: "needed", text: "0 of 2 photos" },
    { stagedCount: 1, state: "needed", text: "1 of 2 photos" },
    { stagedCount: 2, state: "met", text: "2 photos added" },
    { stagedCount: 3, state: "met", text: "3 photos added" },
  ])("reads $state with $stagedCount staged against two required", ({
    stagedCount,
    state,
    text,
  }) => {
    renderWithProviders(
      <SubmitWorkPhotos images={staged(stagedCount)} minRequired={2} onRemove={vi.fn()} />
    );

    const count = screen.getByRole("status");
    expect(count).toHaveTextContent(text);
    expect(count).toHaveAttribute("data-state", state);
  });

  it("shows no count for optional photos until one is staged, then reads met", () => {
    const { rerender } = renderWithProviders(
      <SubmitWorkPhotos images={[]} minRequired={0} onRemove={vi.fn()} />
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    rerender(<SubmitWorkPhotos images={staged(1)} minRequired={0} onRemove={vi.fn()} />);

    expect(screen.getByRole("status")).toHaveTextContent("1 photo added");
    expect(screen.getByRole("status")).toHaveAttribute("data-state", "met");
  });

  it("opens the pressed photo in the preview dialog", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SubmitWorkPhotos images={staged(3)} minRequired={2} onRemove={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Preview photo-2.jpg" }));

    const dialog = await screen.findByRole("dialog", { name: "Image preview" });
    expect(within(dialog).getByText("2 / 3")).toBeInTheDocument();
    expect(within(dialog).getByAltText("Preview 2")).toHaveAttribute("src", "blob:photo-2");
  });

  it("returns focus to the tile once the preview closes", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SubmitWorkPhotos images={staged(3)} minRequired={2} onRemove={vi.fn()} />);
    const tile = screen.getByRole("button", { name: "Preview photo-2.jpg" });

    await user.click(tile);
    await user.click(await screen.findByRole("button", { name: "Close preview" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(tile).toHaveFocus();
  });

  it("removes the photo whose corner button is pressed, without opening it", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    renderWithProviders(
      <SubmitWorkPhotos images={staged(3)} minRequired={2} onRemove={onRemove} />
    );

    await user.click(screen.getByRole("button", { name: "Remove photo-2.jpg" }));

    expect(onRemove).toHaveBeenCalledExactlyOnceWith(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("lists a video without a preview and pages the dialog over the photos only", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <SubmitWorkPhotos
        images={[photo("before.jpg"), video("walkthrough.mp4"), photo("after.jpg")]}
        minRequired={2}
        onRemove={vi.fn()}
      />
    );

    expect(screen.getByText("walkthrough.mp4")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove walkthrough.mp4" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Preview walkthrough.mp4" })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Preview after.jpg" }));

    const dialog = await screen.findByRole("dialog", { name: "Image preview" });
    expect(within(dialog).getByText("2 / 2")).toBeInTheDocument();
  });

  it("keeps a staged photo's object URL, and releases it when the photo or the step goes", () => {
    const [kept, removed] = staged(2);
    const { rerender, unmount } = renderWithProviders(
      <SubmitWorkPhotos images={[kept, removed]} minRequired={2} onRemove={vi.fn()} />
    );
    expect(URL.createObjectURL).toHaveBeenCalledTimes(2);

    rerender(<SubmitWorkPhotos images={[kept]} minRequired={2} onRemove={vi.fn()} />);

    expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
    expect(revoked).toEqual(["blob:photo-2"]);

    unmount();

    expect(revoked).toEqual(["blob:photo-2", "blob:photo-1"]);
  });
});
