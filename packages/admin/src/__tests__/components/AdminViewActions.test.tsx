import type { ViewAction } from "@green-goods/shared";
import { RiHandCoinLine, RiUserAddLine } from "@remixicon/react";
import { render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { describe, expect, it, vi } from "vitest";
import ptMessages from "../../../../shared/src/i18n/pt.json";
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
    label: "Add member",
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
    expect(screen.queryByRole("button", { name: "Add member" })).not.toBeInTheDocument();
  });
});
