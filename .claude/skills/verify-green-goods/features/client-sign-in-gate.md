# Sign-in gate

A visitor who is not signed in and opens any member page is sent to the sign-in page, which offers
to create an account or sign in with a wallet and remembers where they were going.

## Sub-features

- `gate-redirect` sends a signed-out visitor from `/home` to `/home/login` with a `redirectTo`.
- `gate-choices` offers `Create Account` and `Sign in with a Wallet`.

## How to get to it (user POV)

- Open `/home` (or any `/home/...` member page) while signed out.
- Open `/home/login` directly.

## Driving it with verify-control

Preconditions:

- The client is launched and `doctor` prints `ok`.
- Drive with `--role disconnected`, the mock seam's signed-out session.

- **Open a member page signed out.** `--step "goto:/home?presentation=pwa"`, then
  `--step "expect-url:/home/login"`. The URL ends `/home/login?redirectTo=%2Fhome%3Fpresentation%3Dpwa`.
- **Proof.** `--step "snapshot:login-<width>.aria.txt" --step "screenshot:login-<width>.png"`. The
  snapshot shows the `Green Goods` image and heading and the buttons `Create Account` and
  `Sign in with a Wallet`.

## Gotchas

- `--role disconnected` is required: the default `user` role is signed in and never sees the gate.
- Pressing either button starts a passkey or wallet ceremony, which this harness cannot complete;
  those journeys are authenticated-class proof (authenticated Brave).
