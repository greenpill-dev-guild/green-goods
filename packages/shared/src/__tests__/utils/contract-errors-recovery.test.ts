/**
 * Tests for contract error recovery fields
 *
 * @vitest-environment happy-dom
 */

import { ChainNotConfiguredError, ConnectorChainMismatchError } from "@wagmi/core";
import { ChainMismatchError, SwitchChainError, UserRejectedRequestError } from "viem";
import { arbitrum } from "viem/chains";
import { describe, expect, it, vi } from "vitest";

// The chain guard is imported for the error it throws; nothing here reaches a wallet.
vi.mock("../../config/appkit", () => ({ getWagmiConfig: vi.fn(), peekAppKit: () => null }));
vi.mock("../../modules/app/walletNetworkSwitchAnalytics", () => ({
  trackWalletNetworkSwitch: vi.fn(),
}));

import en from "../../i18n/en.json";
import es from "../../i18n/es.json";
import pt from "../../i18n/pt.json";
import { WalletChainMismatchError } from "../../modules/transactions/chain-guard";
import { parseAndFormatError, parseContractError } from "../../utils/errors/contract-errors";
import { classifyTxError, isCancelledTxError } from "../../utils/errors/tx-error-classifier";

describe("contract error recovery fields", () => {
  describe("recoverable field", () => {
    it("should mark NotGardenMember as not recoverable", () => {
      const result = parseContractError("0x8cb4ae3b");
      expect(result.recoverable).toBe(false);
      expect(result.suggestedAction).toBe("join-garden");
    });

    it("should mark EmptyRevert as recoverable", () => {
      const result = parseContractError("0x");
      expect(result.recoverable).toBe(true);
      expect(result.suggestedAction).toBe("retry");
    });

    it("should mark unknown errors as recoverable (transient)", () => {
      const result = parseContractError("Some random error");
      expect(result.recoverable).toBe(true);
      expect(result.suggestedAction).toBe("retry");
    });

    it("should mark network errors as recoverable", () => {
      const result = parseContractError(new Error("Network connection failed"));
      expect(result.recoverable).toBe(true);
      expect(result.suggestedAction).toBe("retry");
      expect(result.name).toBe("NetworkError");
    });

    it("should mark timeout errors as recoverable", () => {
      const result = parseContractError(new Error("Request timeout"));
      expect(result.recoverable).toBe(true);
      expect(result.suggestedAction).toBe("retry");
      // Timeout was previously bundled into NetworkError; the consolidated
      // classifier splits it out so callers can distinguish (e.g. timeout-
      // specific UX like "still processing" vs network "lost connection").
      expect(result.name).toBe("TimeoutError");
    });

    it("should mark user rejection as recoverable", () => {
      const result = parseContractError(new Error("User rejected the request"));
      expect(result.recoverable).toBe(true);
      expect(result.suggestedAction).toBe("retry");
      expect(result.name).toBe("UserRejected");
    });

    it("should mark permission errors as not recoverable", () => {
      // 0xd8cae624 = keccak256("NotGardenOwner()")[0:4]
      const result = parseContractError("0xd8cae624");
      expect(result.recoverable).toBe(false);
      expect(result.suggestedAction).toBe("contact-support");
    });
  });

  describe("suggestedAction field", () => {
    it("should suggest join-garden for membership errors", () => {
      // Test both legacy and current selectors
      expect(parseContractError("0x8cb4ae3b").suggestedAction).toBe("join-garden"); // Legacy (NotGardenerAccount)
      expect(parseContractError("0xfdb31dd5").suggestedAction).toBe("join-garden"); // Current (NotGardenMember)
    });

    it("should suggest contact-support for permission errors", () => {
      expect(parseContractError("0xd8cae624").suggestedAction).toBe("contact-support"); // NotGardenOwner
      expect(parseContractError("0xf3aeae14").suggestedAction).toBe("contact-support"); // NotGardenOperator
      expect(parseContractError("0xdb926eba").suggestedAction).toBe("contact-support"); // InvalidInvite
    });

    it("should suggest retry for transient errors", () => {
      expect(parseContractError("Some unknown error").suggestedAction).toBe("retry");
      expect(parseContractError(new Error("Network error")).suggestedAction).toBe("retry");
    });
  });

  describe("known errors with recovery info", () => {
    const testCases: Array<{
      signature: string;
      expectedName: string;
      expectedRecoverable: boolean;
      expectedSuggestedAction?: string;
    }> = [
      {
        signature: "0x8cb4ae3b", // Legacy selector (NotGardenerAccount)
        expectedName: "NotGardenMember",
        expectedRecoverable: false,
        expectedSuggestedAction: "join-garden",
      },
      {
        signature: "0xd8cae624", // keccak256("NotGardenOwner()")[0:4]
        expectedName: "NotGardenOwner",
        expectedRecoverable: false,
        expectedSuggestedAction: "contact-support",
      },
      {
        signature: "0x42375a1e",
        expectedName: "AlreadyGardener",
        expectedRecoverable: false,
        // No suggested action - informational error
      },
      {
        signature: "0x2ff9aed3",
        expectedName: "NotActiveAction",
        expectedRecoverable: false,
        // No suggested action - need to select different action
      },
      {
        signature: "0xf3aeae14", // keccak256("NotGardenOperator()")[0:4]
        expectedName: "NotGardenOperator",
        expectedRecoverable: false,
        expectedSuggestedAction: "contact-support",
      },
    ];

    testCases.forEach(
      ({ signature, expectedName, expectedRecoverable, expectedSuggestedAction }) => {
        it(`should parse ${expectedName} correctly`, () => {
          const result = parseContractError(signature);
          expect(result.name).toBe(expectedName);
          expect(result.recoverable).toBe(expectedRecoverable);
          expect(result.isKnown).toBe(true);
          if (expectedSuggestedAction) {
            expect(result.suggestedAction).toBe(expectedSuggestedAction);
          }
        });
      }
    );
  });

  describe("error object handling", () => {
    it("should handle error objects with message property", () => {
      const errorObj = { message: "User rejected the request", code: 4001 };
      const result = parseContractError(errorObj);
      expect(result.name).toBe("UserRejected");
      expect(result.recoverable).toBe(true);
    });

    it("should handle nested error messages", () => {
      const error = new Error("Connection timeout occurred");
      const result = parseContractError(error);
      expect(result.recoverable).toBe(true);
      expect(result.suggestedAction).toBe("retry");
    });
  });

  describe("a failed wallet send, and the queue's own refusal", () => {
    const ARBITRUM = 42161;
    const CELO = 42220;
    const walletDeclined = new UserRejectedRequestError(new Error("User rejected the request."));

    // What PostHog logged on beta build c4a948735 (2026-10-01): the first send of a
    // request, then the form's second press. Both read as a connection problem.
    const loggedMismatch = new ConnectorChainMismatchError({
      connectionChainId: ARBITRUM,
      connectorChainId: CELO,
    }).message;
    const loggedConflict =
      "offline_job_identity_conflict:commitment:5f0c7a1e-2b3d-4c5e-8f90-a1b2c3d4e5f6";

    it("reads the logged network mismatch as a wrong network, not a lost connection", () => {
      expect(loggedMismatch).toContain("connection's chain");
      const { title, message, parsed } = parseAndFormatError(new Error(loggedMismatch));

      expect(parsed.name).toBe("WalletOnAnotherNetwork");
      expect(title).toBe("Wallet On Another Network");
      // wagmi gives only chain ids, and naming one would load the chain table,
      // and viem with it, wherever this parser ships. So this one says no name.
      expect(message).toBe(
        "Your wallet is on a different network than this needs. Switch networks in your wallet, then try again."
      );
      // The inline classifier reads the same text the same way.
      expect(classifyTxError(loggedMismatch).kind).toBe("wrongChain");
    });

    it("reads the queue's refusal as an earlier version still queued, never as offline", () => {
      const { message, parsed } = parseAndFormatError(new Error(loggedConflict));

      expect(parsed.name).toBe("EarlierVersionQueued");
      expect(parsed.recoverable).toBe(false);
      expect(message).toMatch(/earlier version .* still on this phone/);
      // The queue names an act by a hex key too; that is never a contract's error code.
      expect(
        parseContractError(`offline_job_identity_conflict:workLink:0x${"ab".repeat(32)}`).name
      ).toBe("EarlierVersionQueued");
    });

    it.each([
      [
        "a declined switch",
        new WalletChainMismatchError({
          targetChainId: ARBITRUM,
          walletChainId: CELO,
          outcome: "rejected",
          cause: walletDeclined,
        }),
      ],
      [
        "a switch already waiting in the wallet",
        new WalletChainMismatchError({ targetChainId: ARBITRUM, outcome: "pending" }),
      ],
      [
        "a network the wallet does not have",
        new WalletChainMismatchError({ targetChainId: ARBITRUM, outcome: "unknown_network" }),
      ],
      [
        "a switch that left the wallet where it was",
        new WalletChainMismatchError({
          targetChainId: ARBITRUM,
          walletChainId: CELO,
          outcome: "unconfirmed",
        }),
      ],
      ["viem's own refusal", new ChainMismatchError({ chain: arbitrum, currentChainId: CELO })],
    ])("reads %s as a wrong network that names Arbitrum One", (_case, error) => {
      // The chain guard and viem throw the error; the job queue keeps only its message.
      for (const seen of [error, new Error(error.message)]) {
        const parsed = parseContractError(seen);
        expect(parsed.name).toBe("WalletOnAnotherNetwork");
        expect(parsed.messageKey).toBe("app.errors.wallet.wrongNetwork.message");
        expect(parsed.messageValues).toEqual({ network: "Arbitrum One" });
      }
    });

    it("never reads a declined network switch as a cancelled transaction", () => {
      const declinedSwitch = new SwitchChainError(walletDeclined);
      expect(declinedSwitch.message).toContain("User rejected the request");

      expect(parseContractError(declinedSwitch).name).toBe("WalletOnAnotherNetwork");
      // A declined signature still does, and the queue drops only that one.
      expect(parseContractError(walletDeclined).name).toBe("UserRejected");
      const kept = new WalletChainMismatchError({ targetChainId: ARBITRUM, outcome: "rejected" });
      expect(isCancelledTxError(kept.message)).toBe(false);
      expect(isCancelledTxError(walletDeclined.message)).toBe(true);
    });

    it("says so without a name when the failure does not say which network", () => {
      for (const error of [new ChainNotConfiguredError(), new Error("Unsupported chain")]) {
        const parsed = parseContractError(error);
        expect(parsed.name).toBe("WalletOnAnotherNetwork");
        expect(parsed.messageKey).toBe("app.errors.wallet.wrongNetwork.messageUnnamed");
        expect(parsed.messageValues).toBeUndefined();
      }
    });

    it("keeps a lost connection and an offline phone as what they are", () => {
      expect(parseContractError(new Error("Failed to fetch")).name).toBe("NetworkError");
      expect(parseContractError(new Error("You are offline")).name).toBe("Offline");
    });

    it("names copy that exists in every language, and falls back to the same English", () => {
      const declinedSwitch = new WalletChainMismatchError({
        targetChainId: ARBITRUM,
        outcome: "rejected",
      });
      const parsedErrors = [
        parseContractError(loggedMismatch),
        parseContractError(declinedSwitch.message),
        parseContractError(loggedConflict),
        parseContractError("You are offline"),
      ];
      for (const parsed of parsedErrors) {
        for (const key of [parsed.titleKey, parsed.messageKey]) {
          expect(key).toBeDefined();
          for (const catalog of [en, es, pt] as Record<string, string>[]) {
            expect(catalog[key as string], key).toEqual(expect.any(String));
          }
        }
        const english = (en as Record<string, string>)[parsed.messageKey as string];
        expect(parsed.message).toBe(
          english.replace("{network}", parsed.messageValues?.network ?? "")
        );
      }
    });
  });

  describe("validation errors", () => {
    it("should handle validation failed errors", () => {
      const result = parseContractError("Validation failed: Invalid input");
      expect(result.name).toBe("ValidationError");
      expect(result.isKnown).toBe(true);
      expect(result.recoverable).toBe(false);
      expect(result.suggestedAction).toBe("contact-support");
    });
  });

  describe("ParsedContractError type completeness", () => {
    it("should always include recoverable field", () => {
      // Test various error types
      const errors = ["0x8cb4ae3b", "unknown error", new Error("test"), { message: "test" }];

      errors.forEach((error) => {
        const result = parseContractError(error);
        expect(typeof result.recoverable).toBe("boolean");
      });
    });
  });
});
