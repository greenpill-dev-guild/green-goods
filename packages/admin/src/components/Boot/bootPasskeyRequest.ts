/**
 * A choice made on the boot screen, "Continue with Passkey" or "Other Ways to Sign In", loads
 * the workspace, whose sign-in then opens at the screen the steward asked for instead of showing
 * the same entry again. The boot screen and the sign-in run in one page, so a module flag carries
 * the choice.
 */
let requested: "username" | "otherWays" | null = null;

export function requestPasskeyAtBoot(): void {
  requested = "username";
}

export function requestOtherWaysAtBoot(): void {
  requested = "otherWays";
}

export function isPasskeyRequestedAtBoot(): boolean {
  return requested === "username";
}

export function isOtherWaysRequestedAtBoot(): boolean {
  return requested === "otherWays";
}

/** The sign-in reads the request once, when it first mounts. */
export function clearPasskeyRequestAtBoot(): void {
  requested = null;
}

/**
 * Whether email sign-in shows: the switch and both public keys, as Shared's `config/openfort`
 * decides it for the sign-in screen. Read here by name because the boot screen loads before
 * Shared's providers and keeps its own small imports.
 */
export function isEmailSignInOfferedAtBoot(): boolean {
  return (
    import.meta.env.VITE_OPENFORT_SIGN_IN_ENABLED?.trim().toLowerCase() === "true" &&
    Boolean(import.meta.env.VITE_OPENFORT_PUBLISHABLE_KEY?.trim()) &&
    Boolean(import.meta.env.VITE_OPENFORT_SHIELD_PUBLISHABLE_KEY?.trim())
  );
}
