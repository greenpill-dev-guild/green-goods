/**
 * WorkView Component Tests
 *
 * Tests the reusable work display component used in Review and approval views.
 * Verifies rendering of garden info, media gallery, detail cards, and action buttons.
 */

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const offlineState = { online: true, assets: {} as Record<string, boolean> };
vi.mock("@green-goods/shared/hooks/offline/useOfflineAssetAvailability", () => ({
  useOfflineAssetAvailability: () => offlineState.assets,
}));
vi.mock("@green-goods/shared/hooks/app/useOnlineStatus", () => ({
  useOnlineStatus: () => offlineState.online,
}));
vi.mock("react-intl", () => ({
  useIntl: () => ({
    formatMessage: ({ defaultMessage }: { defaultMessage?: string }) => defaultMessage ?? "",
  }),
}));

vi.mock("@/components/Cards", () => ({
  FormInfo: ({ title, info }: { title: string; info: string }) =>
    createElement("div", { "data-testid": "form-info" }, `${title} - ${info}`),
  GardenCard: ({ garden }: { garden: { name: string } }) =>
    createElement("div", { "data-testid": "garden-card" }, garden.name),
  GardenCardSkeleton: () => createElement("div", { "data-testid": "garden-card-skeleton" }),
}));

vi.mock("@green-goods/shared/components/Audio/AudioPlayer", () => ({
  AudioPlayer: ({ src }: { src: string }) =>
    createElement("div", { "data-testid": "audio-player", "data-src": src }, "Audio"),
}));

vi.mock("@green-goods/shared/modules/data/ipfs/resolve", () => ({
  resolveIPFSUrl: (cid: string) => `https://gateway.test/ipfs/${cid}`,
}));

vi.mock("@/components/Display", () => ({
  Carousel: ({ children }: { children: React.ReactNode }) =>
    createElement("div", { "data-testid": "carousel" }, children),
  CarouselContent: ({ children }: { children: React.ReactNode }) =>
    createElement("div", null, children),
  CarouselItem: ({ children }: { children: React.ReactNode }) =>
    createElement("div", { "data-testid": "carousel-item" }, children),
  ImageWithFallback: ({ alt }: { alt: string }) =>
    createElement("img", { alt, "data-testid": "media-image" }),
}));

import { WorkView } from "../../components/Features/Work/WorkView";

const mockGarden = {
  id: "garden-1",
  name: "Test Garden",
  location: "Test Location",
  bannerImage: "",
  gardeners: [],
  stewards: [],
  createdAt: Date.now(),
};

