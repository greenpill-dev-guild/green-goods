import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import { ItemRow } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import type { CookieJar } from "@green-goods/shared/types/cookie-jar";
import type { Address } from "@green-goods/shared/types/domain";
import {
  formatTokenAmount,
  getVaultAssetSymbol,
} from "@green-goods/shared/utils/blockchain/vaults";
import { isJarClaimLimitLow } from "@green-goods/shared/utils/cookie-jar-claim-limit";
import { RiCookieLine, RiHandCoinLine, RiLockLine, RiWalletLine } from "@remixicon/react";
import { useEffect, useId, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
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

/**
 * A garden's cookie jar as a steward funds and configures it, on the shared item row: the
 * asset, the jar's one pill (paused, a limit too low to pay out, or active), its per-claim
 * limit and its balance on the right, with no action on the row. The row opens the jar's page
 * beneath it: its address, the limit and cooldown with their editors, who can change them,
 * what has funded it, and Deposit and Claim. The page stays mounted while it is closed, so an
 * edit in flight keeps its state. A garden's jar only; campaign jars and the stipend jar are
 * other things.
 */
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
  const pageId = useId();
  const symbol = getVaultAssetSymbol(jar.assetAddress, undefined);
  // Disabled, never hidden, so the page keeps one stable set of acts; the note says who can act.
  const restricted = signer.isResolved && !signer.canSign;

  // An editor opens with the page: the low-limit alert's link and the deposit dialog's
  // "Fix Limit First" land on the limit editor with the jar's page open around it.
  const [pageOpen, setPageOpen] = useState(editingField !== null);
  const [openedForField, setOpenedForField] = useState(editingField);
  if (editingField !== openedForField) {
    setOpenedForField(editingField);
    if (editingField) setPageOpen(true);
  }

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
  const limitRow = (
    <FactRow
      label={formatMessage({ id: "app.cookieJar.claimLimit" })}
      value={
        <span className="tabular-nums">
          {formatTokenAmount(jar.maxWithdrawal, jar.decimals)} {symbol}
        </span>
      }
      action={editButton("limit", formatMessage({ id: "app.cookieJar.editClaimLimit" }))}
    />
  );
  const cooldownRow = (
    <FactRow
      label={formatMessage({ id: "app.cookieJar.withdrawalInterval" })}
      value={
        <span className="tabular-nums">{cooldownLabel(formatMessage, jar.withdrawalInterval)}</span>
      }
      action={editButton("cooldown", formatMessage({ id: "app.cookieJar.editWithdrawalCooldown" }))}
    />
  );

  return (
    <div className="flex flex-col gap-2">
      <ItemRow
        lead={{ kind: "icon", icon: <RiCookieLine /> }}
        title={symbol}
        // One pill: a paused jar pays nothing, so paused outranks a limit too low to pay out.
        status={
          jar.isPaused
            ? { label: formatMessage({ id: "app.cookieJar.paused" }), tone: "warning" }
            : isJarClaimLimitLow(jar)
              ? { label: formatMessage({ id: "app.cookieJar.limitTooLow" }), tone: "warning" }
              : { label: formatMessage({ id: "app.cookieJar.active" }), tone: "success" }
        }
        details={[
          formatMessage(
            { id: "app.cookieJar.perClaim" },
            { amount: formatTokenAmount(jar.maxWithdrawal, jar.decimals), asset: symbol }
          ),
        ]}
        amount={{
          value: `${formatTokenAmount(jar.balance, jar.decimals, 4, undefined, true)} ${symbol}`,
          caption: formatMessage({ id: "app.cookieJar.balance" }),
        }}
        onOpen={() => setPageOpen(!pageOpen)}
        aria-expanded={pageOpen}
        aria-controls={pageId}
      />

      {/* Hidden, not unmounted: an editor's write in flight keeps its state. */}
      <div id={pageId} hidden={!pageOpen}>
        <div className="gg-card gg-item-row-page flex flex-col gap-4 p-4">
          <p className="type-meta-sm text-text-soft">
            <EnsAddressText address={jar.jarAddress} />
          </p>

          {/* One fact per setting; the setting being changed shows its editor in its place. */}
          <div className="space-y-2">
            {editingField === "limit" ? (
              <>
                <JarLimitEditor {...editorProps} />
                <FactList frame="inset">{cooldownRow}</FactList>
              </>
            ) : editingField === "cooldown" ? (
              <>
                <FactList frame="inset">{limitRow}</FactList>
                <JarCooldownEditor {...editorProps} />
              </>
            ) : (
              <FactList frame="inset">
                {limitRow}
                {cooldownRow}
              </FactList>
            )}
          </div>

          {restricted ? (
            <p
              id={restrictionId}
              className="flex items-start gap-2 rounded-md bg-bg-weak px-3 py-2 type-meta text-text-sub"
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

          <p className="type-meta text-text-sub">
            {formatMessage(
              {
                id: allocationCountAtLeast
                  ? "cockpit.community.payouts.jarFundingContextAtLeast"
                  : "cockpit.community.payouts.jarFundingContext",
              },
              { count: allocationCount }
            )}
          </p>

          <div className="grid grid-cols-2 gap-2">
            <AdminButton
              variant="tonal"
              size="sm"
              leadingIcon={<RiWalletLine />}
              onClick={onDeposit}
            >
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
        </div>
      </div>
    </div>
  );
}
