import { getDefaultChain } from "@/config";

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

export async function initSmartAccount(): Promise<{ smartAccountAddress: `0x${string}` | null }> {
  const res = await fetch(`${getApiBase()}/aa/init`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) throw new Error(`aa/init failed: ${res.status}`);
  return (await res.json()) as { smartAccountAddress: `0x${string}` | null };
}

export async function getPasskeyCredential(): Promise<{ id: string; publicKey: string } | null> {
  const res = await fetch(`${getApiBase()}/auth/credential`, { credentials: "include" });
  if (!res.ok) return null;
  const data = (await res.json()) as { credential: { id: string; publicKey: string } | null };
  return data.credential ?? null;
}

export type AASimpleCall = { to: `0x${string}`; data: `0x${string}`; value?: string };

export async function getUserOpOptions(call: AASimpleCall): Promise<{ publicKey: unknown }> {
  const res = await fetch(`${getApiBase()}/aa/userop/options`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ call, chainId: getDefaultChain().id }),
  });
  if (!res.ok) throw new Error(`aa/userop/options failed: ${res.status}`);
  return (await res.json()) as { publicKey: unknown };
}

export async function submitUserOp(
  call: AASimpleCall,
  assertion: unknown
): Promise<{
  userOpHash: `0x${string}`;
  txHash?: `0x${string}`;
  smartAccountAddress: `0x${string}` | null;
}> {
  const res = await fetch(`${getApiBase()}/aa/userop/submit`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ call, chainId: getDefaultChain().id, assertion }),
  });
  if (!res.ok) throw new Error(`aa/userop/submit failed: ${res.status}`);
  return (await res.json()) as {
    userOpHash: `0x${string}`;
    txHash?: `0x${string}`;
    smartAccountAddress: `0x${string}` | null;
  };
}