describe("WorkView", () => {
  const defaultProps = {
    title: "Review Work",
    info: "Check if the information is correct",
    garden: mockGarden as any,
    actionTitle: "Planting Trees",
    media: [] as string[],
    details: [] as Array<{ label: string; value: string; icon?: any }>,
    primaryActions: [] as any[],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    offlineState.online = true;
    offlineState.assets = {};
    cleanup();
  });

  describe("header and info", () => {
    it("renders title and info via FormInfo", () => {
      render(createElement(WorkView, defaultProps));

      expect(screen.getByTestId("form-info")).toHaveTextContent(
        "Review Work - Check if the information is correct"
      );
    });

    it("says the garden as facts, counting each member once, with no photo", () => {
      const garden = {
        ...defaultProps.garden,
        bannerImage: "https://example.test/banner.jpg",
        gardeners: ["0x1", "0x2"],
        stewards: ["0x2", "0x3"],
      };
      const { container } = render(createElement(WorkView, { ...defaultProps, garden }));

      const facts = container.querySelector('[data-component="WorkGarden"]') as HTMLElement;
      expect(facts).toHaveTextContent("NameTest Garden");
      expect(facts).toHaveTextContent("Members3");
      expect(facts).toHaveTextContent("PlaceTest Location");
      // The work's own media carries the pictures; the garden draws none.
      expect(facts.querySelector("img")).toBeNull();
      expect(screen.queryByTestId("garden-card")).toBeNull();
    });

    it("leads the work's facts with its action, unless the heading already names it", () => {
      const { container, rerender } = render(createElement(WorkView, defaultProps));
      const facts = () => container.querySelector('[data-component="WorkDetails"]');
      expect(facts()).toHaveTextContent("ActionPlanting Trees");

      // A steward's page is titled by the work, so its facts don't say it twice.
      rerender(createElement(WorkView, { ...defaultProps, actionInTitle: true }));
      expect(facts()).not.toHaveTextContent("Planting Trees");
    });
  });

  describe("media gallery", () => {
    it("does not show media section when no media provided", () => {
      render(createElement(WorkView, defaultProps));

      expect(screen.queryByText("Media")).not.toBeInTheDocument();
    });

    it("shows media section when media URLs provided", () => {
      render(
        createElement(WorkView, {
          ...defaultProps,
          media: ["blob:http://localhost/img1", "blob:http://localhost/img2"],
          showMedia: true,
        })
      );

      expect(screen.getByText("Media")).toBeInTheDocument();
      expect(screen.getAllByTestId("media-image")).toHaveLength(2);
    });

    it("keeps one slot per photo while preview URLs are still being created", () => {
      // Local previews start as empty URLs and resolve a moment later. Keying
      // slots by URL alone gave the placeholders one shared key, and React left
      // an orphaned slot behind once the real URLs arrived.
      const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const { rerender } = render(<WorkView {...defaultProps} media={["", ""]} />);
      rerender(<WorkView {...defaultProps} media={["blob:one", "blob:two"]} />);

      expect(screen.getAllByTestId("carousel-item")).toHaveLength(2);
      expect(errors.mock.calls.some(([message]) => String(message).includes("same key"))).toBe(
        false
      );
      errors.mockRestore();
    });

    it("hides media when showMedia is false", () => {
      render(
        createElement(WorkView, {
          ...defaultProps,
          media: ["blob:http://localhost/img1"],
          showMedia: false,
        })
      );

      expect(screen.queryByText("Media")).not.toBeInTheDocument();
    });
  });

  describe("audio notes", () => {
    it("does not show audio section when no audioNoteCids provided", () => {
      render(createElement(WorkView, defaultProps));

      expect(screen.queryByText("Audio notes")).not.toBeInTheDocument();
    });

    it("renders AudioPlayer for each audio CID", () => {
      render(
        createElement(WorkView, {
          ...defaultProps,
          audioNoteCids: ["bafyabc123", "bafydef456"],
        })
      );

      expect(screen.getByText("Audio notes")).toBeInTheDocument();
      const players = screen.getAllByTestId("audio-player");
      expect(players).toHaveLength(2);
      expect(players[0]).toHaveAttribute("data-src", "https://gateway.test/ipfs/bafyabc123");
      expect(players[1]).toHaveAttribute("data-src", "https://gateway.test/ipfs/bafydef456");
    });

    it("opens a document online, and offline only from a copy kept on this device", () => {
      const documents = [
        { cid: "bafkreicertificate", type: "application/pdf", name: "Certificate.pdf", size: 0 },
      ];
      const { unmount } = render(createElement(WorkView, { ...defaultProps, documents }));
      expect(screen.getByRole("link", { name: /Certificate\.pdf/ })).toHaveAttribute(
        "href",
        "https://gateway.test/ipfs/bafkreicertificate"
      );
      unmount();

      offlineState.online = false;
      render(createElement(WorkView, { ...defaultProps, documents }));
      expect(screen.queryByRole("link", { name: /Certificate\.pdf/ })).not.toBeInTheDocument();
      expect(screen.getByText("Certificate.pdf")).toBeInTheDocument();
      expect(screen.getByText("Not downloaded for offline use")).toBeInTheDocument();
    });
  });

  describe("details", () => {
    it("lists the values as one list of facts, never a card each (DL-109)", () => {
      const { container } = render(
        createElement(WorkView, {
          ...defaultProps,
          details: [
            { label: "Time Spent", value: "2h 30m" },
            { label: "Description", value: "Planted 50 trees" },
          ],
        })
      );

      const lists = container.querySelectorAll('[data-component="WorkDetails"]');
      expect(lists).toHaveLength(1);
      const rows = lists[0]?.querySelectorAll('[data-component="FactRow"]') ?? [];
      expect(Array.from(rows, (row) => row.textContent)).toEqual([
        "ActionPlanting Trees",
        "Time Spent2h 30m",
        "DescriptionPlanted 50 trees",
      ]);
    });

    it("filters out empty detail values", () => {
      const { container } = render(
        createElement(WorkView, {
          ...defaultProps,
          details: [
            { label: "Time Spent", value: "2h" },
            { label: "Empty", value: "" },
            { label: "Whitespace", value: "   " },
          ],
        })
      );

      const facts = container.querySelector('[data-component="WorkDetails"]');
      expect(facts).toHaveTextContent("Time Spent2h");
      expect(facts).not.toHaveTextContent("Empty");
      expect(facts).not.toHaveTextContent("Whitespace");
    });
  });

  describe("primary actions", () => {
    it("does not render actions section when no actions provided", () => {
      render(createElement(WorkView, defaultProps));

      expect(screen.queryByRole("group", { name: "Actions" })).not.toBeInTheDocument();
    });

    it("renders visible actions", () => {
      render(
        createElement(WorkView, {
          ...defaultProps,
          primaryActions: [
            { id: "approve", label: "Approve", onClick: vi.fn(), visible: true },
            { id: "reject", label: "Reject", onClick: vi.fn(), visible: true },
          ],
        })
      );

      // The utilities share one named row, none of them a full-width button.
      const group = screen.getByRole("group", { name: "Actions" });
      expect(within(group).getByText("Approve")).toBeInTheDocument();
      expect(within(group).getByText("Reject")).toBeInTheDocument();
      expect(group.querySelector("button.w-full")).toBeNull();
    });

    it("hides actions with visible=false", () => {
      render(
        createElement(WorkView, {
          ...defaultProps,
          primaryActions: [
            { id: "approve", label: "Approve", onClick: vi.fn(), visible: true },
            { id: "hidden", label: "Hidden Action", onClick: vi.fn(), visible: false },
          ],
        })
      );

      expect(screen.getByText("Approve")).toBeInTheDocument();
      expect(screen.queryByText("Hidden Action")).not.toBeInTheDocument();
    });

    it("calls onClick when action button is clicked", async () => {
      const onApprove = vi.fn();
      const user = userEvent.setup();

      render(
        createElement(WorkView, {
          ...defaultProps,
          primaryActions: [{ id: "approve", label: "Approve", onClick: onApprove, visible: true }],
        })
      );

      await user.click(screen.getByText("Approve"));
      expect(onApprove).toHaveBeenCalledTimes(1);
    });

    it("disables action buttons when disabled prop is true", () => {
      render(
        createElement(WorkView, {
          ...defaultProps,
          primaryActions: [{ id: "approve", label: "Approve", onClick: vi.fn(), disabled: true }],
        })
      );

      expect(screen.getByText("Approve")).toBeDisabled();
    });
  });

  describe("footer", () => {
    it("renders custom footer content", () => {
      render(
        createElement(WorkView, {
          ...defaultProps,
          footer: createElement("div", { "data-testid": "custom-footer" }, "Footer"),
        })
      );

      expect(screen.getByTestId("custom-footer")).toBeInTheDocument();
    });

    it("renders footer spacer when reserveFooterSpace is true", () => {
      const { container } = render(
        createElement(WorkView, {
          ...defaultProps,
          reserveFooterSpace: true,
        })
      );

      const spacer = container.querySelector("[aria-hidden='true']");
      expect(spacer).toBeInTheDocument();
    });
  });
});

it("keeps photo previews visible but disables unavailable original downloads and playback offline", () => {
  offlineState.online = false;
  render(
    createElement(WorkView, {
      title: "Work",
      info: "Saved",
      actionTitle: "Action",
      details: [],
      media: ["https://media.test/photo", "https://media.test/video"],
      mediaTypes: ["image/jpeg", "video/mp4"],
      audioNoteCids: ["audio"],
      primaryActions: [{ id: "download-media", label: "Download originals", onClick: vi.fn() }],
    })
  );
  expect(screen.getByTestId("media-image")).toBeInTheDocument();
  expect(screen.queryByTestId("audio-player")).toBeNull();
  expect(document.querySelector("video")).toBeNull();
  expect(screen.getByRole("button", { name: "Download originals" })).toBeDisabled();
  expect(screen.getByRole("status")).toHaveTextContent("Photo previews may still be available");
  cleanup();
  offlineState.online = true;
});
