/**
 * Who is signed in on a shared phone: the top bar of every screen that can send shows the
 * account's name, and its sheet signs out in one more tap, landing on sign-in. The garden page's
 * bar, which sends nothing, keeps its own actions.
 */

import en from "@green-goods/shared/i18n/en.json";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  current: undefined as Record<string, unknown> | undefined,
  primaryAddress: null as string | null,
}));

vi.mock("@green-goods/shared/providers/Auth", () => ({
  useOptionalAuthContext: () => auth.current,
}));
vi.mock("@green-goods/shared/hooks/auth/usePrimaryAddress", () => ({
  usePrimaryAddress: () => auth.primaryAddress,
}));
vi.mock("@green-goods/shared/components/Toast/toast.service", () => ({
  toastService: { success: vi.fn(), error: vi.fn() },
}));

import type { Garden } from "@green-goods/shared/types/domain";
import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import { TopNav } from "../../components/Navigation/TopNav";

function LoginPage() {
  const { state } = useLocation();
  return (
    <p>
      Login page{(state as { fromLogout?: boolean } | null)?.fromLogout ? " after sign-out" : ""}
    </p>
  );
}

function renderBar(bar: ReactElement) {
  return render(
    <IntlProvider locale="en" messages={en}>
      <MemoryRouter initialEntries={["/home/garden/work"]}>
        <Routes>
          <Route path="/home/garden/work" element={bar} />
          <Route path="/home/login" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>
    </IntlProvider>
  );
}

const signedInAs = (fields: Record<string, unknown>) => {
  auth.current = {
    isAuthenticated: true,
    authMode: "passkey",
    userName: null,
    signOut: vi.fn(async () => undefined),
    ...fields,
  };
};

beforeEach(() => {
  auth.current = undefined;
  auth.primaryAddress = "0x04D60647836bcA09c37B379550038BdaaFD82503";
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AccountChip in the top bar", () => {
  it("names the passkey account and signs it out to the sign-in screen", async () => {
    const user = userEvent.setup();
    signedInAs({ userName: "maria" });
    renderBar(<TopNav onBackClick={vi.fn()} />);

    const account = screen.getByRole("button", { name: "Account: maria" });
    expect(screen.getByTitle("maria")).toHaveTextContent("maria");

    await user.click(account);
    const sheet = await screen.findByRole("dialog", { name: "Signed in as maria" });
    expect(sheet).toHaveTextContent(/sign out before you continue/i);

    await user.click(screen.getByRole("button", { name: "Sign Out" }));
    expect(auth.current?.signOut).toHaveBeenCalledOnce();
    expect(await screen.findByText("Login page after sign-out")).toBeInTheDocument();
    expect(toastService.success).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Signed out" })
    );
  });

  it("keeps the sheet open and says so when sign-out fails", async () => {
    const user = userEvent.setup();
    signedInAs({ userName: "maria", signOut: vi.fn(async () => Promise.reject(new Error("x"))) });
    renderBar(<TopNav onBackClick={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Account: maria" }));
    await user.click(await screen.findByRole("button", { name: "Sign Out" }));

    await waitFor(() => expect(toastService.error).toHaveBeenCalled());
    expect(screen.getByRole("dialog", { name: "Signed in as maria" })).toBeInTheDocument();
    expect(screen.queryByText(/Login page/)).not.toBeInTheDocument();
  });

  it.each([
    // A wallet account, or a passkey with only a generated name, shows its short address.
    { label: "a wallet account", fields: { authMode: "wallet", userName: "Dev steward" } },
    { label: "a generated passkey name", fields: { userName: "user_1712345678" } },
  ])("shows the short address for $label", ({ fields }) => {
    signedInAs(fields);
    renderBar(<TopNav onBackClick={vi.fn()} />);

    expect(screen.getByRole("button", { name: /^Account: 0x04/ })).toBeInTheDocument();
  });

  it("stays off the bar when nobody is signed in and on the garden page's bar", () => {
    const view = renderBar(<TopNav onBackClick={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /^Account:/ })).not.toBeInTheDocument();

    signedInAs({ userName: "maria" });
    view.rerender(
      <IntlProvider locale="en" messages={en}>
        <MemoryRouter initialEntries={["/home/garden/work"]}>
          <TopNav onBackClick={vi.fn()} garden={{ id: "0xGarden" } as unknown as Garden} />
        </MemoryRouter>
      </IntlProvider>
    );
    expect(screen.queryByRole("button", { name: /^Account:/ })).not.toBeInTheDocument();
  });
});
