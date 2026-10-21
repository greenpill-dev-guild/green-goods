import {
  COMMITMENT_EVIDENCE_VERSION,
  getCommitmentCounterIndexId,
  getCommitmentEvidenceAttributionId,
  getCommitmentEvidenceAttributionIndexId,
  getCommitmentProviderExposureId,
  getCommitmentWorkAttributionId,
} from "@green-goods/shared/commitment-pooling";
import { LIFECYCLE_TABS } from "@green-goods/shared/hooks/admin-ui/actions/actions.utils";
import { useErc20MetadataMany } from "@green-goods/shared/hooks/blockchain/useErc20Metadata";
import {
  PUBLIC_PROMISE_KEPT_MIN_DISTINCT_PROVIDERS,
  PUBLIC_PROMISE_KEPT_MIN_DUE,
} from "@green-goods/shared/modules/commitment-pooling/disclosure";
import {
  campaignCopyFromMessageIds,
  enMessage,
  evmavericksPreviewCopy,
  greenpillNycPreviewCopy,
  OCTANT_VAULT_CAMPAIGN_COPY_MESSAGE_IDS,
} from "@green-goods/shared/modules/vault-crowdfunding/copy";
import { hasTransactionHash } from "@green-goods/shared/modules/vault-crowdfunding/manifest";
import { normalizeAddressLike } from "@green-goods/shared/public-contracts/core";
import { describe, expect, it } from "vitest";

describe("declared Shared consumer subpaths", () => {
  it("keeps the existing chain-aware attribution ID constructors available", () => {
    const account = "0xABC";
    expect(getCommitmentWorkAttributionId(42161, "0xDEF")).toBe("42161-0xdef");
    expect(getCommitmentEvidenceAttributionId(42220, 7n, "0xDEF", account)).toBe(
      "42220-7-0xdef-0xabc"
    );
    expect(getCommitmentEvidenceAttributionIndexId(42161, 7n)).toBe("42161-7");
    expect(getCommitmentCounterIndexId(42220, 7n)).toBe("42220-7");
    expect(getCommitmentProviderExposureId(42161, 3n, account)).toBe("42161-3-0xabc");
  });

  it("preserves consumer access to version, disclosure and lifecycle policy", () => {
    expect(COMMITMENT_EVIDENCE_VERSION).toBe(1);
    expect(PUBLIC_PROMISE_KEPT_MIN_DUE).toBe(5n);
    expect(PUBLIC_PROMISE_KEPT_MIN_DISTINCT_PROVIDERS).toBe(3n);
    expect(LIFECYCLE_TABS.map((tab) => tab.id)).toEqual(["all", "active", "upcoming", "completed"]);
    expect(typeof useErc20MetadataMany).toBe("function");
  });

  it("lets a declared-subpath consumer construct the existing localized campaign copy", () => {
    const ids = OCTANT_VAULT_CAMPAIGN_COPY_MESSAGE_IDS["greenpill-nyc"];
    expect(campaignCopyFromMessageIds(ids)).toEqual(greenpillNycPreviewCopy);
    expect(greenpillNycPreviewCopy.headline).toBe(enMessage(ids.headline));
    expect(evmavericksPreviewCopy).toEqual(
      campaignCopyFromMessageIds(OCTANT_VAULT_CAMPAIGN_COPY_MESSAGE_IDS.evmavericks)
    );
  });

  it("keeps public proof normalization and rejection boundaries available", () => {
    expect(normalizeAddressLike(" 0xABC ")).toBe("0xabc");
    expect(hasTransactionHash(`0x${"a".repeat(64)}`)).toBe(true);
    expect(hasTransactionHash(`0x${"a".repeat(63)}`)).toBe(false);
    expect(hasTransactionHash(undefined)).toBe(false);
  });
});
