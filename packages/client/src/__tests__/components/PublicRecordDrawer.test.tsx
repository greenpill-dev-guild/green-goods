/**
 * PublicRecordDrawer focus tests.
 *
 * The drawer takes focus when it opens, and must then leave it alone. It used
 * to focus its close control from an inline callback ref, which React re-runs
 * on every render because the callback is a new function each time — so any
 * re-render (closing the nested image viewer, a photo failing to load) yanked
 * focus out of wherever the reader had put it.
 *
 * @vitest-environment happy-dom
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { IntlProvider } from "react-intl";
import { describe, expect, it } from "vitest";

import { PublicRecordDrawer } from "../../components/Public/PublicRecordDrawer";
import { ImagePreviewDialog } from "../../components/Display/ImagePreviewDialog";

const messages = { "public.source.close": "Close" };

/** The scrim carries the same accessible name; the header pill is the one with text. */
function closePill() {
  const match = screen
    .getAllByRole("button", { name: "Close" })
    .find((node) => node.textContent?.trim() === "Close");
  if (!match) throw new Error("close pill not found");
  return match;
}

function renderDrawer(children: React.ReactNode) {
  return render(
    <IntlProvider locale="en" messages={messages}>
      <PublicRecordDrawer open onClose={() => {}} eyebrow="Field note" titleId="record-title">
        <h2 id="record-title">A record</h2>
        {children}
      </PublicRecordDrawer>
    </IntlProvider>
  );
}

/** Stands in for the image viewer: opening and closing it re-renders the drawer. */
function NestedToggle() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen((v) => !v)}>
        Toggle viewer
      </button>
      {open ? <p>viewer open</p> : null}
    </>
  );
}

describe("PublicRecordDrawer focus", () => {
  it("wraps focus inside the record", async () => {
    const user = userEvent.setup();
    renderDrawer(<button type="button">Open photo</button>);
    await user.tab();
    expect(document.activeElement).toHaveAccessibleName("Open photo");
    await user.tab();
    expect(document.activeElement).toBe(closePill());
    await user.tab({ shift: true });
    expect(document.activeElement).toHaveAccessibleName("Open photo");
  });

  it("closes only a nested photo on Escape and restores its opener", async () => {
    const user = userEvent.setup();
    function Record() {
      const [open, setOpen] = useState(true);
      const [viewer, setViewer] = useState(false);
      return (
        <IntlProvider locale="en" messages={messages}>
          <PublicRecordDrawer
            open={open}
            onClose={() => setOpen(false)}
            eyebrow="Record"
            titleId="record-title"
            dismissOnEscape={!viewer}
          >
            <h2 id="record-title">A record</h2>
            <button
              type="button"
              onClick={(event) => {
                event.currentTarget.focus();
                setViewer(true);
              }}
            >
              Open photo
            </button>
            <ImagePreviewDialog
              isOpen={viewer}
              onClose={() => setViewer(false)}
              images={["data:image/gif;base64,R0lGODlhAQABAAAAACw="]}
            />
          </PublicRecordDrawer>
        </IntlProvider>
      );
    }
    render(<Record />);
    const photo = screen.getByRole("button", { name: "Open photo" });
    await user.click(photo);
    expect(screen.getByTestId("image-preview-dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByTestId("image-preview-dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "A record" })).toBeVisible();
    expect(document.activeElement).toBe(photo);
  });
  it("focuses its close control when it opens", () => {
    renderDrawer(null);
    expect(document.activeElement).toBe(closePill());
  });

  it("leaves focus alone when its content re-renders", async () => {
    const { rerender } = renderDrawer(<NestedToggle />);

    const toggle = screen.getByRole("button", { name: "Toggle viewer" });
    toggle.focus();
    expect(document.activeElement).toBe(toggle);

    // A re-render driven from inside the drawer — the shape the image viewer
    // produces when it opens and closes.
    toggle.click();
    expect(await screen.findByText("viewer open")).toBeInTheDocument();
    expect(document.activeElement).toBe(toggle);

    // And a re-render driven from above it.
    rerender(
      <IntlProvider locale="en" messages={messages}>
        <PublicRecordDrawer open onClose={() => {}} eyebrow="Field note" titleId="record-title">
          <h2 id="record-title">A record</h2>
          <NestedToggle />
        </PublicRecordDrawer>
      </IntlProvider>
    );
    expect(document.activeElement).toBe(toggle);
  });
});
