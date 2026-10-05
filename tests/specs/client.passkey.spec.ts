/** Real virtual-authenticator ceremony; a strict substitute rejects server verification. */
// TEST-QUALITY: allow-small-test-file - one browser ceremony owns this integration boundary
import { expect, test } from "@playwright/test";
import { TEST_URLS } from "../helpers/test-utils";

test.use({ baseURL: TEST_URLS.client, serviceWorkers: "block" });

test("server rejection after credential creation stays signed out and permits retry", async ({
  page,
}) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  const calls: string[] = [];
  const username = "factory-passkey";
  page.on("pageerror", (error) => {
    throw error;
  });
  await page.route("https://api.pimlico.io/**", async (route) => {
    const { id, method, params } = route.request().postDataJSON();
    calls.push(method);
    let result: unknown;
    if (method === "pks_getCredentials") {
      expect(params).toEqual([{ userName: username }]);
      result = [];
    } else if (method === "pks_startRegistration") {
      expect(params).toEqual([{ userName: username }]);
      result = {
        attestation: "none",
        challenge: Buffer.alloc(32, 7).toString("base64"),
        rp: { id: "localhost", name: "Green Goods test" },
        user: {
          id: Buffer.from(username).toString("base64"),
          name: username,
          displayName: username,
        },
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          requireResidentKey: true,
          residentKey: "required",
          userVerification: "required",
        },
        timeout: 10000,
      };
    } else if (method === "pks_verifyRegistration") {
      expect(params[1]).toEqual({ userName: username });
      expect(params[0].type).toBe("public-key");
      const clientData = JSON.parse(
        Buffer.from(params[0].response.clientDataJSON, "base64").toString()
      );
      expect(clientData.type).toBe("webauthn.create");
      expect(clientData.origin).toBe(TEST_URLS.client);
      expect(clientData.challenge).toBe(Buffer.alloc(32, 7).toString("base64url"));
      result = { success: false, id: params[0].id, publicKey: "0x00", userName: username };
    } else {
      throw new Error(`Unexpected passkey RPC method: ${method}`);
    }
    await route.fulfill({ json: { jsonrpc: "2.0", id, result } });
  });
  try {
    await page.goto("/home/login?presentation=pwa");
    await expect(page.getByTestId("login-button")).toHaveText("Create Account");
    await expect(page.getByTestId("secondary-action-button")).toBeVisible();
    await page.getByTestId("login-button").click();
    await expect(page.getByTestId("username-input")).toBeVisible();
    await page.getByTestId("username-input").fill(username);
    await page.getByTestId("login-button").click();
    await expect(page.getByRole("alert")).toHaveText("Error:We couldn't verify your passkey.");
    expect(calls).toEqual([
      "pks_getCredentials",
      "pks_startRegistration",
      "pks_verifyRegistration",
    ]);
    const { credentials } = await cdp.send("WebAuthn.getCredentials", { authenticatorId });
    expect(credentials).toHaveLength(1);
    expect(credentials[0].rpId).toBe("localhost");
    await expect(page).toHaveURL(/\/home\/login\?presentation=pwa$/);
    await expect(page.getByTestId("username-input")).toHaveValue(username);
    await expect(page.getByTestId("login-button")).toBeEnabled();
    await page.reload();
    await expect(page.getByTestId("login-button")).toHaveText("Create Account");
    await expect(page).toHaveURL(/\/home\/login\?presentation=pwa$/);
    await test
      .info()
      .attach("passkey-rejection", { body: await page.screenshot(), contentType: "image/png" });
  } finally {
    await cdp.send("WebAuthn.removeVirtualAuthenticator", { authenticatorId });
    await cdp.detach();
  }
});
