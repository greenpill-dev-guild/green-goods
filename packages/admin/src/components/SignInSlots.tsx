import type { FormEventHandler, ReactNode } from "react";

/**
 * The sign-in screen's four fixed slots. The boot screen, drawn before any provider
 * exists, and the Hub's sign-in both fill this frame, so the screen a steward starts on
 * and the one the workspace takes over with match control for control. Keep it free of
 * provider and wallet imports: the boot bundle loads it.
 */
export function SignInSlots({
  slotOne,
  slotTwo,
  feedback,
  navigation,
  onSubmit,
}: {
  /** The primary action, or the name field on the name step (room for its label above). */
  slotOne: ReactNode;
  /** The second action, or the name step's submit. */
  slotTwo: ReactNode;
  /** One clamped zone for an error, a status or a hint; it scrolls rather than grows. */
  feedback?: ReactNode;
  /** A quiet way elsewhere: another account, or back to the entry. */
  navigation?: ReactNode;
  onSubmit?: FormEventHandler<HTMLFormElement>;
}) {
  return (
    <form
      className="flex w-full max-w-sm flex-col gap-2"
      data-component="AdminSignIn"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.(event);
      }}
    >
      <div className="flex h-18 w-full items-center" data-testid="admin-auth-slot-one">
        {slotOne}
      </div>
      <div className="flex h-11 w-full items-center" data-testid="admin-auth-slot-two">
        {slotTwo}
      </div>
      <div className="h-20 overflow-y-auto" data-testid="admin-sign-in-feedback">
        {feedback}
      </div>
      <div className="flex h-11 items-center justify-center" data-testid="admin-auth-navigation">
        {navigation}
      </div>
    </form>
  );
}
