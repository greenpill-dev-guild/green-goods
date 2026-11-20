/**
 * "Continue with Passkey" on the boot screen loads the workspace, whose sign-in then
 * opens at the name step the steward asked for instead of showing the same entry again.
 * The boot screen and the sign-in run in one page, so a module flag carries the choice.
 */
let requested = false;

export function requestPasskeyAtBoot(): void {
  requested = true;
}

export function isPasskeyRequestedAtBoot(): boolean {
  return requested;
}

/** The sign-in reads the request once, when it first mounts. */
export function clearPasskeyRequestAtBoot(): void {
  requested = false;
}
