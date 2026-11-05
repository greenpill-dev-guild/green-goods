import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDirtyClose } from "../../../hooks/admin-ui/useDirtyClose";

const onDiscard = vi.fn();
const onClose = vi.fn();

interface GuardOptions {
  dirty: boolean;
  pending: boolean;
  closesInPlace?: boolean;
  guardUnload?: boolean;
}

/** A route-mode dialog: its own close button, and its discard confirm as two buttons. */
function Guard({ dirty, pending, closesInPlace, guardUnload }: GuardOptions) {
  const guard = useDirtyClose({
    isDirty: dirty,
    onClose,
    blockRouteChange: true,
    preventRouteChange: pending,
    closesInPlace,
    guardUnload,
    onDiscard,
  });
  return (
    <>
      <button type="button" onClick={() => guard.onOpenChange(false)}>
        Close
      </button>
      {guard.confirmOpen ? (
        <>
          <button type="button" onClick={guard.cancelClose}>
            Keep Editing
          </button>
          <button type="button" onClick={guard.confirmClose}>
            Discard
          </button>
        </>
      ) : null}
    </>
  );
}

/** Stands in for a dialog that stays mounted while closed, as the Promises tab's do. */
function ClosedDialog() {
  useDirtyClose({ isDirty: false, onClose: () => undefined });
  return null;
}

function renderPage({
  dirty = false,
  pending = false,
  closesInPlace,
  guardUnload,
}: Partial<GuardOptions> = {}) {
  // The closed dialog registers its blocker after the guard's, so it is the one the router asks.
  const router = createMemoryRouter(
    [
      {
        path: "*",
        element: (
          <>
            <Guard
              dirty={dirty}
              pending={pending}
              closesInPlace={closesInPlace}
              guardUnload={guardUnload}
            />
            <ClosedDialog />
          </>
        ),
      },
    ],
    { initialEntries: ["/tab", "/tab?item=open"], initialIndex: 1 }
  );
  render(<RouterProvider router={router} />);
  return router;
}

const currentUrl = (router: ReturnType<typeof renderPage>) =>
  `${router.state.location.pathname}${router.state.location.search}`;

describe("useDirtyClose", () => {
  beforeEach(() => {
    onDiscard.mockClear();
    onClose.mockClear();
  });

  it("stops a route change while a closed dialog's hook registered after it", async () => {
    const router = renderPage({ dirty: true });

    await act(() => router.navigate("/elsewhere"));

    expect(await screen.findByRole("button", { name: "Discard" })).toBeInTheDocument();
    expect(currentUrl(router)).toBe("/tab?item=open");

    fireEvent.click(screen.getByRole("button", { name: "Discard" }));

    await waitFor(() => expect(currentUrl(router)).toBe("/elsewhere"));
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it("holds a close that goes back, until the steward chooses", async () => {
    const router = renderPage({ dirty: true });

    await act(() => router.navigate(-1));
    fireEvent.click(await screen.findByRole("button", { name: "Keep Editing" }));

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Discard" })).not.toBeInTheDocument()
    );
    expect(currentUrl(router)).toBe("/tab?item=open");
    expect(onDiscard).not.toHaveBeenCalled();

    await act(() => router.navigate(-1));
    fireEvent.click(await screen.findByRole("button", { name: "Discard" }));

    await waitFor(() => expect(currentUrl(router)).toBe("/tab"));
  });

  it("cancels a route change outright while a write is pending", async () => {
    const router = renderPage({ dirty: true, pending: true });

    await act(() => router.navigate("/elsewhere"));

    expect(screen.queryByRole("button", { name: "Discard" })).not.toBeInTheDocument();
    expect(currentUrl(router)).toBe("/tab?item=open");
  });

  it("lets a route change through when nothing is at stake", async () => {
    const router = renderPage();

    await act(() => router.navigate("/elsewhere"));

    expect(currentUrl(router)).toBe("/elsewhere");
    expect(screen.queryByRole("button", { name: "Discard" })).not.toBeInTheDocument();
  });

  it("confirms a dirty dialog's own close when it closes in place, and still guards Back", async () => {
    const router = renderPage({ dirty: true, closesInPlace: true });

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Discard" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    await act(() => router.navigate(-1));
    expect(await screen.findByRole("button", { name: "Discard" })).toBeInTheDocument();
    expect(currentUrl(router)).toBe("/tab?item=open");
  });

  it.each([
    ["raises", undefined, true],
    ["skips, when asked,", false, false],
  ])("%s the page's leave prompt while a send is pending", (_case, guardUnload, prompted) => {
    renderPage({ pending: true, guardUnload });
    const unload = new Event("beforeunload", { cancelable: true });

    window.dispatchEvent(unload);

    expect(unload.defaultPrevented).toBe(prompted);
  });
});
