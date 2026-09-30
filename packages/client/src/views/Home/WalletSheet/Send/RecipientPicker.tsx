import { Button } from "@green-goods/shared/components/Button";
import { SheetHeading } from "@green-goods/shared/components/Dialog/SheetHeading";
import { TextInput } from "@green-goods/shared/components/Form/ControlPrimitives";
import { IconButton } from "@green-goods/shared/components/IconButton";
import { useUser } from "@green-goods/shared/hooks/auth/useUser";
import { useGardens } from "@green-goods/shared/hooks/blockchain/useBaseLists";
import { useEnsAddress } from "@green-goods/shared/hooks/blockchain/useEnsAddress";
import { useRecentRecipients } from "@green-goods/shared/hooks/blockchain/useRecentRecipients";
import type { Address } from "@green-goods/shared/types/domain";
import {
  buildRecipientDirectory,
  flattenRecipientMembers,
  sharedGardenNames,
} from "@green-goods/shared/utils/app/send-recipients";
import {
  RiArrowLeftLine,
  RiArrowRightSLine,
  RiLoader4Line,
  RiQrScan2Line,
  RiUserLine,
} from "@remixicon/react";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { isAddress } from "viem";
import { EmptyState } from "@/components/Communication";
import { MemberRow } from "./MemberRow";
import { isQrScanSupported, QRScanner } from "./QRScanner";
import type { SelectedRecipient } from "./types";

interface RecipientPickerProps {
  selectedAddress?: Address;
  onSelect: (recipient: SelectedRecipient) => void;
  gDollarOnly?: boolean;
}

