import {
  type Address,
  Alert,
  Button,
  type AllowlistEntry,
  cn,
  type DistributionMode,
  sumUnits,
  TextInput,
  TOTAL_UNITS,
  useCopyToClipboard,
} from "@green-goods/shared";
import { RiCheckLine, RiCloseLine, RiFileCopyLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { isAddress, zeroAddress } from "viem";
import { DistributionChart } from "../DistributionChart";

/** Displays truncated Ethereum address with copy button */
function TruncatedAddress({ address }: { address: Address }) {
  const { formatMessage } = useIntl();
  const { copied, copy } = useCopyToClipboard();

  const truncated = `${address.slice(0, 6)}...${address.slice(-4)}`;

  return (
    <span className="inline-flex items-center gap-1">
      <span title={address} className="font-mono text-xs">
        {truncated}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => copy(address)}
        className="h-auto min-w-0 rounded p-0.5 text-text-sub transition hover:bg-bg-weak hover:text-text-strong focus:outline-none focus:ring-1 focus:ring-primary-light"
        aria-label={formatMessage({ id: "app.common.copyAddress" })}
      >
        {copied ? (
          <RiCheckLine className="h-3 w-3 text-success-base" />
        ) : (
          <RiFileCopyLine className="h-3 w-3" />
        )}
      </Button>
    </span>
  );
}

interface DistributionConfigProps {
  mode: DistributionMode;
  allowlist: AllowlistEntry[];
  totalUnits?: bigint;
  onModeChange: (mode: DistributionMode) => void;
  onAllowlistChange: (entries: AllowlistEntry[]) => void;
}

const MODE_OPTIONS: Array<{ value: DistributionMode; labelId: string }> = [
  { value: "equal", labelId: "app.hypercerts.distribution.mode.equal" },
  { value: "count", labelId: "app.hypercerts.distribution.mode.count" },
  { value: "value", labelId: "app.hypercerts.distribution.mode.value" },
  { value: "custom", labelId: "app.hypercerts.distribution.mode.custom" },
];

