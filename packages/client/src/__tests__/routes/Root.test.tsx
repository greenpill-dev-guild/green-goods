/**
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  RECEIPT_TOKEN_SESSION_KEY,
  scrubReceiptTokenFragmentFromLocation,
} from "../../routes/receipt-token";

function createWindowLike(pathname: string, search: string, hash: string): Window {
  const storage = new Map<string, string>();
  const location = {
    href: `http://localhost:3000${pathname}${search}${hash}`,
    pathname,
    search,
    hash,
  };
  return {
    location,
    sessionStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      clear: () => storage.clear(),
      removeItem: (key: string) => storage.delete(key),
    },
    history: {
      state: {},
      replaceState: (_state: unknown, _title: string, nextUrl: string) => {
        const next = new URL(nextUrl, "http://localhost:3000");
        location.href = next.href;
        location.pathname = next.pathname;
        location.search = next.search;
        location.hash = next.hash;
      },
    },
  } as unknown as Window;
}

describe("Root receipt-token bootstrap", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  it("moves receiptToken from the URL fragment into short-lived session state", () => {
    const win = createWindowLike("/fund", "?intent=fi_123", "#receiptToken=secret&section=receipt");

    const token = scrubReceiptTokenFragmentFromLocation(win);

    expect(token).toBe("secret");
    expect(win.sessionStorage.getItem(RECEIPT_TOKEN_SESSION_KEY)).toBe("secret");
    expect(win.location.href).toBe("http://localhost:3000/fund?intent=fi_123#section=receipt");
  });

  it("leaves URLs without receiptToken unchanged", () => {
    const win = createWindowLike("/fund", "", "#section=receipt");

    const token = scrubReceiptTokenFragmentFromLocation(win);

    expect(token).toBeUndefined();
    expect(win.location.href).toBe("http://localhost:3000/fund#section=receipt");
  });
});
