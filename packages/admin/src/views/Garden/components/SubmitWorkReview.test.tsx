import { type Action, Domain } from "@green-goods/shared/types/domain";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/__tests__/test-utils";
import { SubmitWorkReview } from "./SubmitWorkReview";

const action: Action = {
  id: "42161-1",
  slug: "agro.canopy-baseline",
  title: "Canopy baseline",
  description: "Document the canopy.",
  instructions: "",
  startTime: 0,
  endTime: 0,
  createdAt: 0,
  capitals: [],
  media: [],
  domain: Domain.AGRO,
  inputs: [],
};

const photo = () => new File(["photo"], "field.jpg", { type: "image/jpeg" });
const clip = (type = "video/mp4") =>
  new File(["video"], type === "video/webm" ? "walkthrough.webm" : "walkthrough.mp4", { type });

function review(images: File[]) {
  return (
    <SubmitWorkReview
      action={action}
      images={images}
      values={{}}
      photoRequirementText="1 media item required"
      status={{ phase: "ready", tone: "neutral", busy: false, title: "Review", description: "" }}
    />
  );
}

beforeEach(() => {
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:field-photo");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe("SubmitWorkReview", () => {
  it.each(["video/mp4", "video/webm"])("shows a named file tile for %s", (type) => {
    const video = clip(type);
    renderWithProviders(review([video]));
    expect(screen.getByText(video.name)).toBeVisible();
    expect(screen.queryByRole("img", { name: video.name })).not.toBeInTheDocument();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("keeps photo previews beside named video tiles for mixed media", () => {
    const image = photo();
    const video = clip();
    renderWithProviders(review([image, video]));
    expect(screen.getByRole("img", { name: image.name })).toHaveAttribute(
      "src",
      "blob:field-photo"
    );
    expect(screen.getByText(video.name)).toBeVisible();
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(URL.createObjectURL).toHaveBeenCalledExactlyOnceWith(image);
  });

  it("releases the photo preview when the media changes and when unmounted", () => {
    const { rerender, unmount } = renderWithProviders(review([photo()]));
    rerender(review([clip()]));
    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:field-photo");
    vi.mocked(URL.createObjectURL).mockReturnValue("blob:next-photo");
    rerender(review([photo()]));
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:next-photo");
  });

  it("shows the empty media state without creating a preview", () => {
    renderWithProviders(review([]));
    expect(screen.getByText("No media added.")).toBeVisible();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});
