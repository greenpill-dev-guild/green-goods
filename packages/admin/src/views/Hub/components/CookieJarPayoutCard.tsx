import type { CookieJar } from "@green-goods/shared/types/cookie-jar";
import type { Address } from "@green-goods/shared/types/domain";
import {
  formatTokenAmount,
  getVaultAssetSymbol,
} from "@green-goods/shared/utils/blockchain/vaults";
import { isJarClaimLimitLow } from "@green-goods/shared/utils/cookie-jar-claim-limit";
import { RiHandCoinLine, RiLockLine, RiWalletLine } from "@remixicon/react";
import { useEffect, useId, useRef } from "react";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { AdminCard } from "@/components/AdminCard";
import { AdminSettingRow } from "@/components/AdminSettingRow";
import { EnsAddressText } from "@/components/EnsAddressText";
import { cooldownLabel, JarCooldownEditor, JarLimitEditor } from "./CookieJarSettingEditors";

export type JarSettingField = "limit" | "cooldown";

/** Whether the connected account can sign for the garden account that owns the jars. */
interface JarSigner {
  canSign: boolean;
  isResolved: boolean;
  owner?: Address;
}

interface CookieJarPayoutCardProps {
  jar: CookieJar;
  gardenAddress: Address;
  gardenName: string;
  allocationCount: number;
  /** The payout history filled its list, so the count is a lower bound. */
  allocationCountAtLeast?: boolean;
  signer: JarSigner;
  /** Which of this jar's settings is open for editing, if any. */
  editingField: JarSettingField | null;
  onEdit: (field: JarSettingField | null) => void;
  onDeposit: () => void;
  onClaim: () => void;
}

export function CookieJarPayoutCard({
  jar,
  gardenAddress,
  gardenName,
  allocationCount,
  allocationCountAtLeast = false,
  signer,
  editingField,
  onEdit,
  onDeposit,
  onClaim,
}: CookieJarPayoutCardProps) {
  const { formatMessage } = useIntl();
  const restrictionId = useId();
  const symbol = getVaultAssetSymbol(jar.assetAddress, undefined);
  // Disabled, never hidden, so the card keeps one stable set of acts; the note says who can act.
  const restricted = signer.isResolved && !signer.canSign;

  // Closing an editor re-mounts its Edit button; hand focus back so the keyboard keeps its place.
  const editButtons = useRef<Record<JarSettingField, HTMLButtonElement | null>>({
    limit: null,
    cooldown: null,
  });
  const lastEdited = useRef<JarSettingField | null>(null);
  useEffect(() => {
    if (editingField) {
      lastEdited.current = editingField;
      return;
    }
    if (lastEdited.current) editButtons.current[lastEdited.current]?.focus();
    lastEdited.current = null;
  }, [editingField]);

  const editButton = (field: JarSettingField, label: string) => (
    <AdminButton
      ref={(node) => {
        editButtons.current[field] = node;
      }}
      type="button"
      variant="text"
      size="sm"
      disabled={!signer.canSign}
      aria-label={label}
      aria-describedby={restricted ? restrictionId : undefined}
      onClick={() => onEdit(field)}
    >
      {formatMessage({ id: "app.common.edit" })}
    </AdminButton>
  );
  const editorProps = { jar, gardenAddress, gardenName, onClose: () => onEdit(null) };

  return (
    <AdminCard variant="outlined" className="flex min-h-64 flex-col gap-4 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-title-md font-semibold text-text-strong" title={symbol}>
            {symbol}
          </h4>
          <p className="mt-1 text-label-sm text-text-soft">
            <EnsAddressText address={jar.jarAddress} />
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          <span
            className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-label-sm font-medium ${
              jar.isPaused
                ? "bg-warning-lighter text-warning-dark"
                : "bg-success-lighter text-success-dark"
            }`}
          >
            {jar.isPaused
              ? formatMessage({ id: "app.cookieJar.paused" })
              : formatMessage({ id: "app.cookieJar.active" })}
          </span>
          {isJarClaimLimitLow(jar) ? (
            <span className="inline-flex shrink-0 rounded-full bg-warning-lighter px-2.5 py-1 text-label-sm font-medium text-warning-dark">
              {formatMessage({ id: "app.cookieJar.limitTooLow" })}
            </span>
          ) : null}
        </div>
      </div>

      <div className="rounded-lg bg-bg-weak px-4 py-3">
        <p className="text-label-sm font-medium text-text-soft">
          {formatMessage({ id: "app.cookieJar.balance" })}
        </p>
        <p className="mt-1 text-headline-sm font-semibold tabular-nums text-text-strong">
          {formatTokenAmount(jar.balance, jar.decimals)}{" "}
          <span className="text-title-sm font-medium text-text-sub">{symbol}</span>
        </p>
      </div>

      <div className="space-y-2">
        {editingField === "limit" ? (
          <JarLimitEditor {...editorProps} />
        ) : (
          <AdminSettingRow
            label={formatMessage({ id: "app.cookieJar.claimLimit" })}
            className="rounded-md bg-bg-weak py-1 pl-3 pr-1"
          >
            <span className="flex items-center gap-1">
              <span className="font-semibold tabular-nums text-text-strong">
                {formatTokenAmount(jar.maxWithdrawal, jar.decimals)} {symbol}
              </span>
              {editButton("limit", formatMessage({ id: "app.cookieJar.editClaimLimit" }))}
            </span>
          </AdminSettingRow>
        )}
        {editingField === "cooldown" ? (
          <JarCooldownEditor {...editorProps} />
        ) : (
          <AdminSettingRow
            label={formatMessage({ id: "app.cookieJar.withdrawalInterval" })}
            className="rounded-md bg-bg-weak py-1 pl-3 pr-1"
          >
            <span className="flex items-center gap-1">
              <span className="font-semibold tabular-nums text-text-strong">
                {cooldownLabel(formatMessage, jar.withdrawalInterval)}
              </span>
              {editButton(
                "cooldown",
                formatMessage({ id: "app.cookieJar.editWithdrawalCooldown" })
              )}
            </span>
          </AdminSettingRow>
        )}
      </div>

      {restricted ? (
        <p
          id={restrictionId}
          className="flex items-start gap-2 rounded-md bg-bg-weak px-3 py-2 text-body-sm text-text-sub"
        >
          <RiLockLine className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            <span className="block font-medium text-text-strong">
              {formatMessage({ id: "app.cookieJar.ownerOnly.title" })}
            </span>
            {signer.owner ? (
              <>
                {formatMessage({ id: "app.cookieJar.ownerOnly.owner" })}{" "}
                <EnsAddressText address={signer.owner} />
              </>
            ) : null}
          </span>
        </p>
      ) : null}

      <p className="text-body-sm text-text-sub">
        {formatMessage(
          {
            id: allocationCountAtLeast
              ? "cockpit.community.payouts.jarFundingContextAtLeast"
              : "cockpit.community.payouts.jarFundingContext",
          },
          { count: allocationCount }
        )}
      </p>

      <div className="mt-auto grid grid-cols-2 gap-2">
        <AdminButton variant="tonal" size="sm" leadingIcon={<RiWalletLine />} onClick={onDeposit}>
          {formatMessage({ id: "app.cookieJar.deposit" })}
        </AdminButton>
        <AdminButton
          variant="filled"
          size="sm"
          leadingIcon={<RiHandCoinLine />}
          onClick={onClaim}
          disabled={jar.isPaused}
        >
          {formatMessage({ id: "app.cookieJar.withdraw" })}
        </AdminButton>
      </div>
    </AdminCard>
  );
}
