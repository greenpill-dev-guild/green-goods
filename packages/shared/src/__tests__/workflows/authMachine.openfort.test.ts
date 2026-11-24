/**
 * Email sessions in the auth machine: sign-in by code, restore from the device's record,
 * and sign-out, each kept apart from passkey sessions.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { createActor, fromPromise } from "xstate";
import { createSmartAccountClientResolver } from "../../modules/auth/smartAccountClientResolver";
import type {
  OpenfortOperationInput,
  OpenfortSessionResult,
} from "../../workflows/auth-openfort-session";
import {
  authMachine,
  type AuthInput,
  type PasskeyOperationInput,
  type PasskeySessionResult,
  type RestoreSessionInput,
  type RestoreSessionResult,
} from "../../workflows/authMachine";
import { MOCK_ADDRESSES } from "../test-utils/mock-factories";

/** Let the invoked actors settle; no React here, so no render helpers. */
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

const CHAIN_ID = 42161;
const EMAIL = "gardener@example.com";

function openfortSession(): OpenfortSessionResult {
  const client = {
    account: { address: MOCK_ADDRESSES.smartAccount },
    chain: { id: CHAIN_ID },
  } as any;
  return {
    smartAccountClient: client,
    resolveSmartAccountClient: createSmartAccountClientResolver({
      credential: MOCK_ADDRESSES.user,
      primaryClient: client,
      primaryChainId: CHAIN_ID,
      expectedAddress: MOCK_ADDRESSES.smartAccount as `0x${string}`,
      buildSmartAccount: async () => ({
        client,
        address: MOCK_ADDRESSES.smartAccount as `0x${string}`,
      }),
    }),
    smartAccountAddress: MOCK_ADDRESSES.smartAccount as `0x${string}`,
    userName: EMAIL,
    method: "email",
  };
}

function start(
  services: {
    authenticateOpenfort?: (input: OpenfortOperationInput) => Promise<OpenfortSessionResult>;
    restoreOpenfort?: () => Promise<OpenfortSessionResult | null>;
    restoreSession?: () => Promise<null>;
  } = {},
  input: AuthInput = { chainId: CHAIN_ID }
) {
  const authenticate = vi.fn(services.authenticateOpenfort ?? (async () => openfortSession()));
  const restore = vi.fn(services.restoreOpenfort ?? (async () => null));
  const machine = authMachine.provide({
    actors: {
      restoreSession: fromPromise<RestoreSessionResult | null, RestoreSessionInput>(
        services.restoreSession ?? (async () => null)
      ),
      registerPasskey: fromPromise<PasskeySessionResult, PasskeyOperationInput>(async () => {
        throw new Error("no passkey in these tests");
      }),
      authenticatePasskey: fromPromise<PasskeySessionResult, PasskeyOperationInput>(async () => {
        throw new Error("no passkey in these tests");
      }),
      authenticateOpenfort: fromPromise(({ input }: { input: OpenfortOperationInput }) =>
        authenticate(input)
      ),
      restoreOpenfort: fromPromise(() => restore()),
    },
  });
  const actor = createActor(machine, { input });
  actor.start();
  return { actor, authenticate, restore };
}

const login = {
  type: "LOGIN_OPENFORT",
  email: EMAIL,
  code: "123456",
} as const;

