import { act, cleanup, render } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../../shared/src/i18n/en.json";

const TEST_ADDRESS = "0x1234567890abcdef1234567890abcdef12345678";

const sharedMocks = vi.hoisted(() => ({
  toastInfo: vi.fn(),
  useGreenGoodsEnsName: vi.fn(),
  usePrimaryAddress: vi.fn(),
  useProtocolMemberStatus: vi.fn(),
}));

vi.mock("@green-goods/shared", () => ({
  toastService: {
    info: sharedMocks.toastInfo,
  },
  useGreenGoodsEnsName: sharedMocks.useGreenGoodsEnsName,
  usePrimaryAddress: sharedMocks.usePrimaryAddress,
  useProtocolMemberStatus: sharedMocks.useProtocolMemberStatus,
  useTimeout: () => ({
    set: (callback: () => void, delay: number) => {
      const id = setTimeout(callback, delay);
      return () => clearTimeout(id);
    },
    clear: () => {},
    isPending: () => false,
  }),
}));

import { ENSClaimReminder } from "../../routes/ENSClaimReminder";

const wrap = (el: React.ReactElement) =>
  createElement(MemoryRouter, null, createElement(IntlProvider, { locale: "en", messages }, el));

describe("ENSClaimReminder", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    localStorage.clear();

    sharedMocks.usePrimaryAddress.mockReturnValue(TEST_ADDRESS);
    sharedMocks.useProtocolMemberStatus.mockReturnValue({ data: true, isLoading: false });
    sharedMocks.useGreenGoodsEnsName.mockReturnValue({ data: null, isLoading: false });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    localStorage.clear();
  });

  it("shows a one-time claim reminder for protocol members without a username", async () => {
    render(wrap(createElement(ENSClaimReminder)));

    expect(
      localStorage.getItem(`greengoods_ens_claim_reminder_shown:${TEST_ADDRESS.toLowerCase()}`)
    ).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(sharedMocks.toastInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "ens-claim-reminder",
        title: "Claim your username",
        action: expect.objectContaining({ label: "Claim username" }),
      })
    );

    expect(
      localStorage.getItem(`greengoods_ens_claim_reminder_shown:${TEST_ADDRESS.toLowerCase()}`)
    ).toBe("true");
  });

  it("does not show when the address already has a Green Goods ENS name", () => {
    sharedMocks.useGreenGoodsEnsName.mockReturnValue({
      data: "river.greengoods.eth",
      isLoading: false,
    });

    render(wrap(createElement(ENSClaimReminder)));

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(sharedMocks.toastInfo).not.toHaveBeenCalled();
  });

  it("does not show again after the reminder was seen for the address", () => {
    localStorage.setItem(
      `greengoods_ens_claim_reminder_shown:${TEST_ADDRESS.toLowerCase()}`,
      "true"
    );

    render(wrap(createElement(ENSClaimReminder)));

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(sharedMocks.toastInfo).not.toHaveBeenCalled();
  });
});
