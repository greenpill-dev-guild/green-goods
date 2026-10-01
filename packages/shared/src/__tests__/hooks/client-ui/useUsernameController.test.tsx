/**
 * @vitest-environment happy-dom
 */

/**
 * The Username card's controller (PRD-1026 D6): a change is a release now and
 * a claim once it clears, with the new name kept on this device in between.
 * Only a release that landed is remembered, and a claim that doesn't land
 * leaves the change open. The release and claim hooks are stand-ins; their
 * sends are proven under their own tests.
 */

import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUsernameController } from "../../../hooks/client-ui/profile/useUsernameController";
import { useUsernameChangeStore } from "../../../stores/useUsernameChangeStore";
import type { Address, ENSRegistrationData } from "../../../types/domain";
import { renderHookWithProviders } from "../../test-utils/render-helpers";

const OWNER = "0x1111111111111111111111111111111111111111" as Address;

const mocks = vi.hoisted(() => ({
  name: null as string | null,
  status: {} as Record<string, ENSRegistrationData | undefined>,
  free: {} as Record<string, boolean | undefined>,
  release: vi.fn(),
  claim: vi.fn(),
  auth: { authMode: "wallet" as "wallet" | "passkey", userName: null as string | null },
  walletEnsName: null as string | null,
}));

vi.mock("../../../hooks/app/useOnlineStatus", () => ({ useOnlineStatus: () => true }));
vi.mock("../../../hooks/auth/useAuth", () => ({ useAuthState: () => mocks.auth }));
vi.mock("../../../hooks/blockchain/useEnsName", () => ({
  useEnsName: () => ({ data: mocks.walletEnsName }),
}));
vi.mock("../../../hooks/ens/useProtocolMemberStatus", () => ({
  useProtocolMemberStatus: () => ({ data: true, isLoading: false }),
}));
vi.mock("../../../hooks/ens/useGreenGoodsEnsName", () => ({
  useGreenGoodsEnsName: () => ({ data: mocks.name, isLoading: false }),
}));
vi.mock("../../../hooks/ens/useENSRegistrationStatus", () => ({
  useENSRegistrationStatus: (slug?: string) => ({
    data: slug ? mocks.status[slug] : undefined,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
}));
vi.mock("../../../hooks/ens/useSlugAvailability", () => ({
  useSlugAvailability: (slug?: string) => ({
    data: slug ? mocks.free[slug] : undefined,
    isFetching: false,
  }),
}));
vi.mock("../../../hooks/ens/useENSReleaseName", () => ({
  useENSReleaseName: () => ({
    mutateAsync: mocks.release,
    isPending: false,
    isSponsoredReleaseUnavailable: false,
  }),
}));
vi.mock("../../../hooks/ens/useENSClaim", () => ({
  useENSClaim: () => ({ mutateAsync: mocks.claim, isPending: false }),
}));

const change = () => useUsernameChangeStore.getState().changes[OWNER.toLowerCase()];
const render = () => renderHookWithProviders(() => useUsernameController(OWNER));

beforeEach(() => {
  mocks.name = "ines.greengoods.eth";
  mocks.status = {
    ines: { status: "active", registration: { owner: OWNER, nameType: 0, registeredAt: "1" } },
  };
  mocks.free = {};
  mocks.release.mockReset();
  mocks.claim.mockReset();
  mocks.auth = { authMode: "wallet", userName: null };
  mocks.walletEnsName = null;
  useUsernameChangeStore.setState({ changes: {}, notices: {} });
});

describe("useUsernameController", () => {
  it("tells the service worker once a name claimed before a reload is ready", async () => {
    const postMessage = vi.fn();
    Object.defineProperty(navigator, "serviceWorker", {
      value: { controller: { postMessage } },
      configurable: true,
    });
    // Claimed on this device, then the app reloaded while it set up.
    useUsernameChangeStore.getState().awaitNotice(OWNER, "ines");

    const { result, rerender } = render();

    await waitFor(() => expect(postMessage).toHaveBeenCalledTimes(1));
    expect(postMessage).toHaveBeenCalledWith({ type: "ENS_REGISTRATION_COMPLETE", slug: "ines" });
    expect(result.current.card.kind).toBe("ready");
    expect(useUsernameChangeStore.getState().notices).toEqual({});
    rerender();
    expect(postMessage).toHaveBeenCalledTimes(1);
  });

  it("keeps the notice until a service worker controls the page, then tells it once", async () => {
    const postMessage = vi.fn();
    // Loaded before the worker took over: there is no controller to tell yet.
    const container = Object.assign(new EventTarget(), {
      controller: null as { postMessage: typeof postMessage } | null,
    });
    Object.defineProperty(navigator, "serviceWorker", { value: container, configurable: true });
    useUsernameChangeStore.getState().awaitNotice(OWNER, "ines");

    const { result } = render();

    await waitFor(() => expect(result.current.card.kind).toBe("ready"));
    expect(useUsernameChangeStore.getState().notices).toEqual({ [OWNER.toLowerCase()]: "ines" });

    container.controller = { postMessage };
    act(() => {
      container.dispatchEvent(new Event("controllerchange"));
    });

    await waitFor(() => expect(postMessage).toHaveBeenCalledTimes(1));
    expect(useUsernameChangeStore.getState().notices).toEqual({});
  });

  it("keeps the new name only once the release has landed", async () => {
    mocks.release.mockImplementation(async () => {
      // The release hook seeds the old name's status as releasing.
      mocks.status.ines = { status: "pending", release: { owner: OWNER } };
      return { slug: "ines", owner: OWNER, submittedAt: 5, ccipMessageId: null, txHash: "0x1" };
    });
    const { result } = render();
    expect(result.current.card).toEqual({ kind: "ready", slug: "ines" });

    await act(() => result.current.acts.startChange("ines-duarte"));

    expect(change()).toEqual({ from: "ines", to: "ines-duarte", releasedAt: 5 });
    expect(result.current.card).toEqual({ kind: "releasing", from: "ines", to: "ines-duarte" });
  });

  it("remembers nothing when the release doesn't land, and says so to the sheet", async () => {
    mocks.release.mockRejectedValue(new Error("User rejected the request"));
    const { result } = render();

    await expect(act(() => result.current.acts.startChange("ines-duarte"))).rejects.toThrow(
      "User rejected"
    );
    expect(change()).toBeUndefined();
    expect(result.current.card.kind).toBe("ready");
  });

  it("claims the new name once the old one cleared, then follows it as it sets up", async () => {
    mocks.name = null;
    mocks.status.ines = { status: "available", release: { owner: OWNER } };
    mocks.free["ines-duarte"] = true;
    useUsernameChangeStore
      .getState()
      .begin(OWNER, { from: "ines", to: "ines-duarte", releasedAt: 5 });
    mocks.claim.mockImplementation(async ({ slug }: { slug: string }) => {
      mocks.status[slug] = { status: "pending", submittedAt: 9 };
      return { slug, ccipMessageId: null, submittedAt: 9, txHash: "0x2" };
    });
    const { result } = render();
    expect(result.current.card).toEqual({ kind: "claimable", to: "ines-duarte" });

    let landed = false;
    await act(async () => {
      landed = await result.current.acts.claim("ines-duarte");
    });

    expect(landed).toBe(true);
    expect(mocks.claim).toHaveBeenCalledWith({ slug: "ines-duarte" });
    expect(change()).toBeUndefined();
    expect(result.current.card).toEqual({
      kind: "setting-up",
      slug: "ines-duarte",
      claimedHere: true,
    });
  });

  it("keeps the change open when the claim doesn't land", async () => {
    mocks.name = null;
    mocks.status.ines = { status: "available", release: { owner: OWNER } };
    useUsernameChangeStore
      .getState()
      .begin(OWNER, { from: "ines", to: "ines-duarte", releasedAt: 5 });
    mocks.claim.mockRejectedValue(new Error("User rejected the request"));
    const { result } = render();

    let landed = true;
    await act(async () => {
      landed = await result.current.acts.claim("ines-duarte");
    });

    expect(landed).toBe(false);
    expect(change()?.to).toBe("ines-duarte");
    expect(result.current.card).toEqual({ kind: "claimable", to: "ines-duarte" });
  });

  it("clears only the new name on Choose Another, and asks for one", () => {
    mocks.name = null;
    mocks.status.ines = { status: "available", release: { owner: OWNER } };
    useUsernameChangeStore
      .getState()
      .begin(OWNER, { from: "ines", to: "ines-duarte", releasedAt: 5 });
    const { result } = render();

    act(() => result.current.acts.chooseAnother());

    expect(change()).toEqual({ from: "ines", to: null, releasedAt: 5 });
    expect(result.current.card).toEqual({ kind: "choose", after: "released", taken: null });
  });

  it.each([
    ["the username chosen for the passkey", "passkey", "Maya K", null, "maya-k"],
    ["the wallet's ENS label", "passkey", "user_1726850000", "maya.eth", "maya"],
    ["nothing when the account has no name", "passkey", "user_1726850000", null, ""],
    // Auth keeps the last passkey username after a switch to a wallet.
    ["the wallet's label over an earlier passkey username", "wallet", "Maya K", "afo.eth", "afo"],
  ] as const)("starts a first claim from %s", (_, authMode, userName, walletEnsName, suggested) => {
    mocks.name = null;
    mocks.auth = { authMode, userName };
    mocks.walletEnsName = walletEnsName;
    const { result } = render();

    expect(result.current.card).toEqual({ kind: "choose", after: "none", taken: null });
    expect(result.current.form.typed).toBe(suggested);
  });

  it("drops a change once the account holds some other name", async () => {
    mocks.name = "ines-d.greengoods.eth";
    mocks.status["ines-d"] = {
      status: "active",
      registration: { owner: OWNER, nameType: 0, registeredAt: "2" },
    };
    useUsernameChangeStore
      .getState()
      .begin(OWNER, { from: "ines", to: "ines-duarte", releasedAt: 5 });
    const { result } = render();

    await waitFor(() => expect(change()).toBeUndefined());
    expect(result.current.card).toEqual({ kind: "ready", slug: "ines-d" });
  });
});
