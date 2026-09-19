import { Alert } from "@green-goods/shared/components/Alert";
import {
  useCookieJarUpdateInterval,
  useCookieJarUpdateMaxWithdrawal,
} from "@green-goods/shared/hooks/cookie-jar/useCookieJarAdmin";
import type { CookieJar } from "@green-goods/shared/types/cookie-jar";
import type { Address } from "@green-goods/shared/types/domain";
import {
  formatTokenAmount,
  getVaultAssetSymbol,
  validateDecimalInput,
} from "@green-goods/shared/utils/blockchain/vaults";
import {
  claimsToEmptyJar,
  formatClaimCadence,
  getJarClaimLimitGuidance,
  isJarClaimLimitLow,
} from "@green-goods/shared/utils/cookie-jar-claim-limit";
import { type ReactNode, useState } from "react";
import { type IntlShape, useIntl } from "react-intl";
import { formatUnits, parseUnits } from "viem";
import { AdminButton } from "@/components/AdminButton";
import { AdminConfirmDialog } from "@/components/AdminDialog";
import { AdminInlineField } from "@/components/AdminInlineField";
import { AdminSelect } from "@/components/AdminTextField";
import { EnsAddressText } from "@/components/EnsAddressText";

// The in-place editors for a jar's per-claim limit and cooldown. Both write through the garden
// account (see useCookieJarAdmin) and name the change in a confirmation before anything is sent.

const COOLDOWN_PRESETS = [
  { label: "1h", seconds: 3_600n },
  { label: "6h", seconds: 21_600n },
  { label: "12h", seconds: 43_200n },
  { label: "1d", seconds: 86_400n },
  { label: "7d", seconds: 604_800n },
] as const;

export function cooldownLabel(formatMessage: IntlShape["formatMessage"], seconds: bigint) {
  const secs = Number(seconds);
  if (secs <= 0) return formatMessage({ id: "cockpit.community.payouts.noCooldown" });
  if (secs >= 86_400) return `${Math.floor(secs / 86_400)}d`;
  if (secs >= 3_600) return `${Math.floor(secs / 3_600)}h`;
  if (secs >= 60) return `${Math.floor(secs / 60)}m`;
  return `${secs}s`;
}

