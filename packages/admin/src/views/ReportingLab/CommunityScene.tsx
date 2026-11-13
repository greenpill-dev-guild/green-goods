/**
 * Garden reporting lab, walkthrough (proposed): Community's Members and Endowment tabs. The
 * frames, splits and the cards around the new parts follow `CommunityMembersTab` and
 * `CommunityEndowmentTab` (Member Directory and its Members rail; Endowment Status), filled
 * from the lab's sample garden because the shipped cards read members and vaults from
 * chain. New here: Participation above the Member Directory, and the funding history as
 * the Endowment tab's main column.
 */
import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import { ItemRow } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import { StatTile } from "@green-goods/shared/components/Cards/StatTile";
import type { Address } from "@green-goods/shared/types/domain";
import type { AssetAmount } from "@green-goods/shared/utils/blockchain/vaults";
import { RiUser3Line } from "@remixicon/react";
import { useIntl } from "react-intl";
import { AdminCard, AdminCardBody, AdminCardHeader, AdminCardTitle } from "@/components/AdminCard";
import { AdminFilterChip } from "@/components/AdminFilterChip";
import { formatAmount, fundingSummary } from "./funding";
import { FundingHistory } from "./FundingHistory";
import { LabCanvas } from "./LabCanvas";
import { labGardens } from "./labShell";
import type { MediaSet, ReportAccount, ReportDataset, ViewerRole } from "./model";
import { ParticipationView } from "./ParticipationView";
import { CommunityFrame, GardenTabLayout } from "./SceneFrames";
import { defaultScope } from "./scope";

const STEWARD: ViewerRole = "steward";
const ASSET_ADDRESS: Record<string, Address> = {
  DAI: "0x00000000000000000000000000000000000000da",
  WETH: "0x00000000000000000000000000000000000000e7",
  USDC: "0x00000000000000000000000000000000000000c0",
};

function roleOf(account: ReportAccount) {
  if (account.id.startsWith("steward.")) return "Steward";
  if (account.id.startsWith("evaluator.")) return "Evaluator";
  return "Gardener";
}

interface CommunitySceneProps {
  dataset: ReportDataset;
  media: MediaSet;
  view: "members" | "endowment";
}

export function CommunityScene({ dataset, media, view }: CommunitySceneProps) {
  const { formatMessage, locale } = useIntl();
  const { garden } = dataset;
  const scope = defaultScope(dataset, view === "members" ? "people" : "funding");
  const summary = fundingSummary(garden, dataset.reference, scope.month);
  const held = summary.assets
    .map((asset) => ({
      asset: asset.asset,
      balance: asset.accounts
        .filter((account) => account.account === "endowment")
        .reduce((sum, account) => sum + account.balance, 0),
    }))
    .filter((entry) => entry.balance > 0);
  const endowment: AssetAmount[] = held.map((entry) => ({
    asset: ASSET_ADDRESS[entry.asset],
    symbol: entry.asset,
    decimals: 18,
    amount: BigInt(Math.round(entry.balance * 1e6)) * 10n ** 12n,
  }));
  const people = [...garden.team, ...garden.accounts];
  const roles = ["Steward", "Evaluator", "Gardener"] as const;
  const endowmentEntries = garden.ledger.filter((entry) => entry.account === "endowment");

  return (
    <LabCanvas workspace="community" gardens={labGardens(media, garden)} gardenId={garden.id}>
      <CommunityFrame view={view} endowment={endowment}>
        {view === "members" ? (
          <GardenTabLayout
            main={
              <>
                <ParticipationView
                  dataset={dataset}
                  scope={scope}
                  records={dataset.records}
                  role={STEWARD}
                />
                <AdminCard className="@container space-y-4">
                  <AdminCardHeader className="flex-wrap gap-3">
                    <div>
                      <AdminCardTitle>
                        {formatMessage({ id: "cockpit.community.members.directory" })}
                      </AdminCardTitle>
                      <p className="mt-1 type-body text-text-sub">{`${people.length} members`}</p>
                    </div>
                  </AdminCardHeader>
                  <AdminCardBody className="space-y-3">
                    <div className="flex flex-wrap gap-1.5">
                      <AdminFilterChip
                        label={formatMessage({ id: "cockpit.community.members.filterAll" })}
                        selected
                        onToggle={() => undefined}
                      />
                      {roles.map((role) => (
                        <AdminFilterChip
                          key={role}
                          label={`${role}s`}
                          selected={false}
                          onToggle={() => undefined}
                        />
                      ))}
                    </div>
                    <ul className="flex flex-col gap-(--gg-list-gap)">
                      {people.map((person) => (
                        <li key={person.id}>
                          <ItemRow
                            lead={{ kind: "icon", icon: <RiUser3Line /> }}
                            title={person.name}
                            status={{ label: roleOf(person), tone: "neutral" }}
                            details={[person.kind === "shared-device" ? "Shared device" : "1 role"]}
                          />
                        </li>
                      ))}
                    </ul>
                  </AdminCardBody>
                </AdminCard>
              </>
            }
            rail={
              <AdminCard density="none">
                <AdminCardHeader>
                  <AdminCardTitle>Members</AdminCardTitle>
                </AdminCardHeader>
                <AdminCardBody>
                  <FactList frame="inset">
                    {roles.map((role) => (
                      <FactRow
                        key={role}
                        label={`${role}s`}
                        value={people.filter((person) => roleOf(person) === role).length}
                      />
                    ))}
                  </FactList>
                </AdminCardBody>
              </AdminCard>
            }
          />
        ) : (
          <GardenTabLayout
            main={<FundingHistory dataset={dataset} scope={scope} />}
            rail={
              <AdminCard density="none">
                <AdminCardHeader>
                  <AdminCardTitle>
                    {formatMessage({ id: "cockpit.community.endowment.status" })}
                  </AdminCardTitle>
                </AdminCardHeader>
                <AdminCardBody className="space-y-3">
                  <StatTile
                    label={formatMessage({ id: "app.treasury.totalValueLocked" })}
                    value={held
                      .map((entry) => formatAmount(entry.balance, entry.asset, locale))
                      .join(" · ")}
                  />
                  <FactList frame="inset">
                    <FactRow
                      label={formatMessage({ id: "app.treasury.totalHarvests" })}
                      value={endowmentEntries.filter((entry) => entry.kind === "yield").length}
                    />
                    <FactRow
                      label={formatMessage({ id: "app.treasury.depositorCount" })}
                      value={
                        new Set(
                          endowmentEntries
                            .filter((entry) => entry.kind === "deposit")
                            .map((entry) => entry.counterparty)
                        ).size
                      }
                    />
                  </FactList>
                </AdminCardBody>
              </AdminCard>
            }
          />
        )}
      </CommunityFrame>
    </LabCanvas>
  );
}
