import { RiUserSettingsLine } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";
import { IntlProvider, useIntl } from "react-intl";
import { expect, fn, mocked, userEvent, within } from "storybook/test";
import { FIXTURE_IMAGE_PROFILE } from "../../../../.storybook/fixtures";
import { expectItemRowsFit } from "../../../../.storybook/itemRowFit";
import { resetHookMocks } from "../../../../.storybook/moduleMocks";
import { useEnsName } from "../../../hooks/blockchain/useEnsName";
import { useGreenGoodsEnsName } from "../../../hooks/ens/useGreenGoodsEnsName";
import { useResolvedProfileAvatar } from "../../../hooks/profile/useProfileAvatar";
import enMessages from "../../../i18n/en.json";
import esMessages from "../../../i18n/es.json";
import ptMessages from "../../../i18n/pt.json";
import type { Address } from "../../../types/domain";
import { IconButton } from "../../IconButton";
import { PersonRow } from "./PersonRow";

const RIVER = "0x1111111111111111111111111111111111111111" as Address;
const ANA = "0x2222222222222222222222222222222222222222" as Address;
const BARE = "0x3333333333333333333333333333333333333333" as Address;
const TOMI = "0x4444444444444444444444444444444444444444" as Address;
const PENDING = "0x5555555555555555555555555555555555555555" as Address;

/** Who has which name and photo: a Green Goods name, an ENS name, and people with neither. */
const PROTOCOL_NAMES: Partial<Record<Address, string>> = { [RIVER]: "river.greengoods.eth" };
const ENS_NAMES: Partial<Record<Address, string>> = {
  [ANA]: "ana-souza.eth",
  [TOMI]: "tomi.eth",
};
const PHOTOS: Partial<Record<Address, string>> = { [RIVER]: FIXTURE_IMAGE_PROFILE };

/** One column of rows at a list's width, the way a list stacks them (12px apart). */
function Column({ width, children }: { width: number; children: ReactNode }) {
  return (
    <ul className="flex flex-col gap-(--gg-list-gap)" style={{ width }}>
      {children}
    </ul>
  );
}

/**
 * A garden's people: every kind of name, several roles held at once with the count of them,
 * a funder's yield, and the longest role, "Community member", in each language.
 */
function Roster() {
  const { formatMessage } = useIntl();
  const roles = (count: number) =>
    formatMessage({ id: "cockpit.community.members.roleCount" }, { count });
  return (
    <>
      <li>
        <PersonRow address={RIVER} roles={["owner", "gardener"]} details={[roles(2)]} />
      </li>
      <li>
        <PersonRow
          address={ANA}
          roles={["gardener", "evaluator", "steward"]}
          details={[roles(3)]}
        />
      </li>
      <li>
        <PersonRow address={BARE} roles={["gardener"]} />
      </li>
      <li>
        <PersonRow
          address={TOMI}
          roles={["funder"]}
          details={[formatMessage({ id: "app.funders.yieldGenerated" }, { amount: "4.2000" })]}
        />
      </li>
      <li>
        <PersonRow address={PENDING} roles={["community"]} />
      </li>
    </>
  );
}

const meta: Meta<typeof PersonRow> = {
  title: "Shared/Cards/PersonRow",
  component: PersonRow,
  tags: ["autodocs", "storybook-ci"],
  parameters: {
    docs: {
      description: {
        component:
          "One person in a list on both surfaces (DL-112): an item row led by the person's 56px avatar (their photo, or a glyph), their name from the shared address display (their Green Goods name, then their ENS name, then a short address), their highest role as the row's one chip, and one count. The cockpit's density comes from its tokens.",
      },
    },
  },
  beforeEach: () => {
    mocked(useGreenGoodsEnsName).mockImplementation(
      (address) =>
        ({ data: address ? (PROTOCOL_NAMES[address] ?? null) : null }) as ReturnType<
          typeof useGreenGoodsEnsName
        >
    );
    mocked(useEnsName).mockImplementation(
      (address) =>
        ({ data: address ? (ENS_NAMES[address] ?? null) : null }) as ReturnType<typeof useEnsName>
    );
    mocked(useResolvedProfileAvatar).mockImplementation(
      (address) =>
        ({
          avatarUri: address ? (PHOTOS[address] ?? null) : null,
          isLoading: address === PENDING,
        }) as ReturnType<typeof useResolvedProfileAvatar>
    );
    return resetHookMocks(useEnsName, useGreenGoodsEnsName, useResolvedProfileAvatar);
  },
};

