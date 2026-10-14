import { describe, expect, it } from "vitest";

import { classifyCookieJarStatus } from "../../components/Public/cookieJarStatus";

describe("classifyCookieJarStatus", () => {
  it("distinguishes an active read from a completed missing result", () => {
    const options = { hasError: false, isConnected: true };

    expect(classifyCookieJarStatus(null, { ...options, isLoading: true }).kind).toBe("loading");
    expect(classifyCookieJarStatus(null, { ...options, isLoading: false }).kind).toBe("error");
  });
});
