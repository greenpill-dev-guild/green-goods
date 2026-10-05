/**
 * @vitest-environment happy-dom
 */

import type { FabConfig } from "@green-goods/shared/components/Canvas/NavigationBar";
import enMessages from "@green-goods/shared/i18n/en";
import esMessages from "@green-goods/shared/i18n/es";
import {
  type RemixiconComponentType,
  RiAddLine,
  RiCloseLine,
  RiHandCoinLine,
  RiUserAddLine,
} from "@remixicon/react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToStaticMarkup } from "react-dom/server";
import { IntlProvider } from "react-intl";
import { describe, expect, it, vi } from "vitest";
import { FabButton } from "./FabButton";

const MESSAGES = { en: enMessages, es: esMessages };

function renderFab(onAction = vi.fn(), locale: keyof typeof MESSAGES = "en") {
  const config: FabConfig = {
    label: "Community actions",
    actions: [
      {
        id: "add-member",
        icon: RiUserAddLine,
        label: "Add Member",
        labelId: "cockpit.community.action.addMember",
      },
      {
        id: "fund-payout-jar",
        icon: RiHandCoinLine,
        label: "Fund Cookie Jar",
        labelId: "cockpit.community.action.fundPayoutJar",
        disabled: true,
        disabledReasonId: "cockpit.community.action.fundPayoutJarNoJar",
        disabledReason: "This garden has no payout jar yet.",
      },
    ],
    onAction,
  };
  render(
    <IntlProvider locale={locale} messages={MESSAGES[locale]}>
      <FabButton config={config} mobileFloating />
    </IntlProvider>
  );
  return { onAction };
}

/** The drawn path of an icon, to tell which icon the FAB shows. */
function iconPath(Icon: RemixiconComponentType) {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(<Icon />);
  return host.querySelector("path")?.getAttribute("d");
}

describe("FabButton", () => {
  it("shows a plus while closed, whatever its primary action, and a close icon while the dial is open (DL-078)", async () => {
    const user = userEvent.setup();
    // The primary here is Add Member, whose own icon is not a plus.
    renderFab();

    const fab = screen.getByRole("button", { name: "Open Actions" });
    expect(fab.querySelector("path")?.getAttribute("d")).toBe(iconPath(RiAddLine));

    await user.click(fab);
    expect(fab.querySelector("path")?.getAttribute("d")).toBe(iconPath(RiCloseLine));
    // The close glyph is named for what it does now.
    expect(fab).toHaveAccessibleName("Close Actions");
    // Each row keeps its act's own icon beside the label that names it.
    const add = screen.getByRole("menuitem", { name: "Add Member" });
    expect(add.querySelector("path")?.getAttribute("d")).toBe(iconPath(RiUserAddLine));
    // The menu is named for the whole set, not for one act.
    expect(screen.getByRole("menu")).toHaveAccessibleName("Actions");
  });

  it("names the dial's menu in the reader's language", async () => {
    const user = userEvent.setup();
    // The config's own label is English: in the app, the primary act's default.
    renderFab(vi.fn(), "es");

    await user.click(screen.getByRole("button", { name: "Abrir acciones" }));
    expect(screen.getByRole("menu")).toHaveAccessibleName("Acciones");
  });

  it("shows a plus on a FAB that fires one act, still named for that act (DL-078)", () => {
    render(
      <IntlProvider locale="en" messages={enMessages}>
        <FabButton
          config={{
            label: "Community actions",
            actions: [
              {
                id: "fund-payout-jar",
                icon: RiHandCoinLine,
                label: "Fund Cookie Jar",
                labelId: "cockpit.community.action.fundPayoutJar",
              },
            ],
            onAction: vi.fn(),
          }}
          mobileFloating
        />
      </IntlProvider>
    );

    const sole = screen.getByRole("button", { name: "Fund Cookie Jar" });
    expect(sole.querySelector("path")?.getAttribute("d")).toBe(iconPath(RiAddLine));
  });

  it("keeps a disabled action reachable, inert, and saying why", async () => {
    const user = userEvent.setup();
    const { onAction } = renderFab();

    await user.click(screen.getByRole("button", { name: "Open Actions" }));
    const add = screen.getByRole("menuitem", { name: "Add Member" });
    const fund = screen.getByRole("menuitem", { name: "Fund Cookie Jar" });
    expect(add).toHaveFocus();

    // Arrow keys reach the disabled action, which names its reason.
    await user.keyboard("{ArrowDown}");
    expect(fund).toHaveFocus();
    expect(fund).toHaveAttribute("aria-disabled", "true");
    expect(fund).toHaveAccessibleDescription("This garden has no payout jar yet.");
    expect(within(fund).getByText("This garden has no payout jar yet.")).toBeInTheDocument();

    await user.keyboard("{Enter}");
    await user.click(fund);
    expect(onAction).not.toHaveBeenCalled();
  });

  it("focuses the first action when every action is disabled", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(
      <IntlProvider locale="en" messages={enMessages}>
        <FabButton
          config={{
            label: "Community actions",
            actions: [
              {
                id: "fund-payout-jar",
                icon: RiHandCoinLine,
                label: "Fund Cookie Jar",
                labelId: "cockpit.community.action.fundPayoutJar",
                disabled: true,
                disabledReasonId: "cockpit.community.action.fundPayoutJarNoJar",
                disabledReason: "This garden has no payout jar yet.",
              },
              {
                id: "add-member",
                icon: RiUserAddLine,
                label: "Add Member",
                labelId: "cockpit.community.action.addMember",
                disabled: true,
              },
            ],
            onAction,
          }}
          mobileFloating
        />
      </IntlProvider>
    );

    await user.click(screen.getByRole("button", { name: "Open Actions" }));
    expect(screen.getByRole("menuitem", { name: "Fund Cookie Jar" })).toHaveFocus();
  });

  it("keeps a disabled sole action inert and says why", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(
      <IntlProvider locale="en" messages={enMessages}>
        <FabButton
          config={{
            label: "Community actions",
            actions: [
              {
                id: "fund-payout-jar",
                icon: RiHandCoinLine,
                label: "Fund Cookie Jar",
                labelId: "cockpit.community.action.fundPayoutJar",
                disabled: true,
                disabledReasonId: "cockpit.community.action.fundPayoutJarNoJar",
                disabledReason: "This garden has no payout jar yet.",
              },
            ],
            onAction,
          }}
          mobileFloating
        />
      </IntlProvider>
    );

    const sole = screen.getByRole("button", { name: "Fund Cookie Jar" });
    expect(sole).toHaveAttribute("aria-disabled", "true");
    expect(sole).toHaveAccessibleDescription("This garden has no payout jar yet.");
    // Touch has no hover, so the pill says why in place.
    expect(within(sole).getByText("This garden has no payout jar yet.")).toBeInTheDocument();
    await user.click(sole);
    expect(onAction).not.toHaveBeenCalled();
  });
});
