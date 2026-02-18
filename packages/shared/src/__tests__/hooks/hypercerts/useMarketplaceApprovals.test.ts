/**
 * useMarketplaceApprovals Hook Tests
 *
 * Verifies query key safety when operator is undefined (C3 fix).
 * The hook uses `enabled: Boolean(operator)` to prevent execution,
 * but the query key must also be type-safe and never use non-null assertions.
 */

import { describe, expect, it } from "vitest";
import { queryKeys } from "../../../hooks/query-keys";

// ============================================
// Query Key Safety Tests
// ============================================

describe("marketplace approvals query key safety", () => {
  it("produces a stable key with a valid operator", () => {
    const key = queryKeys.marketplace.approvals("0xAbC123", 11155111);
    expect(key).toEqual(["greengoods", "marketplace", "approvals", "0xAbC123", 11155111]);
  });

  it("produces a key with sentinel when operator is undefined", () => {
    // After fix: passing empty string sentinel instead of operator!
    const sentinel = "";
    const key = queryKeys.marketplace.approvals(sentinel, 11155111);
    expect(key).toEqual(["greengoods", "marketplace", "approvals", "", 11155111]);
    // The key is stable and type-safe -- no non-null assertion needed
  });

  it("sentinel key differs from valid operator key", () => {
    const validKey = queryKeys.marketplace.approvals("0xAbC", 1);
    const sentinelKey = queryKeys.marketplace.approvals("", 1);
    expect(validKey).not.toEqual(sentinelKey);
  });
});
