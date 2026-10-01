/**
 * Username Change Store
 *
 * The username change this device started (PRD-1026 D6), kept until its claim
 * is sent: which name is being released, and which one the person chose to
 * claim once it clears. The release takes 15 to 20 minutes to clear and the
 * person may leave the app meanwhile, so the Username card picks the change
 * up from here. The chain stays the record of the names; this only remembers
 * the choice, on this device.
 *
 * One change per account, keyed by its lowercased address. It stays when
 * another account signs in on the device (`useIdentityChangeReset` says why).
 *
 * @module stores/useUsernameChangeStore
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UsernameChange } from "../modules/ens/username";

const USERNAME_CHANGE_STORAGE_KEY = "gg-username-changes";

interface UsernameChangeStore {
  changes: Record<string, UsernameChange>;
  /**
   * A name claimed on this device and not yet ready, so the service worker
   * still hears once when it is, after a reload or from another screen.
   */
  notices: Record<string, string>;
  /** The claim was sent: tell the service worker once this name is ready. */
  awaitNotice: (owner: string, slug: string) => void;
  /** The service worker has heard, or the name no longer applies. */
  clearNotice: (owner: string) => void;
  /** A release was sent: remember what it releases and what to claim after. */
  begin: (owner: string, change: UsernameChange) => void;
  /** Choose Another clears the new name; a claim form takes its place. */
  retarget: (owner: string, to: string | null) => void;
  /** The new name's claim was sent, or the change no longer applies. */
  finish: (owner: string) => void;
}

export const useUsernameChangeStore = create<UsernameChangeStore>()(
  persist(
    (set) => ({
      changes: {},
      notices: {},
      awaitNotice: (owner, slug) =>
        set((state) => ({ notices: { ...state.notices, [owner.toLowerCase()]: slug } })),
      clearNotice: (owner) =>
        set((state) => {
          const key = owner.toLowerCase();
          if (!(key in state.notices)) return state;
          const notices = { ...state.notices };
          delete notices[key];
          return { notices };
        }),
      begin: (owner, change) =>
        set((state) => ({ changes: { ...state.changes, [owner.toLowerCase()]: change } })),
      retarget: (owner, to) =>
        set((state) => {
          const key = owner.toLowerCase();
          const current = state.changes[key];
          return current ? { changes: { ...state.changes, [key]: { ...current, to } } } : state;
        }),
      finish: (owner) =>
        set((state) => {
          const key = owner.toLowerCase();
          if (!(key in state.changes)) return state;
          const changes = { ...state.changes };
          delete changes[key];
          return { changes };
        }),
    }),
    { name: USERNAME_CHANGE_STORAGE_KEY }
  )
);
