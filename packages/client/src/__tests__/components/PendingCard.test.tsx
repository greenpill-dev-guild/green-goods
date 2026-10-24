import type { DraftWithImages } from "@green-goods/shared/hooks/work/useDrafts";
import messages from "@green-goods/shared/i18n/en.json";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { IntlProvider } from "react-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@green-goods/shared/hooks/work/useDrafts", () => ({
  useDraftThumbnail: () => ({ ref: { current: null }, url: null }),
}));

import { DraftCard } from "../../components/Cards/Work/DraftCard";
import { PendingCard } from "../../components/Cards/Work/PendingCard";

const renderWithIntl = (ui: ReactElement) =>
  render(
    <IntlProvider locale="en" messages={messages}>
      {ui}
    </IntlProvider>
  );

function draft(overrides: Partial<DraftWithImages> = {}): DraftWithImages {
  return {
    id: "draft-1",
    firstIncompleteStep: "media",
    updatedAt: Date.now() - 2 * 3_600_000,
    images: [],
    attachmentCount: 3,
    thumbnailUrl: null,
    ...overrides,
  } as DraftWithImages;
}

describe("PendingCard", () => {
  afterEach(cleanup);

  it("reads a draft's step and photos, and opens or deletes it apart", () => {
    const onResume = vi.fn();
    const onDelete = vi.fn();
    renderWithIntl(
      <DraftCard draft={draft()} actionTitle="Mulching" onResume={onResume} onDelete={onDelete} />
    );

    expect(screen.getByText("Mulching")).toBeInTheDocument();
    // Where it stands, then when, on one detail line; the age in its short form.
    expect(screen.getByText("Step 2 of 4 · 3 photos")).toBeInTheDocument();
    expect(screen.getByText("2 hr. ago")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Draft");

    fireEvent.click(screen.getByLabelText("Delete Draft"));
    expect(onDelete).toHaveBeenCalledOnce();
    expect(onResume).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Mulching"));
    expect(onResume).toHaveBeenCalledOnce();
  });

  it("gives a day-old draft's age as a number, as work rows do", () => {
    renderWithIntl(
      <DraftCard
        draft={draft({ updatedAt: Date.now() - 24 * 3_600_000 })}
        actionTitle="Mulching"
        onResume={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText("1 day ago")).toBeInTheDocument();
    expect(screen.queryByText("Yesterday")).not.toBeInTheDocument();
  });

  it("marks a draft that keeps a promise", () => {
    renderWithIntl(
      <DraftCard
        draft={draft({
          linkIntent: {
            commitmentId: "12",
            requirementIndex: 0,
            actionUID: 5,
            garden: "0x5eed000000000000000000000000000000000001",
            commitmentTitle: "Transplant 36 seedlings into the east beds",
            requirementLabel: "Seedling Transplant · 36 plants",
            returnTo: "/home/0x5eed000000000000000000000000000000000001/commitments/12",
          },
        })}
        actionTitle="Seedling Transplant"
        onResume={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText("For a promise")).toBeInTheDocument();
  });

  it("names an untitled draft and leaves the photo count out when there is none", () => {
    renderWithIntl(
      <DraftCard
        draft={draft({ firstIncompleteStep: "intro", attachmentCount: 0 })}
        onResume={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText("Untitled Draft")).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 4")).toBeInTheDocument();
  });

  it("drops a status line that only repeats the pill", () => {
    renderWithIntl(
      <PendingCard
        kind="review"
        pill="In review"
        title="Mulch Delivery Log"
        meta="You submitted · Oct 2"
        status="Waiting for a review"
        discardLabel="Discard Mulch Delivery Log"
      />
    );

    expect(screen.getByRole("status")).toHaveTextContent("In review");
    expect(screen.getByText("You submitted · Oct 2")).toBeInTheDocument();
    expect(screen.queryByText("Waiting for a review")).not.toBeInTheDocument();
  });

  it("offers Discard only when the list hands it one", () => {
    const base = {
      kind: "checking" as const,
      pill: "Checking",
      title: "Path Edging",
      meta: "Saved today · 7:58 AM",
      status: "Checking whether it was sent",
      discardLabel: "Discard Path Edging",
    };
    renderWithIntl(<PendingCard {...base} locked onOpen={vi.fn()} />);
    expect(screen.queryByLabelText("Discard Path Edging")).toBeNull();
    // The pill sits inside the row's open target, so a tap on it opens the row.
    expect(screen.getByRole("button", { name: /Path Edging/ })).toContainElement(
      screen.getByRole("status")
    );
    cleanup();

    const onDiscard = vi.fn();
    renderWithIntl(<PendingCard {...base} kind="upload" pill="To upload" onDiscard={onDiscard} />);
    fireEvent.click(screen.getByLabelText("Discard Path Edging"));
    expect(onDiscard).toHaveBeenCalledOnce();
  });
});