export function RecipientPicker({
  selectedAddress,
  onSelect,
  gDollarOnly = false,
}: RecipientPickerProps) {
  const { formatMessage } = useIntl();
  const { primaryAddress } = useUser();
  const { data: gardens = [] } = useGardens();
  const recents = useRecentRecipients();

  const [query, setQuery] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [browseGardenId, setBrowseGardenId] = useState<string | null>(null);
  const [recipientRejected, setRecipientRejected] = useState(false);

  const trimmed = query.trim();
  const queryIsAddress = isAddress(trimmed);
  const looksLikeEns = trimmed.includes(".") && !queryIsAddress;
  const { data: resolvedEns, isFetching: ensResolving } = useEnsAddress(
    looksLikeEns ? trimmed : undefined,
    { enabled: looksLikeEns }
  );

  const directory = useMemo(
    () => buildRecipientDirectory(gardens, primaryAddress, gDollarOnly ? "gardener" : undefined),
    [gardens, primaryAddress, gDollarOnly]
  );
  const canSelect = (address: Address) =>
    !gDollarOnly || directory.byAddress.has(address.toLowerCase());
  const selectRecipient = (recipient: SelectedRecipient) => {
    if (!canSelect(recipient.address)) {
      setRecipientRejected(true);
      return;
    }
    setRecipientRejected(false);
    onSelect(recipient);
  };

  // Search matches wallet address or garden name across every garden (person-name
  // search is limited to the ENS input path — resolving every member is too costly).
  const searchResults = useMemo(() => {
    if (!trimmed) return [];
    const needle = trimmed.toLowerCase();
    return flattenRecipientMembers([...directory.myGardens, ...directory.otherGardens]).filter(
      (member) =>
        member.address.toLowerCase().includes(needle) ||
        member.gardenName.toLowerCase().includes(needle)
    );
  }, [directory, trimmed]);

  const isSelected = (address: Address) =>
    Boolean(selectedAddress && selectedAddress.toLowerCase() === address.toLowerCase());

  const manualAddress: Address | null = queryIsAddress
    ? (trimmed as Address)
    : ((resolvedEns as Address | undefined) ?? null);
  const showResolveFailed = looksLikeEns && !ensResolving && !resolvedEns;
  const manualAddressRejected = Boolean(manualAddress && !canSelect(manualAddress));
  const eligibleRecents = recents.filter((recent) => canSelect(recent.address));
  const showInvalid =
    trimmed.length > 0 && !queryIsAddress && !looksLikeEns && searchResults.length === 0;

  const browseGarden = browseGardenId
    ? directory.otherGardens.find((group) => group.gardenId === browseGardenId)
    : null;

  if (showScanner) {
    return (
      <QRScanner
        onClose={() => setShowScanner(false)}
        onResult={(address) => {
          setShowScanner(false);
          selectRecipient({ address, source: "qr" });
        }}
      />
    );
  }

  return (
    <div className="space-y-3 p-4">
      {gDollarOnly ? (
        <p className="text-xs text-text-sub-600">
          {formatMessage({ id: "app.send.recipient.gardenerOnly" })}
        </p>
      ) : null}
      {/* Search / paste / ENS input with QR affordance */}
      <div className="flex items-center gap-2">
        <TextInput
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={formatMessage({ id: "app.send.recipient.searchPlaceholder" })}
          aria-label={formatMessage({ id: "app.send.recipient.searchPlaceholder" })}
        />
        {isQrScanSupported() ? (
          <IconButton
            emphasis="secondary"
            onClick={() => setShowScanner(true)}
            aria-label={formatMessage({ id: "app.send.qr.scan" })}
            icon={<RiQrScan2Line aria-hidden="true" />}
          />
        ) : null}
      </div>

      {/* Manual / ENS confirmation row */}
      {manualAddress && !manualAddressRejected ? (
        <MemberRow
          address={manualAddress}
          selected={isSelected(manualAddress)}
          onSelect={() =>
            selectRecipient({
              address: manualAddress,
              source: queryIsAddress ? "manual" : "ens",
              ensName: looksLikeEns ? trimmed : undefined,
            })
          }
        />
      ) : null}
      {manualAddressRejected || recipientRejected ? (
        <p className="text-xs text-warning-dark" role="alert">
          {formatMessage({ id: "app.send.recipient.gardenerOnly" })}
        </p>
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

      {/* Search results (address / garden-name match) */}
      {trimmed && searchResults.length > 0 ? (
        <div className="space-y-2">
          {searchResults.map((member) => (
            <MemberRow
              key={member.address}
              address={member.address}
              roles={member.roles}
              gardenName={member.gardenName}
              sharedGardens={sharedGardenNames(directory, member.address)}
              selected={isSelected(member.address)}
              onSelect={() =>
                selectRecipient({
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

      {/* Garden drill-down: members of one browsed garden */}
      {!trimmed && browseGarden ? (
        <section className="space-y-2">
          <Button
            type="button"
            emphasis="tertiary"
            size="compact"
            onClick={() => setBrowseGardenId(null)}
            leadingIcon={<RiArrowLeftLine className="h-4 w-4" aria-hidden="true" />}
            // The negative margin keeps the label on the content edge at rest.
            className="-ml-3"
          >
            {formatMessage({ id: "app.send.recipient.backToGardens" })}
          </Button>
          <SheetHeading as="h4" className="truncate" title={browseGarden.gardenName}>
            {browseGarden.gardenName}
          </SheetHeading>
          {browseGarden.members.map((member) => (
            <MemberRow
              key={member.address}
              address={member.address}
              roles={member.roles}
              sharedGardens={sharedGardenNames(directory, member.address)}
              hideGarden
              selected={isSelected(member.address)}
              onSelect={() =>
                selectRecipient({
                  address: member.address,
                  source: "garden",
                  roles: member.roles,
                  gardenName: browseGarden.gardenName,
                })
              }
            />
          ))}
        </section>
      ) : null}

      {/* Default browse mode (no query, no drill-down) */}
      {!trimmed && !browseGarden ? (
        <>
          {eligibleRecents.length > 0 ? (
            <section className="space-y-2">
              <SheetHeading as="h4">
                {formatMessage({ id: "app.send.recipient.recentTitle" })}
              </SheetHeading>
              {eligibleRecents.map((recent) => (
                <MemberRow
                  key={recent.address}
                  address={recent.address}
                  selected={isSelected(recent.address)}
                  onSelect={() =>
                    selectRecipient({
                      address: recent.address,
                      source: "recent",
                      ensName: recent.ens,
                    })
                  }
                />
              ))}
            </section>
          ) : null}

          {directory.myGardens.map((group) => (
            <section key={group.gardenId} className="space-y-2">
              <SheetHeading as="h4" className="truncate" title={group.gardenName}>
                {group.gardenName}
              </SheetHeading>
              {group.members.map((member) => (
                <MemberRow
                  key={member.address}
                  address={member.address}
                  roles={member.roles}
                  hideGarden
                  selected={isSelected(member.address)}
                  onSelect={() =>
                    selectRecipient({
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

          {directory.otherGardens.length > 0 ? (
            <section className="space-y-2">
              <SheetHeading as="h4">
                {formatMessage({ id: "app.send.recipient.allGardens" })}
              </SheetHeading>
              {directory.otherGardens.map((group) => (
                <button
                  key={group.gardenId}
                  type="button"
                  data-pressable="row"
                  onClick={() => setBrowseGardenId(group.gardenId)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-stroke-soft-200 bg-bg-white-0 p-2.5 text-left transition duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)] hover:bg-bg-weak-50"
                >
                  <div className="min-w-0">
                    <p
                      className="truncate text-sm font-medium text-text-strong-950"
                      title={group.gardenName}
                    >
                      {group.gardenName}
                    </p>
                    <p className="truncate text-xs text-text-soft-400">
                      {formatMessage(
                        { id: "app.send.recipient.memberCount" },
                        { count: group.members.length }
                      )}
                    </p>
                  </div>
                  <RiArrowRightSLine className="h-5 w-5 shrink-0 text-text-soft-400" aria-hidden />
                </button>
              ))}
            </section>
          ) : null}

          {eligibleRecents.length === 0 &&
          directory.myGardens.length === 0 &&
          directory.otherGardens.length === 0 ? (
            <EmptyState
              icon={<RiUserLine />}
              title={formatMessage({ id: "app.send.recipient.empty" })}
              description={formatMessage({
                id: gDollarOnly
                  ? "app.send.recipient.gardenerOnly"
                  : "app.send.recipient.emptyDescription",
              })}
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
