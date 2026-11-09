import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import messages from "@green-goods/shared/i18n/en.json";

vi.mock("@green-goods/shared/config/passkeyServer", () => ({
  isPasskeyServerEnabled: () => true,
}));

vi.mock("@green-goods/shared/hooks/auth/useAuth", () => ({
  useAuthState: () => ({
    authMode: "passkey",
    credential: { id: "passkey-credential" },
    walletAddress: null,
    embeddedAddress: null,
    userName: "alice",
  }),
  useAuthActions: () => ({ signOut: vi.fn() }),
}));

vi.mock("@green-goods/shared/hooks/auth/usePrimaryAddress", () => ({
  usePrimaryAddress: () => "0x1234567890abcdef1234567890abcdef12345678",
}));

vi.mock("../../views/Profile/AppSettings", () => ({
  AppSettings: () => createElement("section", { "data-testid": "app-settings" }),
}));

vi.mock("../../views/Profile/GardensList", () => ({
  GardensList: () => createElement("section", { "data-testid": "gardens-list" }),
}));

vi.mock("../../views/Profile/InstallCta", () => ({
  InstallCta: () => createElement("section", { "data-testid": "install-cta" }),
}));

vi.mock("../../views/Profile/ServiceAssets", () => ({
  ServiceAssets: () => createElement("section", { "data-testid": "service-assets" }),
}));

import { ProfileAccount } from "../../views/Profile/Account";

function renderAccountTab() {
  return render(
    createElement(
      MemoryRouter,
      null,
      createElement(IntlProvider, { locale: "en", messages }, createElement(ProfileAccount))
    )
  );
}

describe("ProfileAccount", () => {
  afterEach(() => {
    cleanup();
  });

  it("keeps badges out of the account profile stack", () => {
    renderAccountTab();

    expect(screen.getByTestId("install-cta")).toBeInTheDocument();
    expect(screen.getByTestId("app-settings")).toBeInTheDocument();
    expect(screen.getByTestId("service-assets")).toBeInTheDocument();
    expect(screen.queryByTestId("profile-badges")).not.toBeInTheDocument();
  });

  it("shows the username a passkey account chose, with nothing to claim or change a name", () => {
    renderAccountTab();

    expect(
      screen.getByText(
        "To sign in on another device, choose “Continue with Passkey” and enter alice."
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Username" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /username|claim/i })).not.toBeInTheDocument();
  });
});
