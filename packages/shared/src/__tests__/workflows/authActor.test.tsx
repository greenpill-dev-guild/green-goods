/** @vitest-environment happy-dom */
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fromPromise } from "xstate";
import { useCrossTabSignOut } from "../../hooks/auth/useCrossTabSignOut";
import {
  AUTH_MODE_STORAGE_KEY,
  clearSessionForSignOut,
  setStoredWalletAddress,
} from "../../modules/auth/session";
import { getActorSignOutRevision, publishSignOut } from "../../modules/auth/sessionSignOut";
import { createAuthActor } from "../../workflows/authActor";
import type {
  PasskeyOperationInput,
  PasskeySessionResult,
  RestoreSessionInput,
  RestoreSessionResult,
} from "../../workflows/authMachine";

const wallet = "0x0000000000000000000000000000000000000001";
const actors: ReturnType<typeof createAuthActor>[] = [];
const services = {
  restoreSession: fromPromise<RestoreSessionResult | null, RestoreSessionInput>(async () => null),
  registerPasskey: fromPromise<PasskeySessionResult, PasskeyOperationInput>(
    () => new Promise(() => {})
  ),
  authenticatePasskey: fromPromise<PasskeySessionResult, PasskeyOperationInput>(
    () => new Promise(() => {})
  ),
};
beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  for (const actor of actors.splice(0)) actor.stop();
});
function makeActor() {
  const actor = createAuthActor(services);
  actors.push(actor);
  return actor;
}
function rememberWallet() {
  localStorage.setItem(AUTH_MODE_STORAGE_KEY, "wallet");
  setStoredWalletAddress(wallet);
}
function otherTabSignOut() {
  clearSessionForSignOut();
  publishSignOut();
}

it.each([
  "before-start",
  "after-start",
] as const)("rejects remembered wallet restoration when logout arrives %s before the provider", async (timing) => {
  rememberWallet();
  const actor = makeActor();
  if (timing === "before-start") otherTabSignOut();
  actor.start();
  await waitFor(() => expect(actor.getSnapshot().matches({ restoring: "wallet" })).toBe(true));
  if (timing === "after-start") otherTabSignOut();
  renderHook(() =>
    useCrossTabSignOut(() => actor.send({ type: "SIGN_OUT" }), getActorSignOutRevision(actor))
  );
  act(() => actor.send({ type: "RESTORE_TIMEOUT" }));
  expect(actor.getSnapshot().matches("unauthenticated")).toBe(true);
  expect(actor.getSnapshot().context.walletAddress).toBeNull();
});

it("does not interrupt an actor created after an already acknowledged logout", async () => {
  otherTabSignOut();
  const actor = makeActor();
  actor.start();
  const endSession = vi.fn();
  renderHook(() => useCrossTabSignOut(endSession, getActorSignOutRevision(actor)));
  await waitFor(() => expect(actor.getSnapshot().matches("unauthenticated")).toBe(true));
  expect(endSession).not.toHaveBeenCalled();
});

it("keeps a fresh deliberate wallet login when the provider remounts", async () => {
  const actor = makeActor();
  actor.start();
  await waitFor(() => expect(actor.getSnapshot().matches("unauthenticated")).toBe(true));
  const endSession = vi.fn(() => actor.send({ type: "SIGN_OUT" }));
  const hook = () => useCrossTabSignOut(endSession, getActorSignOutRevision(actor));
  const first = renderHook(hook);
  act(() => first.result.current.notifySignOut());
  act(() => {
    actor.send({ type: "EXTERNAL_WALLET_CONNECTED", address: wallet });
    actor.send({ type: "LOGIN_WALLET" });
  });
  first.unmount();
  renderHook(hook);
  expect(actor.getSnapshot().matches({ authenticated: "wallet" })).toBe(true);
  expect(endSession).not.toHaveBeenCalled();
});
