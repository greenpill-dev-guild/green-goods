/**
 * Hook to access authentication context
 *
 * This hook provides access to passkey-based authentication state and actions.
 * Must be used within AuthProvider.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { smartAccountAddress, isReady, createPasskey } = useAuth();
 *
 *   if (!isReady) return <Loader />;
 *
 *   return <div>Welcome {smartAccountAddress}</div>;
 * }
 * ```
 */
export { useAuth, type AuthMode } from "@/providers/auth";
