/**
 * @vitest-environment jsdom
 */

import { type ActivityEvent } from "@green-goods/shared";
import enMessages from "@green-goods/shared/i18n/en.json";
import { fireEvent, render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { describe, expect, it, vi } from "vitest";
import { HubHistoryQueue } from "@/views/Hub/components/HubHistoryQueue";

const LONG_HASH = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

const EVENT: ActivityEvent = {
  id: "work-1",
  category: "work",
  title: "Community Cleanup",
  description: `Work approved for transaction ${LONG_HASH} with a long audit note that should wrap instead of overflowing the card bounds.`,
  timestamp: new Date("2026-07-08T12:34:00Z").getTime(),
  href: "/hub/history/work-1",
  itemId: "work-1",
};

function renderHistoryQueue(
  props: Partial<React.ComponentProps<typeof HubHistoryQueue>> = {}
) {
  return render(
    <IntlProvider locale="en" messages={enMessages}>
      <HubHistoryQueue
        items={[EVENT]}
        worksLoading={false}
        fetchingAssessments={false}
        hypercertsLoading={false}
        allocationsLoading={false}
        hasDataError={false}
        selectedHistoryEventId={undefined}
        selectedWorkId={undefined}
        onOpenHistoryEvent={vi.fn()}
        {...props}
      />
    </IntlProvider>
  );
}

describe("HubHistoryQueue", () => {
  it("uses a wrapping audit feed instead of the media workbench grid", () => {
    const { container } = renderHistoryQueue();

    expect(container.querySelector(".hub-history-feed")).not.toBeNull();
    expect(container.querySelector(".hub-workbench-grid")).toBeNull();
    expect(container.querySelector(".hub-history-copy")).not.toBeNull();
    expect(screen.getAllByText("Work")).toHaveLength(1);
    expect(screen.getByText(EVENT.title)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(LONG_HASH))).toBeInTheDocument();
  });

  it("marks selected events and opens the history event", () => {
    const onOpenHistoryEvent = vi.fn();
    renderHistoryQueue({
      selectedHistoryEventId: EVENT.id,
      onOpenHistoryEvent,
    });

    const card = screen.getByRole("button", { name: /Community Cleanup/ });
    expect(card).toHaveClass("hub-history-card");
    expect(card).toHaveAttribute("data-selected", "true");

    fireEvent.click(card);
    expect(onOpenHistoryEvent).toHaveBeenCalledWith(EVENT);
  });

  it("does not select events without an item id when no work is selected", () => {
    const impactEvent: ActivityEvent = {
      ...EVENT,
      id: "impact-1",
      category: "impact",
      itemId: undefined,
      title: "Certified impact",
    };

    renderHistoryQueue({ items: [impactEvent] });

    expect(screen.getByRole("button", { name: /Certified impact/ })).toHaveAttribute(
      "data-selected",
      "false"
    );
  });
});
