import { createPasskeyServerClient } from "permissionless/clients/passkeyServer";
import { http } from "viem";

/**
 * The error the app's passkey client raises when a passkey server refuses a sign-up. The real
 * client makes it, so it carries what the real error carries: the address that was called and
 * the request that was sent, typed name included.
 */
export async function passkeyServerRefusal(input: {
  userName: string;
  /** What the server says went wrong. */
  message: string;
}): Promise<Error> {
  const client = createPasskeyServerClient({
    transport: http("https://agent.greengoods.app/public/passkeys/rpc", {
      retryCount: 0,
      fetchFn: async () =>
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            error: { code: -32000, message: input.message },
          }),
          { headers: { "content-type": "application/json" } }
        ),
    }),
  });
  return client.startRegistration({ context: { userName: input.userName } }).then(
    () => {
      throw new Error("The passkey server did not refuse the sign-up");
    },
    (error: Error) => error
  );
}
