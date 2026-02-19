import {
  type Address,
  formatAddress,
  isZeroAddressValue,
  useSetDonationAddress,
} from "@green-goods/shared";
import { RiEdit2Line, RiSaveLine } from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";
import { isAddress } from "viem";

interface DonationAddressConfigProps {
  gardenAddress: Address;
  donationAddress?: Address | null;
  canEdit?: boolean;
}

export function DonationAddressConfig({
  gardenAddress,
  donationAddress,
  canEdit = true,
}: DonationAddressConfigProps) {
  const { formatMessage } = useIntl();
  const [value, setValue] = useState("");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setDonationAddress = useSetDonationAddress();

  const isUnset = isZeroAddressValue(donationAddress);
  const displayValue =
    donationAddress && !isZeroAddressValue(donationAddress)
      ? formatAddress(donationAddress, { variant: "card" })
      : formatMessage({ id: "app.treasury.notSet" });

  const onEdit = () => {
    setValue(isUnset ? "" : (donationAddress ?? ""));
    setError(null);
    setEditing(true);
  };

  const onSave = () => {
    const normalized = value.trim();
    if (!isAddress(normalized) || isZeroAddressValue(normalized)) {
      setError(formatMessage({ id: "app.treasury.invalidAddress" }));
      return;
    }

    setDonationAddress.mutate(
      { gardenAddress, donationAddress: normalized as Address },
      {
        onSuccess: () => {
          setEditing(false);
          setError(null);
        },
      }
    );
  };

  return (
    <section className="rounded-lg border border-stroke-soft bg-bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-text-strong sm:text-lg">
            {formatMessage({ id: "app.treasury.donationAddress" })}
          </h2>
          <p className="mt-1 text-xs text-text-sub sm:text-sm">
            {isUnset
              ? formatMessage({ id: "app.treasury.setDonationFirst" })
              : formatMessage({ id: "app.treasury.donationAddressConfigured" })}
          </p>
        </div>
        {!editing && canEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 rounded-md border border-stroke-sub bg-bg-white px-3 py-1.5 text-sm font-medium text-text-sub transition hover:bg-bg-weak"
          >
            <RiEdit2Line className="h-4 w-4" />
            {formatMessage({ id: "app.treasury.editDonation" })}
          </button>
        )}
      </div>

      {!editing && (
        <div className="mt-4 rounded-md border border-stroke-soft bg-bg-weak px-3 py-2 text-sm text-text-strong">
          {displayValue}
        </div>
      )}

      {editing && canEdit && (
        <div className="mt-4 space-y-3">
          <input
            type="text"
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setError(null);
            }}
            placeholder="0x..."
            className="w-full rounded-md border border-stroke-sub bg-bg-white px-3 py-2 text-sm text-text-strong focus:border-primary-base focus:outline-none focus:ring-2 focus:ring-primary-base/20"
          />
          {error && <p className="text-sm text-error-dark">{error}</p>}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSave}
              disabled={setDonationAddress.isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary-base px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:bg-primary-darker disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RiSaveLine className="h-4 w-4" />
              {formatMessage({ id: "app.treasury.saveDonation" })}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={setDonationAddress.isPending}
              className="inline-flex items-center rounded-md border border-stroke-sub bg-bg-white px-3 py-1.5 text-sm font-medium text-text-sub transition hover:bg-bg-weak"
            >
              {formatMessage({ id: "app.wizard.cancel" })}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
