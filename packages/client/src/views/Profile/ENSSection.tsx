import { useUsernameController } from "@green-goods/shared/hooks/client-ui/profile/useUsernameController";
import { useUIStore } from "@green-goods/shared/stores/useUIStore";
import type { Address } from "@green-goods/shared/types/domain";
import { useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { ChangeUsernameSheet } from "./ChangeUsernameSheet";
import { ENS_SUPPORT_URL, ENSUsernameChangeRequest } from "./ENSUsernameChangeRequest";
import { UsernameCard } from "./UsernameCard";
import { UsernameField } from "./UsernameField";

interface ENSSectionProps {
  primaryAddress: Address | undefined;
}

/**
 * The Account tab's Username section (PRD-1026): the Username card, and the
 * Change Username sheet it opens, which releases and claims for a wallet
 * account and prepares a support request for a passkey account (D2, D8).
 * Composition only: `useUsernameController` owns what the card says and does.
 */
export const ENSSection: React.FC<ENSSectionProps> = ({ primaryAddress }) => {
  const intl = useIntl();
  const navigate = useNavigate();
  const setGardenFilters = useUIStore((state) => state.setGardenFilters);
  const username = useUsernameController(primaryAddress);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const { card, form, acts } = username;
  if (!primaryAddress || card.kind === "loading") return null;

  const canClaim =
    !username.isClaiming &&
    form.typed.length > 0 &&
    !form.slugForm.formState.errors.slug &&
    form.available === true &&
    !form.checking;
  const claimTyped = async () => {
    if (!(await form.slugForm.trigger("slug"))) return;
    if (await acts.claim(form.slugForm.getValues("slug"))) form.slugForm.reset({ slug: "" });
  };
  const closeSheet = () => setIsSheetOpen(false);

  return (
    <>
      <h5 className="text-label-md text-text-strong-950">
        {intl.formatMessage({ id: "app.profile.currentENSName", defaultMessage: "Username" })}
      </h5>
      <UsernameCard
        card={card}
        isOnline={username.isOnline}
        field={
          <UsernameField
            id="username-claim"
            label={intl.formatMessage({
              id: "app.profile.currentENSName",
              defaultMessage: "Username",
            })}
            form={form.slugForm}
            typed={form.typed}
            availability={{ available: form.available, checking: form.checking }}
            showRules
            disabled={username.isClaiming}
          />
        }
        canClaim={canClaim}
        isCheckingStatus={username.isCheckingStatus}
        helpHref={ENS_SUPPORT_URL}
        onClaimTyped={() => void claimTyped()}
        onClaim={(slug) => void acts.claim(slug)}
        onCheckStatus={acts.checkStatus}
        onChangeUsername={() => setIsSheetOpen(true)}
        onChooseAnother={acts.chooseAnother}
        onOpenGardens={() => {
          setGardenFilters((current) => ({ scope: "open", sort: current.sort }));
          navigate("/home");
        }}
      />
      {username.currentSlug ? (
        username.changeBySupport ? (
          <ENSUsernameChangeRequest
            isOpen={isSheetOpen}
            onClose={closeSheet}
            primaryAddress={primaryAddress}
            existingSlug={username.currentSlug}
          />
        ) : (
          <ChangeUsernameSheet
            isOpen={isSheetOpen}
            onClose={closeSheet}
            currentSlug={username.currentSlug}
            isOnline={username.isOnline}
            isReleasing={username.isReleasing}
            onChange={acts.startChange}
          />
        )
      ) : null}
    </>
  );
};
