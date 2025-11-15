import { describe, it, expect } from "vitest";

import { queryClient } from "../../config/react-query";

describe("modules/react-query", () => {
  it("exports a configured QueryClient", () => {
    expect(queryClient).toBeDefined();
    const opts = (queryClient as any).getDefaultOptions?.();
    expect(opts).toBeDefined();
    expect(opts.queries.staleTime).toBeGreaterThan(0);
  });
});
