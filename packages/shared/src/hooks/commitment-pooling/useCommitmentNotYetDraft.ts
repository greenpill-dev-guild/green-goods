/**
 * useCommitmentNotYetDraft Hook
 *
 * The words of a "Not yet", kept on this device per commitment.
 *
 * Raising a dispute is an online contract call, so a member with no signal
 * cannot send it. What they typed should not vanish when the sheet closes or
 * the app is put away; it waits here until a connection lets it go, and is
 * cleared the moment it has.
 *
 * @module hooks/commitment-pooling/useCommitmentNotYetDraft
 */

import { useCallback, useState } from "react";

const PREFIX = "gg-commitment-not-yet:";

function read(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

export function useCommitmentNotYetDraft(commitmentEntityId: string): {
  reason: string;
  setReason: (value: string) => void;
  clear: () => void;
} {
  const key = `${PREFIX}${commitmentEntityId}`;
  const [reason, setReasonState] = useState(() => read(key));
  // The router reuses this component when one commitment opens another, so the
  // key changes without a remount and the initializer above never runs again.
  // Without this the second sheet shows the first commitment's words, and the
  // next edit copies them into the new commitment's key.
  const [loadedKey, setLoadedKey] = useState(key);
  if (loadedKey !== key) {
    setLoadedKey(key);
    setReasonState(read(key));
  }

  const setReason = useCallback(
    (value: string) => {
      setReasonState(value);
      try {
        if (value.trim().length === 0) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, value);
      } catch {
        // Storage may be full or unavailable; the in-memory draft still works.
      }
    },
    [key]
  );

  const clear = useCallback(() => setReason(""), [setReason]);

  return { reason, setReason, clear };
}
