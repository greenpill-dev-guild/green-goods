import {
  type Address,
  buildSendRecipientGroups,
  cn,
  flattenRecipientMembers,
  logger,
  useEnsAddress,
  useGardens,
  useRecentRecipients,
  useUser,
} from "@green-goods/shared";
import { RiArrowDownSLine, RiLoader4Line, RiQrScan2Line, RiUserLine } from "@remixicon/react";
import { useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { isAddress } from "viem";
import { EmptyState } from "@/components/Communication";
import { MemberRow } from "./MemberRow";
import { isQrScanSupported, QRScanner } from "./QRScanner";
import type { SelectedRecipient } from "./types";

/** Cap the flattened "all gardens" slice; search reaches the rest. */
const PROTOCOL_RENDER_CAP = 50;

interface RecipientPickerProps {
  selectedAddress?: Address;
  onSelect: (recipient: SelectedRecipient) => void;
}

export function RecipientPicker({ selectedAddress, onSelect }: RecipientPickerProps) {
  const { formatMessage } = useIntl();
  const { primaryAddress } = useUser();
  const { data: gardens = [] } = useGardens();
  const recents = useRecentRecipients();

  const [query, setQuery] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const trimmed = query.trim();
  const queryIsAddress = isAddress(trimmed);
  const looksLikeEns = !queryIsAddress && trimmed.includes(".");
  const { data: resolvedEns, isFetching: ensResolving } = useEnsAddress(
    looksLikeEns ? trimmed : undefined,
    { enabled: looksLikeEns }
  );

  const { myGroups, otherFlat } = useMemo(() => {
    const groups = buildSendRecipientGroups(gardens, primaryAddress);
    return {
      myGroups: groups.filter((group) => group.isMine),
      otherFlat: flattenRecipientMembers(groups.filter((group) => !group.isMine)),
    };
  }, [gardens, primaryAddress]);

  const searchResults = useMemo(() => {
    if (!trimmed) return [];
    const needle = trimmed.toLowerCase();
    const groups = buildSendRecipientGroups(gardens, primaryAddress);
    return flattenRecipientMembers(groups).filter((member) =>
      member.address.toLowerCase().includes(needle)
    );
  }, [gardens, primaryAddress, trimmed]);

  const otherShown = Math.min(otherFlat.length, PROTOCOL_RENDER_CAP);
  useEffect(() => {
    if (showAll && otherFlat.length > otherShown) {
      logger.info("Send recipient list truncated", {
        shown: otherShown,
        total: otherFlat.length,
      });
    }
  }, [showAll, otherShown, otherFlat.length]);

  const isSelected = (address: Address) =>
    Boolean(selectedAddress && selectedAddress.toLowerCase() === address.toLowerCase());

  const manualAddress: Address | null = queryIsAddress
    ? (trimmed as Address)
    : (resolvedEns ?? null);
  const showResolveFailed = looksLikeEns && !ensResolving && !resolvedEns;
  const showInvalid =
    trimmed.length > 0 && !queryIsAddress && !looksLikeEns && searchResults.length === 0;

  if (showScanner) {
    return (
      <QRScanner
        onClose={() => setShowScanner(false)}
        onResult={(address) => {
          setShowScanner(false);
          onSelect({ address, source: "qr" });
        }}
      />
    );
  }

  return (
    <div className="space-y-3 p-4">
      {/* Search / paste / ENS input with QR affordance */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={formatMessage({ id: "app.send.recipient.searchPlaceholder" })}
          aria-label={formatMessage({ id: "app.send.recipient.searchPlaceholder" })}
          className="w-full rounded-md border border-stroke-sub-300 bg-bg-white-0 px-3 py-2.5 text-sm text-text-strong-950 placeholder:text-text-soft-400 focus:border-primary-base focus:outline-none focus:ring-2 focus:ring-primary-base/20"
        />
        {isQrScanSupported() ? (
          <button
            type="button"
            onClick={() => setShowScanner(true)}
            aria-label={formatMessage({ id: "app.send.qr.scan" })}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-md border border-stroke-sub-300 bg-bg-white-0 text-text-sub-600 hover:bg-bg-weak-50"
          >
            <RiQrScan2Line className="h-5 w-5" aria-hidden />
          </button>
        ) : null}
      </div>

      {/* Manual / ENS confirmation row */}
      {manualAddress ? (
        <MemberRow
          address={manualAddress}
          selected={isSelected(manualAddress)}
          onSelect={() =>
            onSelect({
              address: manualAddress,
              source: queryIsAddress ? "manual" : "ens",
              ensName: looksLikeEns ? trimmed : undefined,
            })
          }
        />
      ) : null}
      {ensResolving ? (
        <p className="flex items-center gap-2 text-xs text-text-soft-400">
          <RiLoader4Line className="h-4 w-4 animate-spin" aria-hidden />
          {formatMessage({ id: "app.send.recipient.resolving" })}
        </p>
      ) : null}
      {showResolveFailed ? (
        <p className="text-xs text-warning-dark" role="alert">
          {formatMessage({ id: "app.send.recipient.resolveFailed" })}
        </p>
      ) : null}
      {showInvalid ? (
        <p className="text-xs text-text-soft-400">
          {formatMessage({ id: "app.send.recipient.invalidAddress" })}
        </p>
      ) : null}

      {/* Search results (address match) */}
      {trimmed && searchResults.length > 0 ? (
        <div className="space-y-2">
          {searchResults.map((member) => (
            <MemberRow
              key={member.address}
              address={member.address}
              roles={member.roles}
              gardenName={member.gardenName}
              selected={isSelected(member.address)}
              onSelect={() =>
                onSelect({
                  address: member.address,
                  source: "garden",
                  roles: member.roles,
                  gardenName: member.gardenName,
                })
              }
            />
          ))}
        </div>
      ) : null}

      {/* Default browse mode (no query) */}
      {!trimmed ? (
        <>
          {recents.length > 0 ? (
            <section className="space-y-2">
              <h4 className="text-xs font-medium uppercase tracking-wide text-text-soft-400">
                {formatMessage({ id: "app.send.recipient.recentTitle" })}
              </h4>
              {recents.map((recent) => (
                <MemberRow
                  key={recent.address}
                  address={recent.address}
                  selected={isSelected(recent.address)}
                  onSelect={() =>
                    onSelect({ address: recent.address, source: "recent", ensName: recent.ens })
                  }
                />
              ))}
            </section>
          ) : null}

          {myGroups.map((group) => (
            <section key={group.gardenId} className="space-y-2">
              <h4
                className="truncate text-xs font-medium uppercase tracking-wide text-text-soft-400"
                title={group.gardenName}
              >
                {group.gardenName}
              </h4>
              {group.members.map((member) => (
                <MemberRow
                  key={member.address}
                  address={member.address}
                  roles={member.roles}
                  selected={isSelected(member.address)}
                  onSelect={() =>
                    onSelect({
                      address: member.address,
                      source: "garden",
                      roles: member.roles,
                      gardenName: group.gardenName,
                    })
                  }
                />
              ))}
            </section>
          ))}

          {otherFlat.length > 0 ? (
            <section className="space-y-2">
              <button
                type="button"
                onClick={() => setShowAll((value) => !value)}
                aria-expanded={showAll}
                className="flex w-full items-center justify-between rounded-md py-1 text-xs font-medium uppercase tracking-wide text-text-soft-400"
              >
                {formatMessage({ id: "app.send.recipient.allGardens" })}
                <RiArrowDownSLine
                  className={cn("h-4 w-4 transition-transform", showAll && "rotate-180")}
                  aria-hidden
                />
              </button>
              {showAll ? (
                <div className="space-y-2">
                  {otherFlat.slice(0, PROTOCOL_RENDER_CAP).map((member) => (
                    <MemberRow
                      key={member.address}
                      address={member.address}
                      roles={member.roles}
                      gardenName={member.gardenName}
                      selected={isSelected(member.address)}
                      onSelect={() =>
                        onSelect({
                          address: member.address,
                          source: "garden",
                          roles: member.roles,
                          gardenName: member.gardenName,
                        })
                      }
                    />
                  ))}
                  {otherFlat.length > PROTOCOL_RENDER_CAP ? (
                    <p className="px-1 text-xs text-text-soft-400">
                      {formatMessage(
                        { id: "app.send.recipient.showingCount" },
                        { shown: PROTOCOL_RENDER_CAP, total: otherFlat.length }
                      )}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </section>
          ) : null}

          {recents.length === 0 && myGroups.length === 0 && otherFlat.length === 0 ? (
            <EmptyState
              icon={<RiUserLine />}
              title={formatMessage({ id: "app.send.recipient.empty" })}
              description={formatMessage({ id: "app.send.recipient.emptyDescription" })}
            />
          ) : null}
        </>
      ) : null}

      {/* Search returned nothing and input isn't a usable address */}
      {trimmed &&
      searchResults.length === 0 &&
      !manualAddress &&
      !ensResolving &&
      !showResolveFailed ? (
        <p className="px-1 text-xs text-text-soft-400">
          {formatMessage({ id: "app.send.recipient.searchEmpty" })}
        </p>
      ) : null}
    </div>
  );
}
