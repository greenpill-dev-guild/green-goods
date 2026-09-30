import { describe, expect, it } from "vitest";
import {
  registerExternalErrorReporter,
  type ExternalErrorReporterContext,
} from "../../../modules/app/external-error-reporters";
import { trackAuthError, trackContractError } from "../../../modules/app/error-categories";

describe("auth error tracking", () => {
  it("redacts sensitive auth error details before forwarding generic error telemetry", () => {
    const walletAddress = "0x1111111111111111111111111111111111111111";
    const credentialId = "dGVzdC1jcmVkZW50aWFsLWlk";
    const secretApiKey = "secret-pimlico-key";
    const calls: Array<{ error: Error; context: ExternalErrorReporterContext }> = [];
    const unregister = registerExternalErrorReporter((error, context) => {
      calls.push({ error, context });
    });

    try {
      const cause = new Error(
        `GET https://api.pimlico.io/v2/42161/rpc?apikey=${secretApiKey} failed credentialId=${credentialId}`
      );
      const error = new Error(
        `Passkey recovery failed for walletAddress=${walletAddress} at https://api.pimlico.io/v2/42161/rpc?apikey=${secretApiKey}`
      );
      (error as Error & { cause?: unknown }).cause = cause;

      trackAuthError(error, {
        source: "Login.handleAuthError",
        userAction: "recover with passkey",
        authMode: "passkey",
        metadata: {
          credentialId,
          walletAddress,
          recoveryUrl: `https://api.pimlico.io/v2/42161/rpc?apikey=${secretApiKey}`,
        },
      });
    } finally {
      unregister();
    }

    expect(calls).toHaveLength(1);
    const serialized = JSON.stringify({
      message: calls[0]?.error.message,
      stack: calls[0]?.error.stack,
      metadata: calls[0]?.context.metadata,
    });

    expect(serialized).not.toContain(walletAddress);
    expect(serialized).not.toContain(credentialId);
    expect(serialized).not.toContain(secretApiKey);
    expect(serialized).not.toContain("apikey=");
    expect(serialized).toContain("[REDACTED]");
  });
});

describe("contract error tracking", () => {
  it("redacts the signer address from a viem wallet error while keeping the garden address", () => {
    // viem prints the signer in the request arguments of wallet errors. Redaction
    // used to be gated to the auth category, so contract telemetry leaked it.
    const signerAddress = "0x2222222222222222222222222222222222222222";
    const gardenAddress = "0x3333333333333333333333333333333333333333";
    const calls: Array<{ error: Error; context: ExternalErrorReporterContext }> = [];
    const unregister = registerExternalErrorReporter((error, context) => {
      calls.push({ error, context });
    });

    try {
      trackContractError(
        new Error(
          `An unknown RPC error occurred.\n\nRequest Arguments:\n  from: ${signerAddress}\n  to: ${gardenAddress}`
        ),
        {
          source: "useJoinGarden",
          gardenAddress,
          authMode: "wallet",
          userAction: "joining garden",
        }
      );
    } finally {
      unregister();
    }

    expect(calls).toHaveLength(1);
    const serialized = JSON.stringify({
      message: calls[0]?.error.message,
      stack: calls[0]?.error.stack,
      metadata: calls[0]?.context.metadata,
    });

    expect(serialized).not.toContain(signerAddress);
    expect(serialized).toContain("[REDACTED_WALLET]");
    // The structured garden address is a public contract address and is tracked
    // deliberately — redaction must not swallow it.
    expect(calls[0]?.context.gardenAddress).toBe(gardenAddress);
  });
});