export default meta;
type Story = StoryObj<typeof PersonRow>;

/**
 * A garden's people at the installed app's density and the cockpit's: the Green Goods name
 * reads as the username alone, someone with no name reads as a short address, and while a
 * photo is still being looked up the avatar stays empty.
 */
export const Densities: Story = {
  render: () => (
    <div className="flex flex-wrap gap-8">
      <section className="flex flex-col gap-2">
        <h3 className="type-label-sm text-text-sub-600">Installed app</h3>
        <Column width={358}>
          <Roster />
        </Column>
      </section>
      <section className="flex flex-col gap-2" data-surface-scope="admin">
        <h3 className="type-label-sm text-text-sub-600">Cockpit</h3>
        <Column width={366}>
          <Roster />
        </Column>
      </section>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const [app] = canvasElement.querySelectorAll<HTMLElement>("section");
    const rows = within(app).getAllByRole("listitem");
    await expect(rows[0]).toHaveTextContent(/^river\s*Owner\s*2 roles$/);
    await expect(rows[1]).toHaveTextContent(/^ana-souza\.eth\s*Steward\s*3 roles$/);
    await expect(rows[2]).toHaveTextContent(/^0x33\.\.\.333\s*Gardener$/);
    await expect(rows[4].querySelector(".gg-item-row-avatar")).toBeEmptyDOMElement();
    await expectItemRowsFit(canvasElement);
  },
};

/**
 * The longest role chips and counts in English, Spanish and Portuguese at 320, 360 and
 * 390px phones: every row keeps its 88px, and no detail wraps or is cut.
 */
export const ThreeLanguages: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      {(
        [
          ["en", enMessages],
          ["es", esMessages],
          ["pt", ptMessages],
        ] as const
      ).map(([locale, messages]) => (
        <IntlProvider key={locale} locale={locale} messages={messages}>
          <div className="flex flex-wrap gap-6">
            {[288, 328, 358].map((width) => (
              <Column key={width} width={width}>
                <Roster />
              </Column>
            ))}
          </div>
        </IntlProvider>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expectItemRowsFit(canvasElement);
  },
};

const manageRoles = fn();
const openPerson = fn();

/**
 * A row that opens its person marks the one the list has open, and a row that needs the
 * reader keeps its one action in the right slot without opening the row.
 */
export const OpenAndAction: Story = {
  render: () => (
    <Column width={358}>
      <li>
        <PersonRow address={ANA} roles={["steward"]} selected onOpen={openPerson} />
      </li>
      <li>
        <PersonRow
          address={TOMI}
          roles={["gardener", "funder"]}
          details={["2 roles"]}
          action={
            <IconButton
              aria-label="Manage Roles"
              onClick={manageRoles}
              icon={<RiUserSettingsLine aria-hidden="true" />}
            />
          }
        />
      </li>
    </Column>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const open = canvas.getByRole("button", { name: /ana-souza\.eth/ });
    await expect(open).toHaveAttribute("aria-current", "true");
    await userEvent.click(open);
    await expect(openPerson).toHaveBeenCalledTimes(1);
    await userEvent.click(canvas.getByRole("button", { name: "Manage Roles" }));
    await expect(manageRoles).toHaveBeenCalledTimes(1);
    // The row with an action and nothing to open is content: only its action takes focus.
    await expect(canvas.getAllByRole("button")).toHaveLength(2);
    await expectItemRowsFit(canvasElement);
  },
};
