import messages from "@green-goods/shared/i18n/en.json";
import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { IntlProvider } from "react-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DraftStatus } from "../../views/Garden/DraftStatus";

type Draft = ComponentProps<typeof DraftStatus>["draft"];

function renderStatus(draft: Partial<Draft>, submissionCompleted = false) {
  return render(
    <IntlProvider locale="en" messages={messages}>
      <DraftStatus
        draft={{ missingAttachments: [], retry: vi.fn(), ...draft } as unknown as Draft}
        submissionCompleted={submissionCompleted}
      />
    </IntlProvider>
  );
}

describe("DraftStatus", () => {
  afterEach(cleanup);

  it("says loading and saving to screen readers only, so the step never moves (D29)", () => {
    renderStatus({ saveState: "saving" });

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Saving…");
    expect(status).toHaveClass("sr-only");
    cleanup();

    renderStatus({ saveState: "saved" });
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("keeps a failed save on screen with a way to try again", () => {
    renderStatus({ saveState: "failed" });

    expect(screen.getByRole("alert")).toHaveTextContent("Could not save or restore this work.");
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });
});