describe("auth machine: email sessions", () => {
  let stop: (() => void) | undefined;
  afterEach(() => stop?.());

  it("signs in with a code and opens the smart account the wallet owns", async () => {
    const { actor, authenticate } = start();
    stop = () => actor.stop();
    await flushPromises();
    actor.send(login);
    expect(actor.getSnapshot().matches("authenticating_openfort")).toBe(true);
    await flushPromises();

    expect(authenticate).toHaveBeenCalledWith({
      email: EMAIL,
      code: "123456",
      chainId: CHAIN_ID,
    });
    const snapshot = actor.getSnapshot();
    expect(snapshot.matches({ authenticated: "openfort" })).toBe(true);
    expect(snapshot.context.smartAccountAddress).toBe(MOCK_ADDRESSES.smartAccount);
    expect(snapshot.context.userName).toBe(EMAIL);
    expect(snapshot.context.openfortMethod).toBe("email");
    // No passkey identity rides along with an email session.
    expect(snapshot.context.credential).toBeNull();
    expect(snapshot.context.passkeyAccountProfile).toBeNull();
  });

  it("lands a refused code in the error state, and a new code can be tried from there", async () => {
    let attempt = 0;
    const { actor } = start({
      authenticateOpenfort: async () => {
        attempt += 1;
        if (attempt === 1) throw new Error("Invalid code");
        return openfortSession();
      },
    });
    stop = () => actor.stop();
    await flushPromises();
    actor.send(login);
    await flushPromises();
    expect(actor.getSnapshot().matches("error")).toBe(true);
    expect(actor.getSnapshot().context.error?.message).toBe("Invalid code");

    // Retrying a spent code would fail again; RETRY returns to the sign-in choices.
    actor.send({ type: "RETRY" });
    expect(actor.getSnapshot().matches("unauthenticated")).toBe(true);

    actor.send({ ...login, code: "654321" });
    await flushPromises();
    expect(actor.getSnapshot().matches({ authenticated: "openfort" })).toBe(true);
  });

  it.each([
    ["a wallet", "wallet"],
    ["an embedded wallet", "embedded"],
  ] as const)("forgets a refused email attempt once the person signs in with %s", async (_, kind) => {
    const { actor } = start({
      authenticateOpenfort: async () => {
        throw new Error("Invalid code");
      },
    });
    stop = () => actor.stop();
    await flushPromises();
    actor.send(login);
    await flushPromises();
    expect(actor.getSnapshot().context.openfortMethod).toBe("email");

    const address = MOCK_ADDRESSES.user as `0x${string}`;
    if (kind === "wallet") {
      actor.send({ type: "EXTERNAL_WALLET_CONNECTED", address });
      actor.send({ type: "LOGIN_WALLET" });
    } else {
      actor.send({ type: "LOGIN_EMBEDDED", address });
    }
    expect(actor.getSnapshot().matches({ authenticated: kind })).toBe(true);
    // This session is not an email one: its sign-out must not reach for Openfort.
    expect(actor.getSnapshot().context.openfortMethod).toBeNull();
  });

  it("reopens a saved email session at startup instead of a passkey on the same phone", async () => {
    const restoreSession = vi.fn(async () => null);
    const { actor, restore } = start(
      { restoreOpenfort: async () => openfortSession(), restoreSession },
      { chainId: CHAIN_ID, restoreAuthMode: "openfort" }
    );
    stop = () => actor.stop();
    await flushPromises();
    await flushPromises();
    expect(restore).toHaveBeenCalledTimes(1);
    expect(actor.getSnapshot().matches({ authenticated: "openfort" })).toBe(true);
  });

  it("starts signed out when the saved email session is gone", async () => {
    const { actor } = start(
      { restoreOpenfort: async () => null },
      { chainId: CHAIN_ID, restoreAuthMode: "openfort" }
    );
    stop = () => actor.stop();
    await flushPromises();
    await flushPromises();
    expect(actor.getSnapshot().matches("unauthenticated")).toBe(true);
  });

  it("signs out to nothing: the account, its client and its resolver all go", async () => {
    const { actor } = start();
    stop = () => actor.stop();
    await flushPromises();
    actor.send(login);
    await flushPromises();
    const resolver = actor.getSnapshot().context.resolveSmartAccountClient!;

    actor.send({ type: "SIGN_OUT" });
    const { context } = actor.getSnapshot();
    expect(actor.getSnapshot().matches("unauthenticated")).toBe(true);
    expect(context.smartAccountAddress).toBeNull();
    expect(context.smartAccountClient).toBeNull();
    expect(context.userName).toBeNull();
    expect(context.openfortMethod).toBeNull();
    await expect(resolver(CHAIN_ID)).rejects.toThrow("session_expired");
  });

  it("drops a sign-in that finishes after the person signed out", async () => {
    let finish!: (session: OpenfortSessionResult) => void;
    const { actor } = start({
      authenticateOpenfort: () => new Promise((resolve) => (finish = resolve)),
    });
    stop = () => actor.stop();
    await flushPromises();
    actor.send(login);
    actor.send({ type: "SIGN_OUT" });
    finish(openfortSession());
    await flushPromises();
    expect(actor.getSnapshot().matches("unauthenticated")).toBe(true);
    expect(actor.getSnapshot().context.smartAccountAddress).toBeNull();
  });
});
