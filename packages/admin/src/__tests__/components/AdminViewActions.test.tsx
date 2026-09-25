import type { ViewAction } from "@green-goods/shared/components/Canvas/viewActions.types";
import { RiHandCoinLine, RiUserAddLine } from "@remixicon/react";
import { render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { describe, expect, it, vi } from "vitest";
import enMessages from "@green-goods/shared/i18n/en";
import ptMessages from "@green-goods/shared/i18n/pt";
import { AdminViewActions } from "../../components/AdminViewActions";

const actions: ViewAction[] = [
  {
    id: "fund-payout-jar",
    label: "Fund Cookie Jar",
    labelId: "cockpit.community.action.fundPayoutJar",
    icon: RiHandCoinLine,
    onClick: vi.fn(),
    variant: "secondary",
  },
  {
    id: "add-member",
    label: "Add Member",
    labelId: "cockpit.community.action.addMember",
    icon: RiUserAddLine,
    onClick: vi.fn(),
    variant: "primary",
    primary: true,
  },
];

describe("AdminViewActions", () => {
  it("resolves desktop action labels from the active locale", () => {
    render(
      <IntlProvider locale="pt" messages={ptMessages}>
        <AdminViewActions items={actions} />
      </IntlProvider>
    );

    expect(screen.getByRole("button", { name: "Financiar Cookie Jar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Adicionar membro" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Fund Cookie Jar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add Member" })).not.toBeInTheDocument();
  });

  it("says why a disabled action is disabled, on hover and to screen readers", () => {
    render(
      <IntlProvider locale="en" messages={enMessages}>
        <AdminViewActions
          items={[
            {
              ...actions[0]!,
              disabled: true,
              disabledReasonId: "cockpit.community.action.fundPayoutJarNoJar",
              disabledReason: "This garden has no payout jar yet.",
            },
          ]}
        />
      </IntlProvider>
    );

    const fund = screen.getByRole("button", { name: "Fund Cookie Jar" });
    expect(fund).toBeDisabled();
    expect(fund).toHaveAttribute("title", "This garden has no payout jar yet.");
    expect(fund).toHaveAccessibleDescription("This garden has no payout jar yet.");
  });
});