export function DistributionConfig({
  mode,
  allowlist,
  totalUnits = TOTAL_UNITS,
  onModeChange,
  onAllowlistChange,
}: DistributionConfigProps) {
  const { formatMessage } = useIntl();

  const unitsTotal = sumUnits(allowlist);
  const hasUnitsMismatch = allowlist.length > 0 && unitsTotal !== totalUnits;
  const hasNonPositive = allowlist.some((entry) => entry.units <= 0n);
  const isEmpty = allowlist.length === 0;
  const showError = isEmpty || hasUnitsMismatch || hasNonPositive;

  const handleUnitsChange = (index: number, value: string) => {
    const numeric = value.replace(/[^0-9]/g, "");
    const nextUnits = numeric ? BigInt(numeric) : 0n;
    const updated = [...allowlist];
    updated[index] = { ...updated[index], units: nextUnits };
    onAllowlistChange(updated);
  };

  const handleAddressChange = (index: number, value: string) => {
    if (!isAddress(value)) {
      return;
    }

    const updated = [...allowlist];
    updated[index] = {
      ...updated[index],
      address: value,
    };
    onAllowlistChange(updated);
  };

  const handleRemoveRecipient = (index: number) => {
    const updated = allowlist.filter((_, i) => i !== index);
    onAllowlistChange(updated);
  };

  const handleAddRecipient = () => {
    onAllowlistChange([
      ...allowlist,
      {
        address: zeroAddress,
        units: 0n,
        label: formatMessage({ id: "app.hypercerts.distribution.recipient.new" }),
      },
    ]);
  };

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-text-strong">
          {formatMessage({ id: "app.hypercerts.distribution.title" })}
        </h2>
        <p className="text-sm text-text-sub">
          {formatMessage({ id: "app.hypercerts.distribution.subtitle" })}
        </p>
      </header>

      {allowlist.length > 0 && (
        <div className="flex justify-center rounded-lg border border-stroke-soft bg-bg-white p-4">
          <DistributionChart allowlist={allowlist} totalUnits={totalUnits} />
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {MODE_OPTIONS.map((option) => {
          const isSelected = option.value === mode;
          return (
            <Button
              key={option.value}
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onModeChange(option.value)}
              className={cn(
                "h-auto min-w-0 rounded-lg border px-3 py-2 text-xs font-medium transition",
                isSelected
                  ? "border-primary-base bg-primary-lighter text-primary-dark"
                  : "border-stroke-sub text-text-sub"
              )}
            >
              {formatMessage({ id: option.labelId })}
            </Button>
          );
        })}
      </div>

      {showError && (
        <Alert variant="error">
          {isEmpty
            ? formatMessage({ id: "app.hypercerts.distribution.error.empty" })
            : hasNonPositive
              ? formatMessage({ id: "app.hypercerts.distribution.error.nonPositive" })
              : formatMessage(
                  { id: "app.hypercerts.distribution.error.unitsMismatch" },
                  { total: totalUnits.toLocaleString(), current: unitsTotal.toLocaleString() }
                )}
        </Alert>
      )}

      <div className="overflow-x-auto rounded-lg border border-stroke-soft bg-bg-white">
        <div
          className={cn(
            "grid min-w-[400px] gap-2 border-b border-stroke-soft bg-bg-weak px-4 py-2 text-xs font-medium text-text-sub",
            mode === "custom"
              ? "grid-cols-[minmax(120px,2fr)_minmax(80px,1fr)_minmax(60px,1fr)_auto]"
              : "grid-cols-[minmax(120px,2fr)_minmax(80px,1fr)_minmax(60px,1fr)]"
          )}
        >
          <span>{formatMessage({ id: "app.hypercerts.distribution.table.recipient" })}</span>
          <span>{formatMessage({ id: "app.hypercerts.distribution.table.units" })}</span>
          <span>{formatMessage({ id: "app.hypercerts.distribution.table.percent" })}</span>
          {mode === "custom" && <span className="sr-only">Actions</span>}
        </div>
        <div className="divide-y divide-stroke-soft">
          {allowlist.map((entry, index) => {
            const percent = totalUnits > 0n ? Number((entry.units * 10000n) / totalUnits) / 100 : 0;
            const addressValid = isAddress(entry.address);
            const errorId = `address-error-${index}`;
            return (
              <div
                key={`${entry.address}-${index}`}
                className={cn(
                  "grid min-w-[400px] items-center gap-2 px-4 py-3 text-sm",
                  mode === "custom"
                    ? "grid-cols-[minmax(120px,2fr)_minmax(80px,1fr)_minmax(60px,1fr)_auto]"
                    : "grid-cols-[minmax(120px,2fr)_minmax(80px,1fr)_minmax(60px,1fr)]"
                )}
              >
                <div className="space-y-1">
                  {mode === "custom" ? (
                    <TextInput
                      surface="admin"
                      value={entry.address}
                      onChange={(event) => handleAddressChange(index, event.target.value)}
                      aria-label={formatMessage({
                        id: "app.hypercerts.distribution.table.recipient",
                      })}
                      aria-invalid={!addressValid}
                      aria-describedby={!addressValid ? errorId : undefined}
                      className={cn(
                        "w-full rounded-md border px-2 py-1 text-xs",
                        addressValid ? "border-stroke-sub" : "border-error-light"
                      )}
                    />
                  ) : (
                    <TruncatedAddress address={entry.address} />
                  )}
                  {!addressValid && mode === "custom" && (
                    <span id={errorId} className="text-xs text-error-dark">
                      {formatMessage({ id: "app.hypercerts.distribution.error.invalidAddress" })}
                    </span>
                  )}
                  {entry.label && <p className="text-xs text-text-sub">{entry.label}</p>}
                </div>
                <TextInput
                  surface="admin"
                  value={entry.units.toString()}
                  onChange={(event) => handleUnitsChange(index, event.target.value)}
                  disabled={mode !== "custom"}
                  aria-label={formatMessage({ id: "app.hypercerts.distribution.table.units" })}
                  className={cn(
                    "w-full rounded-md border px-2 py-1 text-xs",
                    mode !== "custom" ? "bg-bg-weak" : "border-stroke-sub"
                  )}
                />
                <span className="text-xs text-text-sub">{percent.toFixed(2)}%</span>
                {mode === "custom" && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveRecipient(index)}
                    aria-label={formatMessage(
                      { id: "app.hypercerts.distribution.removeRecipient" },
                      { address: entry.label || entry.address }
                    )}
                    className="h-auto min-w-0 rounded p-1 text-text-sub transition hover:bg-error-lighter hover:text-error-dark focus:outline-none focus:ring-2 focus:ring-error-light"
                  >
                    <RiCloseLine className="h-4 w-4" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {mode === "custom" && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleAddRecipient}
          className="rounded-md border border-stroke-sub px-3 py-2 text-xs font-medium text-text-sub transition hover:bg-bg-weak"
        >
          {formatMessage({ id: "app.hypercerts.distribution.addRecipient" })}
        </Button>
      )}

      <div className="text-xs text-text-sub">
        {formatMessage(
          { id: "app.hypercerts.distribution.total" },
          { total: unitsTotal.toLocaleString() }
        )}
      </div>
    </div>
  );
}
