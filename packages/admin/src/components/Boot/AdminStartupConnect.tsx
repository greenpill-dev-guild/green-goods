import { useAuthActions, useAuthState } from "@green-goods/shared/providers/Auth";
import { useWalletModalOpen } from "@green-goods/shared/hooks/auth/useWalletModalOpen";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { BootConnect } from "./BootSurface";

/** Fresh wallet entry loads auth first; saved sessions and passkey entry load the workspace. */
export function AdminStartupConnect({
  requested,
  children,
}: {
  requested: boolean;
  children: ReactNode;
}) {
  const { isReady, isAuthenticated } = useAuthState();
  const { loginWithWallet } = useAuthActions();
  const modalOpen = useWalletModalOpen();
  const consumed = useRef(false);
  const modalWasOpen = useRef(false);
  const [workspaceRequested, setWorkspaceRequested] = useState(!requested);

  useEffect(() => {
    if (!requested || workspaceRequested || !isReady || consumed.current) return;
    consumed.current = true;
    // A session that appeared while the runtime loaded keeps its identity.
    if (!isAuthenticated) loginWithWallet();
  }, [requested, workspaceRequested, isReady, isAuthenticated, loginWithWallet]);

  useEffect(() => {
    // Once admitted, keep the workspace through sign-out and later modal changes.
    if (isAuthenticated || (modalWasOpen.current && !modalOpen)) setWorkspaceRequested(true);
    modalWasOpen.current = modalOpen;
  }, [isAuthenticated, modalOpen]);

  if (!requested || workspaceRequested || isAuthenticated) return children;

  // Retain both entry paths if opening the modal fails or the user changes their mind.
  return (
    <BootConnect
      onConnect={loginWithWallet}
      onPasskey={() => {
        consumed.current = true;
        setWorkspaceRequested(true);
      }}
    />
  );
}
