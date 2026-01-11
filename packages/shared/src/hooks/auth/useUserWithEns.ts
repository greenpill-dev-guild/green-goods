/**
 * Hook to get user info with ENS name
 *
 * This is a wrapper around useUser that adds ENS name lookup.
 * Use this only in components where QueryClient is guaranteed to be available
 * (i.e., not in the Root component or router-level components).
 *
 * @example
 * ```tsx
 * // In a component that's rendered after QueryClientProvider
 * function ProfileCard() {
 *   const { ensName, ...userInfo } = useUserWithEns();
 *   return <div>{ensName || userInfo.primaryAddress}</div>;
 * }
 * ```
 */

import { useEnsName } from "../blockchain/useEnsName";
import { useUser } from "./useUser";

export function useUserWithEns() {
  const user = useUser();
  const { data: ensName } = useEnsName(user.primaryAddress);

  return {
    ...user,
    ensName: ensName ?? null,
  };
}