function ChangeSummary({ rows }: { rows: Array<[term: string, value: ReactNode]> }) {
  return (
    <dl className="divide-y divide-stroke-soft rounded-lg bg-bg-weak px-3">
      {rows.map(([term, value]) => (
        <div key={term} className="flex items-baseline justify-between gap-3 py-2">
          <dt className="shrink-0 text-label-sm text-text-soft">{term}</dt>
          <dd className="text-right text-body-sm font-medium tabular-nums text-text-strong">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

interface JarSettingEditorProps {
  jar: CookieJar;
  gardenAddress: Address;
  gardenName: string;
  onClose: () => void;
}

function EditorFooter({
  submitLabel,
  canSubmit,
  onCancel,
  onSubmit,
}: {
  submitLabel: string;
  canSubmit: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const { formatMessage } = useIntl();
  return (
    <>
      {/* The write goes through the garden account: a steward's own wallet can't change a jar. */}
      <p className="px-3 text-label-sm text-text-soft">
        {formatMessage({ id: "app.cookieJar.signsAsGarden" })}
      </p>
      <div className="flex flex-wrap justify-end gap-2">
        <AdminButton type="button" variant="outlined" onClick={onCancel}>
          {formatMessage({ id: "app.common.cancel" })}
        </AdminButton>
        <AdminButton type="button" disabled={!canSubmit} onClick={onSubmit}>
          {submitLabel}
        </AdminButton>
      </div>
    </>
  );
}

export function JarLimitEditor({ jar, gardenAddress, gardenName, onClose }: JarSettingEditorProps) {
  const { formatMessage } = useIntl();
  const mutation = useCookieJarUpdateMaxWithdrawal(gardenAddress);
  const symbol = getVaultAssetSymbol(jar.assetAddress, undefined);
  const guidance = getJarClaimLimitGuidance(jar);
  // A low limit opens on the suggested value; a deliberate one opens on itself.
  const [draft, setDraft] = useState(() =>
    formatUnits(
      guidance && isJarClaimLimitLow(jar) ? guidance.suggested : jar.maxWithdrawal,
      jar.decimals
    )
  );
  const [confirming, setConfirming] = useState(false);

  const inputError = validateDecimalInput(draft, jar.decimals);
  let parsed: bigint | null = null;
  if (draft.trim() && !inputError) {
    try {
      parsed = parseUnits(draft, jar.decimals);
    } catch {
      parsed = null;
    }
  }
  const error = inputError
    ? formatMessage({ id: inputError })
    : parsed === 0n
      ? formatMessage({ id: "app.cookieJar.claimLimitZero" })
      : undefined;
  const nextLimit = parsed !== null && parsed > 0n ? parsed : null;
  const canSubmit = nextLimit !== null && nextLimit !== jar.maxWithdrawal;
  const belowFloor = guidance !== null && nextLimit !== null && nextLimit < guidance.floor;
  const cadence = formatClaimCadence(formatMessage, jar.withdrawalInterval);
  const amount = (value: bigint) => formatTokenAmount(value, jar.decimals);

  const hint = [
    formatMessage({ id: "app.cookieJar.claimLimitHelp" }, { cadence }),
    guidance
      ? formatMessage(
          { id: "app.cookieJar.claimLimitSuggested" },
          { amount: amount(guidance.suggested), asset: symbol }
        )
      : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="space-y-2 rounded-md px-3 py-3 ring-1 ring-inset ring-stroke-sub">
      <AdminInlineField
        label={formatMessage({ id: "app.cookieJar.claimLimit" })}
        value={draft}
        onChange={setDraft}
        onSubmit={() => canSubmit && setConfirming(true)}
        inputMode="decimal"
        error={error}
        hint={hint}
        inputProps={{
          autoFocus: true,
          onKeyDown: (event) => {
            if (event.key === "Escape") onClose();
          },
        }}
        action={<span className="text-label-lg font-medium text-text-sub">{symbol}</span>}
      />
      {/* Advice, not a block: a steward may have a reason for a small limit. */}
      {belowFloor && nextLimit !== null ? (
        <Alert variant="warning" className="p-3">
          {formatMessage(
            { id: "app.cookieJar.claimLimitLowAmount" },
            { amount: amount(nextLimit), asset: symbol }
          )}
          {jar.balance > 0n
            ? ` ${formatMessage(
                { id: "app.cookieJar.claimsToEmpty" },
                { count: Number(claimsToEmptyJar(jar.balance, nextLimit)) }
              )}`
            : null}
        </Alert>
      ) : null}
      <EditorFooter
        submitLabel={formatMessage({ id: "app.cookieJar.updateLimit" })}
        canSubmit={canSubmit}
        onCancel={onClose}
        onSubmit={() => setConfirming(true)}
      />

      <AdminConfirmDialog
        isOpen={confirming && nextLimit !== null}
        onClose={() => setConfirming(false)}
        tone="community"
        title={formatMessage({ id: "app.cookieJar.confirmLimit.title" })}
        description={formatMessage(
          { id: "app.cookieJar.confirmLimit.description" },
          { garden: gardenName, amount: amount(nextLimit ?? 0n), asset: symbol, cadence }
        )}
        confirmLabel={formatMessage({ id: "app.cookieJar.updateLimit" })}
        isLoading={mutation.isPending}
        onConfirm={() => {
          if (nextLimit === null) return;
          mutation.mutate(
            { jarAddress: jar.jarAddress, maxWithdrawal: nextLimit },
            {
              onSuccess: () => {
                setConfirming(false);
                onClose();
              },
            }
          );
        }}
      >
        <ChangeSummary
          rows={[
            [
              formatMessage({ id: "app.cookieJar.confirm.jar" }),
              <>
                {symbol} · <EnsAddressText address={jar.jarAddress} />
              </>,
            ],
            [
              formatMessage({ id: "app.cookieJar.claimLimit" }),
              `${formatMessage(
                { id: "app.cookieJar.confirm.change" },
                { from: amount(jar.maxWithdrawal), to: amount(nextLimit ?? 0n) }
              )} ${symbol}`,
            ],
            [
              formatMessage({ id: "app.cookieJar.confirm.holds" }),
              // Names the uncomfortable part before the act.
              jar.balance > 0n && nextLimit !== null && nextLimit >= jar.balance
                ? formatMessage(
                    { id: "app.cookieJar.confirm.holdsCouldEmpty" },
                    { amount: amount(jar.balance), asset: symbol }
                  )
                : `${amount(jar.balance)} ${symbol}`,
            ],
            [
              formatMessage({ id: "app.cookieJar.confirm.signsAs" }),
              formatMessage({ id: "app.cookieJar.confirm.gardenAccount" }),
            ],
          ]}
        />
      </AdminConfirmDialog>
    </div>
  );
}

export function JarCooldownEditor({
  jar,
  gardenAddress,
  gardenName,
  onClose,
}: JarSettingEditorProps) {
  const { formatMessage } = useIntl();
  const mutation = useCookieJarUpdateInterval(gardenAddress);
  const symbol = getVaultAssetSymbol(jar.assetAddress, undefined);
  const [draft, setDraft] = useState(String(jar.withdrawalInterval));
  const [confirming, setConfirming] = useState(false);
  const nextInterval = BigInt(draft);
  const canSubmit = nextInterval !== jar.withdrawalInterval;
  const isPreset = COOLDOWN_PRESETS.some((preset) => preset.seconds === jar.withdrawalInterval);

  return (
    <div className="space-y-2 rounded-md px-3 py-3 ring-1 ring-inset ring-stroke-sub">
      <AdminSelect
        label={formatMessage({ id: "app.cookieJar.withdrawalInterval" })}
        helperText={formatMessage({ id: "app.cookieJar.cooldownHelp" })}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        selectProps={{
          autoFocus: true,
          onKeyDown: (event) => {
            if (event.key === "Escape") onClose();
          },
        }}
      >
        {isPreset ? null : (
          <option value={String(jar.withdrawalInterval)}>
            {cooldownLabel(formatMessage, jar.withdrawalInterval)}
          </option>
        )}
        {COOLDOWN_PRESETS.map((preset) => (
          <option key={preset.label} value={String(preset.seconds)}>
            {preset.label}
          </option>
        ))}
      </AdminSelect>
      <EditorFooter
        submitLabel={formatMessage({ id: "app.cookieJar.updateCooldown" })}
        canSubmit={canSubmit}
        onCancel={onClose}
        onSubmit={() => setConfirming(true)}
      />

      <AdminConfirmDialog
        isOpen={confirming}
        onClose={() => setConfirming(false)}
        tone="community"
        title={formatMessage({ id: "app.cookieJar.confirmCooldown.title" })}
        description={formatMessage(
          { id: "app.cookieJar.confirmCooldown.description" },
          { garden: gardenName, cadence: formatClaimCadence(formatMessage, nextInterval) }
        )}
        confirmLabel={formatMessage({ id: "app.cookieJar.updateCooldown" })}
        isLoading={mutation.isPending}
        onConfirm={() =>
          mutation.mutate(
            { jarAddress: jar.jarAddress, withdrawalInterval: nextInterval },
            {
              onSuccess: () => {
                setConfirming(false);
                onClose();
              },
            }
          )
        }
      >
        <ChangeSummary
          rows={[
            [
              formatMessage({ id: "app.cookieJar.confirm.jar" }),
              <>
                {symbol} · <EnsAddressText address={jar.jarAddress} />
              </>,
            ],
            [
              formatMessage({ id: "app.cookieJar.withdrawalInterval" }),
              formatMessage(
                { id: "app.cookieJar.confirm.change" },
                {
                  from: cooldownLabel(formatMessage, jar.withdrawalInterval),
                  to: cooldownLabel(formatMessage, nextInterval),
                }
              ),
            ],
            [
              formatMessage({ id: "app.cookieJar.confirm.signsAs" }),
              formatMessage({ id: "app.cookieJar.confirm.gardenAccount" }),
            ],
          ]}
        />
      </AdminConfirmDialog>
    </div>
  );
}
