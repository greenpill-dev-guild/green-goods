import { type ReactNode, useCallback, useId } from "react";
import { useIntl } from "react-intl";
import { AdminUploadPolicyContext } from "../../hooks/admin-ui/useAdminUploadPolicy";
import { usePrimaryAddress } from "../../hooks/auth/usePrimaryAddress";
import { useUploadPolicy, type UploadPolicyPrompt } from "../../hooks/work/useUploadPolicy";
import { UploadPolicyCancelledError } from "../../modules/work/upload-policy";
import { useOptionalAuthContext } from "../../providers/Auth";
import type { Address } from "../../types/domain";
import { DialogShell } from "./DialogShell";
import type { SheetActionsProps } from "./SheetActions";

type ConsentPromptProps = {
  prompt: UploadPolicyPrompt | null | undefined;
  kind?: "work" | "profile-photo" | "admin-file" | "evidence";
};

type ConsentPresentation = {
  title: string;
  description: string;
  actions: SheetActionsProps;
  content: ReactNode;
};

/** Shares the policy copy and agreement controls across each surface's own dialog. */
export function WorkUploadConsentContent({
  prompt,
  kind = "work",
  render,
}: ConsentPromptProps & { render: (presentation: ConsentPresentation) => ReactNode }) {
  const { formatMessage } = useIntl();
  const id = useId();
  if (!prompt) return null;
  const atSignIn = prompt.reason === "sign-in";
  return render({
    title: formatMessage({ id: "app.work.uploadConsent.title" }),
    description: formatMessage({
      id: atSignIn
        ? "app.work.uploadConsent.signIn"
        : kind === "profile-photo"
          ? "profile.avatar.uploadConsent.body"
          : kind === "admin-file"
            ? "app.work.uploadConsent.admin"
            : kind === "evidence"
              ? "app.work.uploadConsent.evidence"
              : "app.work.uploadConsent.body",
    }),
    actions: {
      primary: {
        label: formatMessage({ id: "app.work.uploadConsent.accept" }),
        disabled: !prompt.checked,
        loading: prompt.saving,
        onClick: () => void prompt.accept(),
      },
      secondary: {
        label: formatMessage({
          id: atSignIn ? "app.work.uploadConsent.skip" : "app.common.cancel",
        }),
        disabled: prompt.saving,
        onClick: prompt.cancel,
      },
    },
    content: (
      <div className="space-y-4 text-sm text-text-strong-950">
        <p>
          {formatMessage({
            id:
              kind === "profile-photo"
                ? "profile.avatar.uploadConsent.public"
                : "app.work.uploadConsent.public",
          })}
        </p>
        <div className="flex gap-4">
          <a
            href="https://www.greengoods.app/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            {formatMessage({ id: "public.footer.terms" })}
          </a>
          <a
            href="https://www.greengoods.app/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            {formatMessage({ id: "public.footer.privacy" })}
          </a>
        </div>
        <p>{formatMessage({ id: "app.work.uploadConsent.rules" })}</p>
        <label htmlFor={`${id}-terms`} className="flex items-start gap-3">
          <input
            id={`${id}-terms`}
            type="checkbox"
            checked={prompt.checked}
            disabled={prompt.saving}
            onChange={(event) => prompt.setChecked(event.target.checked)}
            className="mt-1 accent-primary-on-surface"
          />
          <span>{formatMessage({ id: "app.work.uploadConsent.terms" })}</span>
        </label>
        {prompt.saveFailed ? (
          <p role="alert" className="text-error-dark">
            {formatMessage({ id: "app.work.uploadConsent.saveFailed" })}
          </p>
        ) : null}
      </div>
    ),
  });
}

export function WorkUploadConsentDialog({ prompt, kind }: ConsentPromptProps) {
  if (!prompt) return null;
  return (
    <WorkUploadConsentContent
      prompt={prompt}
      kind={kind}
      render={({ title, description, actions, content }) => (
        <DialogShell
          open
          onOpenChange={(open) => !open && prompt.cancel()}
          preventClose={prompt.saving}
          title={title}
          description={description}
          sheetSize="full"
          actions={actions}
        >
          {content}
        </DialogShell>
      )}
    />
  );
}

/** Mount in the signed-in app workspace so public browsing never opens the sheet. */
export function WorkUploadPolicyOnSignIn() {
  const auth = useOptionalAuthContext();
  const address = usePrimaryAddress();
  if (!auth?.isReady || !auth.isAuthenticated || !address) return null;
  return <SignedInUploadPolicy owner={address} />;
}

function SignedInUploadPolicy({ owner }: { owner: Address }) {
  const { locale } = useIntl();
  const { prompt } = useUploadPolicy(owner, locale, true);
  return <WorkUploadConsentDialog prompt={prompt} />;
}

/** Shares the sign-in prompt with public upload actions in the Admin workspace. */
export function AdminUploadPolicyProvider({
  children,
  renderPrompt,
}: {
  children: ReactNode;
  renderPrompt: (prompt: UploadPolicyPrompt | null) => ReactNode;
}) {
  const auth = useOptionalAuthContext();
  const address = usePrimaryAddress();
  const { locale } = useIntl();
  const owner = auth?.isReady && auth.isAuthenticated ? address : null;
  const { request, prompt } = useUploadPolicy(owner, locale, true);
  const authorize = useCallback(async () => {
    try {
      await request();
      return true;
    } catch (error) {
      if (error instanceof UploadPolicyCancelledError) return false;
      throw error;
    }
  }, [request]);
  return (
    <AdminUploadPolicyContext.Provider value={authorize}>
      {renderPrompt(prompt)}
      {children}
    </AdminUploadPolicyContext.Provider>
  );
}
