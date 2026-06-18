/**
 * @vitest-environment jsdom
 */

import { act, render, waitFor } from "@testing-library/react";
import { isValidElement, type ComponentProps } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Address, LeftSheetConfig } from "@green-goods/shared";
import { GardenSheetDescriptor } from "./GardenSheetDescriptor";

const { mockUseLeftSheetConfig } = vi.hoisted(() => ({
  mockUseLeftSheetConfig: vi.fn(),
}));

vi.mock("@green-goods/shared", () => ({
  useLeftSheetConfig: mockUseLeftSheetConfig,
}));

vi.mock("@/components/Garden/AddMemberSheet", () => ({
  AddMemberSheet: () => null,
}));

vi.mock("@/views/Garden/HypercertDetail", () => ({
  default: () => null,
}));

const GARDEN_A = "0x1111111111111111111111111111111111111111" as Address;
const GARDEN_B = "0x2222222222222222222222222222222222222222" as Address;

type DescriptorProps = ComponentProps<typeof GardenSheetDescriptor>;

function renderDescriptor(overrides: Partial<DescriptorProps> = {}) {
  const props: DescriptorProps = {
    hypercertId: undefined,
    closeTo: "/garden",
    addMemberOpen: true,
    onCloseAddMember: vi.fn(),
    gardenAddress: GARDEN_A,
    ...overrides,
  };

  return {
    props,
    view: render(
      <IntlProvider
        locale="en"
        messages={{
          "app.hypercerts.detail.title": "Hypercert",
          "cockpit.garden.action.addMember": "Add member",
        }}
      >
        <MemoryRouter>
          <GardenSheetDescriptor {...props} />
        </MemoryRouter>
      </IntlProvider>
    ),
  };
}

function getCurrentConfig(): LeftSheetConfig {
  const config = mockUseLeftSheetConfig.mock.calls.at(-1)?.[0] as LeftSheetConfig | null;
  expect(config).not.toBeNull();
  return config as LeftSheetConfig;
}

function getAddMemberSheetProps(config: LeftSheetConfig): {
  gardenAddress: Address;
  onClose: () => void;
  onRequestClose?: () => void;
  onSubmittingChange?: (submitting: boolean) => void;
} {
  expect(isValidElement(config.content)).toBe(true);
  return config.content.props as {
    gardenAddress: Address;
    onClose: () => void;
    onRequestClose?: () => void;
    onSubmittingChange?: (submitting: boolean) => void;
  };
}

describe("GardenSheetDescriptor add-member sheet", () => {
  beforeEach(() => {
    mockUseLeftSheetConfig.mockClear();
  });

  it("blocks add-member close paths while writes are submitting", () => {
    const onCloseAddMember = vi.fn();
    renderDescriptor({ onCloseAddMember });

    const sheetProps = getAddMemberSheetProps(getCurrentConfig());

    act(() => {
      sheetProps.onSubmittingChange?.(true);
    });

    expect(getCurrentConfig().preventClose).toBe(true);

    getCurrentConfig().onClose();
    expect(onCloseAddMember).not.toHaveBeenCalled();

    getAddMemberSheetProps(getCurrentConfig()).onRequestClose?.();
    expect(onCloseAddMember).not.toHaveBeenCalled();

    act(() => {
      sheetProps.onSubmittingChange?.(false);
    });

    expect(getCurrentConfig().preventClose).toBe(false);

    getAddMemberSheetProps(getCurrentConfig()).onRequestClose?.();
    expect(onCloseAddMember).toHaveBeenCalledTimes(1);
  });

  it("lets successful add-member writes close after the guarded submit phase", () => {
    const onCloseAddMember = vi.fn();
    renderDescriptor({ onCloseAddMember });

    const sheetProps = getAddMemberSheetProps(getCurrentConfig());

    act(() => {
      sheetProps.onSubmittingChange?.(true);
    });

    sheetProps.onClose();
    expect(onCloseAddMember).toHaveBeenCalledTimes(1);
  });

  it("prioritizes the one-click add-member sheet over an open hypercert sheet", () => {
    renderDescriptor({ hypercertId: "hc-1", addMemberOpen: true });

    expect(getCurrentConfig().title).toBe("Add member");
    expect(getAddMemberSheetProps(getCurrentConfig()).gardenAddress).toBe(GARDEN_A);
  });

  it("closes the idle add-member sheet when the selected garden changes", async () => {
    const onCloseAddMember = vi.fn();
    const { props, view } = renderDescriptor({ onCloseAddMember });

    expect(getAddMemberSheetProps(getCurrentConfig()).gardenAddress).toBe(GARDEN_A);

    view.rerender(
      <IntlProvider
        locale="en"
        messages={{
          "app.hypercerts.detail.title": "Hypercert",
          "cockpit.garden.action.addMember": "Add member",
        }}
      >
        <MemoryRouter>
          <GardenSheetDescriptor {...props} gardenAddress={GARDEN_B} />
        </MemoryRouter>
      </IntlProvider>
    );

    await waitFor(() => expect(onCloseAddMember).toHaveBeenCalledTimes(1));
  });

  it("closes the idle add-member sheet when the selected garden clears", async () => {
    const onCloseAddMember = vi.fn();
    const { props, view } = renderDescriptor({ onCloseAddMember });

    view.rerender(
      <IntlProvider
        locale="en"
        messages={{
          "app.hypercerts.detail.title": "Hypercert",
          "cockpit.garden.action.addMember": "Add member",
        }}
      >
        <MemoryRouter>
          <GardenSheetDescriptor {...props} gardenAddress={undefined} />
        </MemoryRouter>
      </IntlProvider>
    );

    await waitFor(() => expect(onCloseAddMember).toHaveBeenCalledTimes(1));
  });
});
