import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@green-goods/shared", () => ({
  usePrimaryAddress: () => "0x1234567890abcdef1234567890abcdef12345678",
}));

vi.mock("../../views/Profile/AccountInfo", () => ({
  AccountInfo: () => createElement("section", { "data-testid": "account-info" }),
}));

vi.mock("../../views/Profile/AppSettings", () => ({
  AppSettings: () => createElement("section", { "data-testid": "app-settings" }),
}));

vi.mock("../../views/Profile/ENSSection", () => ({
  ENSSection: () => createElement("section", { "data-testid": "ens-section" }),
}));

vi.mock("../../views/Profile/GardensList", () => ({
  GardensList: () => createElement("section", { "data-testid": "gardens-list" }),
}));

vi.mock("../../views/Profile/InstallCta", () => ({
  InstallCta: () => createElement("section", { "data-testid": "install-cta" }),
}));

import { ProfileAccount } from "../../views/Profile/Account";

describe("ProfileAccount", () => {
  afterEach(() => {
    cleanup();
  });

  it("keeps badges out of the account profile stack", () => {
    render(
      createElement(IntlProvider, { locale: "en", messages: {} }, createElement(ProfileAccount))
    );

    expect(screen.getByTestId("install-cta")).toBeInTheDocument();
    expect(screen.getByTestId("app-settings")).toBeInTheDocument();
    expect(screen.queryByTestId("profile-badges")).not.toBeInTheDocument();
  });
});
