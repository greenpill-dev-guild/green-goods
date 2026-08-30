function randomIdentitySuffix(): string {
  if (typeof crypto === "undefined") return `fallback_${Date.now()}`;
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(36).padStart(2, "0")).join("");
}

/** Shadows persisted PostHog identity with a unique one-event identity. */
export function createAnonymousTelemetryIdentity(event: string): Record<string, unknown> {
  return {
    distinct_id: `anonymous_${event}_${randomIdentitySuffix()}`,
    $anon_distinct_id: undefined,
    $device_id: undefined,
    $session_id: undefined,
    $user_id: undefined,
    $window_id: undefined,
  };
}
