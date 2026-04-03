import { useCallback, useState } from "react";
import { useIntl } from "react-intl";

import type { Address } from "../../types/domain";
import { toastService } from "../../components/toast";
import { useOpsRunnerAuth, useOpsRunnerSession } from "./useOpsRunner";

interface UseOpsRunnerConnectOptions {
  walletAddress?: Address;
  signMessageAsync: (args: { message: string }) => Promise<string>;
}

export function useOpsRunnerConnect({
  walletAddress,
  signMessageAsync,
}: UseOpsRunnerConnectOptions) {
  const { formatMessage } = useIntl();
  const { session, isAuthenticated, clearSession } = useOpsRunnerSession();
  const auth = useOpsRunnerAuth();
  const [isConnecting, setIsConnecting] = useState(false);

  const connect = useCallback(async () => {
    if (!walletAddress) {
      toastService.error({
        title: formatMessage({ id: "app.deployment.ops.connectWalletFirst" }),
      });
      return;
    }

    setIsConnecting(true);
    try {
      const challenge = await auth.requestChallenge.mutateAsync({ address: walletAddress });
      const signature = await signMessageAsync({ message: challenge.message });
      await auth.verifySignature.mutateAsync({ address: walletAddress, signature });
      toastService.success({
        title: formatMessage({ id: "app.deployment.ops.authSuccess" }),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : formatMessage({ id: "app.error.unknown" });
      toastService.error({
        title: formatMessage({ id: "app.deployment.ops.authFailed" }),
        description: message,
      });
    } finally {
      setIsConnecting(false);
    }
  }, [walletAddress, signMessageAsync, auth, formatMessage]);

  return { connect, disconnect: clearSession, isConnecting, isAuthenticated, session };
}
