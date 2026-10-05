/**
 * @vitest-environment happy-dom
 */

import {
  type RemixiconComponentType,
  RiAddLine,
  RiCloseLine,
  RiHandCoinLine,
  RiUserAddLine,
} from "@remixicon/react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToStaticMarkup } from "react-dom/server";
import { IntlProvider } from "react-intl";
import { describe, expect, it, vi } from "vitest";
import type { FabAction } from "../../components/Canvas/NavigationBar";
import { FabButton } from "../../components/Canvas/NavigationBarFab";
import enMessages from "../../i18n/en.json";

const addMember: FabAction = {
  id: "add-member",
  icon: RiUserAddLine,
  label: "Add Member",
  labelId: "cockpit.community.action.addMember",
};
const fundCookieJar: FabAction = {
  id: "fund-payout-jar",
  icon: RiHandCoinLine,
  label: "Fund Cookie Jar",
  labelId: "cockpit.community.action.fundPayoutJar",
};

/** The drawn path of an icon, to tell which icon the FAB shows. */
function iconPath(Icon: RemixiconComponentType) {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(<Icon />);
  return host.querySelector("path")?.getAttribute("d");
}

/** Neither primary's own icon is a plus. */
function renderFab(primary: FabAction, ...rest: FabAction[]) {
  render(
    <IntlProvider locale="en" messages={enMessages}>
      <FabButton
        config={{
          label: "Community actions",
          actions: [primary, ...rest],
          onAction: vi.fn(),
        }}
        mobileFloating
      />
    </IntlProvider>
  );
}

describe("NavigationBarFab", () => {
  it("shows a plus while closed, whatever its primary action, and a close icon while the dial is open (DL-078)", async () => {
    const user = userEvent.setup();
    renderFab(addMember, fundCookieJar);

    const fab = screen.getByRole("button", { name: "Open Actions" });
    expect(fab.querySelector("path")?.getAttribute("d")).toBe(iconPath(RiAddLine));

    await user.click(fab);
    expect(fab.querySelector("path")?.getAttribute("d")).toBe(iconPath(RiCloseLine));
    expect(fab.querySelector("svg")?.getAttribute("class") ?? "").not.toContain("rotate");
    // The close glyph is named for what it does now.
    expect(fab).toHaveAccessibleName("Close Actions");
  });

  it("shows a plus on a FAB that fires one act, still named for that act (DL-078)", () => {
    renderFab(fundCookieJar);

    const sole = screen.getByRole("button", { name: "Fund Cookie Jar" });
    expect(sole.querySelector("path")?.getAttribute("d")).toBe(iconPath(RiAddLine));
  });
});
