import { useCallback, useEffect, useRef, useState } from "react";
import { createStore, get, set } from "idb-keyval";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import type { Address, WorkUploadConsent } from "../../types/domain";
import {
  assertWorkUploadConsent,
  UploadPolicyCancelledError,
  WORK_UPLOAD_POLICY_VERSION,
} from "../../modules/work/upload-policy";

const store = createStore("green-goods-upload-policy", "acceptances");
// A skipped introduction is distinct from acceptance and can never authorize an upload.
const skippedThisSession = new Set<string>();
const key = (owner: Address) =>
  `${DEFAULT_CHAIN_ID}:${owner.toLowerCase()}:${WORK_UPLOAD_POLICY_VERSION}`;
const skipKey = (owner: Address) => `skipped:${key(owner)}`;

type PromptReason = "sign-in" | "upload";
interface Pending {
  owner: Address;
  reason: PromptReason;
  generation: number;
  resolve: (receipt: WorkUploadConsent) => void;
  reject: (error: Error) => void;
}
interface PromptState {
  pending: Pending;
  checked: boolean;
  saving: boolean;
  saveFailed: boolean;
}

export interface UploadPolicyPrompt {
  reason: PromptReason;
  checked: boolean;
  saving: boolean;
  saveFailed: boolean;
  setChecked: (value: boolean) => void;
  accept: () => Promise<void>;
  cancel: () => void;
}

async function readAcceptance(owner: Address): Promise<WorkUploadConsent | undefined> {
  try {
    const saved = await get<WorkUploadConsent>(key(owner), store);
    assertWorkUploadConsent(saved, owner);
    return saved;
  } catch {
    return undefined;
  }
}

async function readSkipped(owner: Address): Promise<boolean> {
  const skipped = skipKey(owner);
  if (skippedThisSession.has(skipped)) return true;
  try {
    return (await get<boolean>(skipped, store)) === true;
  } catch {
    return false;
  }
}

async function rememberSkip(owner: Address) {
  const skipped = skipKey(owner);
  skippedThisSession.add(skipped);
  try {
    await set(skipped, true, store);
  } catch {
    // Keep Skip usable if this browser has blocked persistent storage.
  }
}

/** Reuses the account's current acceptance before allowing new uploads. */
export function useUploadPolicy(address: Address | null, locale: string, promptAtSignIn = false) {
  const owner = (address?.toLowerCase() as Address | undefined) ?? null;
  const identity = useRef({ owner, generation: 0 });
  if (identity.current.owner !== owner)
    identity.current = { owner, generation: identity.current.generation + 1 };
  const pending = useRef<Pending | null>(null);
  const [state, setState] = useState<PromptState | null>(null);
  const cancel = useCallback(() => {
    const current = pending.current;
    pending.current = null;
    setState(null);
    current?.reject(new UploadPolicyCancelledError());
  }, []);
  useEffect(() => cancel, [owner, cancel]);

  const start = useCallback(
    (reason: PromptReason): Promise<WorkUploadConsent> => {
      if (!owner || pending.current) return Promise.reject(new UploadPolicyCancelledError());
      return new Promise((resolve, reject) => {
        const current: Pending = {
          owner,
          reason,
          generation: identity.current.generation,
          resolve,
          reject,
        };
        pending.current = current;
        void (async () => {
          const accepted = await readAcceptance(owner);
          const skipped = reason === "sign-in" && !accepted && (await readSkipped(owner));
          if (pending.current !== current || current.generation !== identity.current.generation)
            return;
          if (accepted) {
            pending.current = null;
            resolve(accepted);
          } else if (skipped) {
            cancel();
          } else {
            setState({ pending: current, checked: false, saving: false, saveFailed: false });
          }
        })();
      });
    },
    [owner, cancel]
  );

  useEffect(() => {
    if (promptAtSignIn && owner) void start("sign-in").catch(() => undefined);
  }, [owner, promptAtSignIn, start]);

  const request = useCallback(() => start("upload"), [start]);
  const accept = async () => {
    if (!state?.checked || state.saving) return;
    const current = state.pending;
    if (pending.current !== current || current.generation !== identity.current.generation)
      return cancel();
    setState({ ...state, saving: true, saveFailed: false });
    const language = locale.split("-")[0];
    const acceptance: WorkUploadConsent = {
      policyVersion: WORK_UPLOAD_POLICY_VERSION,
      uploaderAddress: current.owner,
      termsAcceptedAt: new Date().toISOString(),
      permissionsConfirmed: true,
      locale: language === "es" || language === "pt" ? language : "en",
    };
    try {
      await set(key(current.owner), acceptance, store);
      if (pending.current !== current || current.generation !== identity.current.generation) return;
      pending.current = null;
      setState(null);
      current.resolve(acceptance);
    } catch {
      if (pending.current === current) setState({ ...state, saving: false, saveFailed: true });
    }
  };

  const prompt: UploadPolicyPrompt | null =
    state && state.pending.owner === owner
      ? {
          reason: state.pending.reason,
          checked: state.checked,
          saving: state.saving,
          saveFailed: state.saveFailed,
          setChecked: (checked) => setState((current) => current && { ...current, checked }),
          accept,
          cancel: () => {
            if (pending.current !== state.pending || state.saving) return;
            if (state.pending.reason === "sign-in") void rememberSkip(state.pending.owner);
            cancel();
          },
        }
      : null;
  return { request, prompt };
}
