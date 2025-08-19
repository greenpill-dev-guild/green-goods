import React, { useContext, useEffect, useMemo, useState } from "react";
// import type { SmartAccountClient } from "permissionless";
import { getSession, loginWithPasskey, logoutSession, registerWithPasskey } from "@/lib/webauthn";
import { buildPasskeyKernelClient, ensureSmartAccountDeployed } from "@/modules/aa/passkey";

interface UserInterface {
  ready: boolean;
  authenticated: boolean;
  user: { id: string } | null;
  smartAccountAddress?: string | null;
  authenticating?: boolean;
  login: () => Promise<void>;
  register: () => Promise<void>;
  logout: () => Promise<void>;
}

const UserContext = React.createContext<UserInterface>({
  ready: false,
  authenticated: false,
  user: null,
  smartAccountAddress: null,
  authenticating: false,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
});

export const useUser = () => {
  return useContext(UserContext);
};

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [smartAccountAddress, setSmartAccountAddress] = useState<string | null>(null);
  const [authenticating, setAuthenticating] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const session = await getSession();
        setUser(session.user);
        setSmartAccountAddress(session.smartAccountAddress);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const login = useMemo(
    () => async () => {
      setAuthenticating(true);
      try {
        const { id } = await loginWithPasskey();
        setUser({ id });
        // Build kernel client and ensure deploy on first login
        try {
          const client = await buildPasskeyKernelClient();
          setSmartAccountAddress((client?.account?.address as string) || null);
          await ensureSmartAccountDeployed();
        } catch {}
      } finally {
        setAuthenticating(false);
      }
    },
    []
  );

  const register = useMemo(
    () => async () => {
      setAuthenticating(true);
      try {
        const { id } = await registerWithPasskey();
        setUser({ id });
      } finally {
        setAuthenticating(false);
      }
    },
    []
  );

  const logout = useMemo(
    () => async () => {
      await logoutSession();
      setUser(null);
      setSmartAccountAddress(null);
    },
    []
  );

  return (
    <UserContext.Provider
      value={{
        ready,
        authenticated: !!user,
        user,
        smartAccountAddress,
        authenticating,
        login,
        register,
        logout,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};
