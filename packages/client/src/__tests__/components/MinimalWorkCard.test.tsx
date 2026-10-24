import { WorkCard as SharedWorkCard } from "@green-goods/shared/components/Cards/WorkCard/WorkCard";
import esMessages from "@green-goods/shared/i18n/es";
import { IntlProvider } from "react-intl";
import { describe, expect, it, vi } from "vitest";
import { MinimalWorkCard } from "../../components/Cards/Work/MinimalWorkCard";
import { renderWithProviders as render, screen, userEvent } from "../test-utils";

describe("components/Cards/MinimalWorkCard", () => {
  const work = {
    id: "work-1",
    title: "Plant Flowers",
    actionUID: 1,
    gardenAddress: "0x2222222222222222222222222222222222222222",
    gardenerAddress: "0x1111111111111111111111111111111111111111",
    media: ["https://example.com/photo.jpg"],
    feedback: "Great work on the roses!",
    status: "approved",
    createdAt: Date.now() - 7_200_000,
    metadata: "",
  };

  it("names the work, its one status pill and its short age, with the photo count on the photo", () => {
    render(
      <MinimalWorkCard
        work={{ ...work, feedback: "" } as any}
        onClick={vi.fn()}
        actionTitle="Custom Title"
      />
    );

    const row = screen.getByRole("button");
    expect(row).toHaveTextContent("Custom Title");
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent("Approved");
    expect(screen.getByText("1 photo")).toBeInTheDocument();
    expect(screen.getByText("2 hr. ago")).toBeInTheDocument();
    expect(screen.queryByText("Feedback")).not.toBeInTheDocument();
  });

  it("gives feedback in the age's place, never as a second pill", () => {
    render(<MinimalWorkCard work={work as any} onClick={vi.fn()} />);

    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByText("Feedback")).toBeInTheDocument();
    expect(screen.queryByText("2 hr. ago")).not.toBeInTheDocument();
  });

  it("calls onClick when the compact card is pressed", async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(<MinimalWorkCard work={work as any} onClick={handleClick} />);

    const card = screen.getByRole("button");
    expect(card).toHaveAttribute("data-pressable", "card");
    await user.click(card);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("renders a card with nothing to open as content, not a button that does nothing", () => {
    render(
      <SharedWorkCard
        work={{
          id: "work-2",
          title: "Plant Flowers",
          status: "approved",
          createdAt: work.createdAt,
        }}
      />
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("words a list's own state in the one pill and its two details", () => {
    render(
      <MinimalWorkCard
        work={work as any}
        onClick={vi.fn()}
        presentation={{
          statusLabel: "To upload",
          statusTone: "info",
          contextLabel: "You submitted",
          supportingText: "Ready to sign and upload",
        }}
      />
    );

    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent("To upload");
    expect(screen.getByText("You submitted")).toBeInTheDocument();
    // The second detail takes the age's place.
    expect(screen.getByText("Ready to sign and upload")).toBeInTheDocument();
    expect(screen.queryByText("2 hr. ago")).not.toBeInTheDocument();
  });

  describe("title", () => {
    const title = () => screen.getByRole("button").querySelector(".gg-item-row-title");

    it("drops the timestamps older submissions appended to a hosted title", () => {
      render(
        <MinimalWorkCard
          work={
            {
              ...work,
              title: "Maintenance Activity - 2026-03-19T23:56:54.981Z - 2026-03-19T23:56:55.093Z",
            } as any
          }
          onClick={vi.fn()}
        />
      );

      expect(title()).toHaveTextContent(/^Maintenance Activity$/);
      expect(title()).toHaveAttribute("title", "Maintenance Activity");
    });

    it("reads the work's own title when its action has only a generated name", () => {
      render(
        <MinimalWorkCard
          work={{ ...work, title: "Plant Flowers - 2026-03-19T23:56:54.981Z" } as any}
          onClick={vi.fn()}
          actionTitle="Action 1"
        />
      );

      expect(title()).toHaveTextContent(/^Plant Flowers$/);
    });

    it("calls a work with no real title untitled, in the reader's language", () => {
      render(
        <IntlProvider locale="es" messages={esMessages}>
          <MinimalWorkCard work={{ ...work, title: "Action 1" } as any} onClick={vi.fn()} />
        </IntlProvider>
      );

      expect(title()).toHaveTextContent(/^Trabajo sin título$/);
    });
  });
});
