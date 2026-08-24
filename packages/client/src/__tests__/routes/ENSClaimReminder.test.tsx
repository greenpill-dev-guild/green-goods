import { act, cleanup, render } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@green-goods/shared/i18n/en.json";

const TEST_ADDRESS = "0x1234567890abcdef1234567890abcdef12345678";

const sharedMocks = vi.hoisted(() => ({
  toastInfo: vi.fn(),
  useGreenGoodsEnsName: vi.fn(),
  usePrimaryAddress: vi.fn(),
  useProtocolMemberStatus: vi.fn(),
}));

vi.mock("@green-goods/shared/components/Toast/toast.service", () => ({
  toastService: {
    info: sharedMocks.toastInfo,
  },
}));

vi.mock("@green-goods/shared/hooks/ens/useGreenGoodsEnsName", () => ({
  useGreenGoodsEnsName: sharedMocks.useGreenGoodsEnsName,
}));

vi.mock("@green-goods/shared/hooks/auth/usePrimaryAddress", () => ({
  usePrimaryAddress: sharedMocks.usePrimaryAddress,
}));

vi.mock("@green-goods/shared/hooks/ens/useProtocolMemberStatus", () => ({
  useProtocolMemberStatus: sharedMocks.useProtocolMemberStatus,
}));

vi.mock("@green-goods/shared/hooks/utils/useTimeout", () => ({
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
        title: "Claim your Green Goods name",
        action: expect.objectContaining({ label: "Claim name" }),
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
