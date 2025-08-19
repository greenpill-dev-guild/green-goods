import { startAuthentication, startRegistration } from "@simplewebauthn/browser";

function getApiBase(): string {
  try {
    const { host } = window.location;
    if (host.startsWith("localhost:")) return "http://localhost:3000";
    if (host.includes("staging.greengoods.app")) return "https://staging.greengoods.app";
    return "https://api.greengoods.app";
  } catch {
    return "";
  }
}

export async function beginPasskeyRegistration(): Promise<PublicKeyCredentialCreationOptions> {
  const res = await fetch(`${getApiBase()}/auth/register/options`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to get registration options");
  const { publicKey } = (await res.json()) as { publicKey: PublicKeyCredentialCreationOptions };
  return publicKey as PublicKeyCredentialCreationOptions;
}

export async function finishPasskeyRegistration(
  attResp: unknown
): Promise<{ ok: boolean; user?: { id: string } }> {
  const res = await fetch(`${getApiBase()}/auth/register/verify`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(attResp),
  });
  if (!res.ok) throw new Error("Registration verification failed");
  return (await res.json()) as { ok: boolean; user?: { id: string } };
}

export async function registerWithPasskey(): Promise<{ id: string }> {
  const options = await beginPasskeyRegistration();
  const attResp = await startRegistration(options);
  const verified = await finishPasskeyRegistration(attResp);
  if (!verified.ok || !verified.user?.id) throw new Error("Registration failed");
  return { id: verified.user.id };
}

export async function beginPasskeyLogin(): Promise<CredentialRequestOptions> {
  const res = await fetch(`${getApiBase()}/auth/login/options`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to get login options");
  const { publicKey } = (await res.json()) as { publicKey: PublicKeyCredentialRequestOptions };
  return { publicKey };
}

export async function finishPasskeyLogin(
  assertion: unknown
): Promise<{ ok: boolean; user?: { id: string } }> {
  const res = await fetch(`${getApiBase()}/auth/login/verify`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(assertion),
  });
  if (!res.ok) throw new Error("Login verification failed");
  return (await res.json()) as { ok: boolean; user?: { id: string } };
}

export async function loginWithPasskey(): Promise<{ id: string }> {
  const options = await beginPasskeyLogin();
  const assertion = await startAuthentication(options);
  const verified = await finishPasskeyLogin(assertion);
  if (!verified.ok || !verified.user?.id) throw new Error("Login failed");
  return { id: verified.user.id };
}

export async function logoutSession(): Promise<void> {
  await fetch(`${getApiBase()}/auth/logout`, { method: "POST", credentials: "include" });
}

export async function getSession(): Promise<{
  user: { id: string } | null;
  smartAccountAddress: string | null;
}> {
  const res = await fetch(`${getApiBase()}/me`, { credentials: "include" });
  if (!res.ok) return { user: null, smartAccountAddress: null };
  return (await res.json()) as { user: { id: string } | null; smartAccountAddress: string | null };
}
