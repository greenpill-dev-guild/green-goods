import { useQueryClient } from "@tanstack/react-query";
import { type ReactElement, useLayoutEffect } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { fn, mocked } from "storybook/test";
import { usePrimaryAddress } from "../src/hooks/auth/usePrimaryAddress";
import { useActions, useGardens } from "../src/hooks/blockchain/useBaseLists";
import { useEnsName } from "../src/hooks/blockchain/useEnsName";
import type { GardenCommitmentController } from "../src/hooks/client-ui/commitment/controller.types";
import { useGardenCommitmentController } from "../src/hooks/client-ui/commitment/useGardenCommitmentController";
import {
  useCommitmentActivity,
  useCommitmentCycle,
} from "../src/hooks/commitment-pooling/useCommitmentPooling";
import {
  useServiceAccess,
  useServiceAccessMutation,
} from "../src/hooks/commitment-pooling/useServiceAccess";
import { useGreenGoodsEnsName } from "../src/hooks/ens/useGreenGoodsEnsName";
import enMessages from "../src/i18n/en.json";
import esMessages from "../src/i18n/es.json";
import ptMessages from "../src/i18n/pt.json";
import type { ServiceAccessSnapshot } from "../src/modules/commitment-pooling/service-access-types";
import type { VoucherWalletSnapshot } from "../src/modules/commitment-pooling/service-access-wallet-types";
import { VOUCHER_STORY_NAMES, VOUCHER_STORY_WALLET_KEY } from "./voucherBookingFixtures";
import { VOUCHER_STORY_SCOPE } from "./voucherPilotFixtures";

export type VoucherStoryLang = "en" | "es" | "pt";
const MESSAGES = { en: enMessages, es: esMessages, pt: ptMessages } as const;

/** The hooks the page reads here; a story's `beforeEach` gives them back to later stories. */
export const VOUCHER_STORY_PAGE_HOOKS = [
  useServiceAccess,
  useServiceAccessMutation,
  useGardenCommitmentController,
  usePrimaryAddress,
  useCommitmentActivity,
  useCommitmentCycle,
  useGardens,
  useActions,
  useGreenGoodsEnsName,
  useEnsName,
] as const;

/**
 * Storybook only: the promise page for one voucher service read, with every hook it reads
 * answered from fixtures and the reader's acts answered in place, so a story draws one stage
 * of a booking or a request's rewards. Nothing reads a chain or signs. `page` is the route's
 * element (the client's GardenCommitment); `names` adds to the story accounts' names.
 */
export function VoucherStoryPage({
  snapshot,
  controller,
  wallet,
  names = {},
  lang,
  page,
}: {
  snapshot: ServiceAccessSnapshot;
  controller: GardenCommitmentController;
  wallet: VoucherWalletSnapshot;
  names?: Readonly<Record<string, string>>;
  lang: VoucherStoryLang;
  page: ReactElement;
}) {
  const client = useQueryClient();
  useLayoutEffect(() => {
    client.setQueryData(VOUCHER_STORY_WALLET_KEY, wallet);
  }, [client, wallet]);
  mocked(useServiceAccess).mockReturnValue({
    data: snapshot,
    isLoading: false,
    isError: false,
    status: "success",
    fetchStatus: "idle",
    error: null,
    refetch: fn(),
  } as unknown as ReturnType<typeof useServiceAccess>);
  mocked(useServiceAccessMutation).mockReturnValue({
    isPending: false,
    mutateAsync: async () => ({ kind: "local-rehearsal", observationId: "story", snapshot }),
  } as unknown as ReturnType<typeof useServiceAccessMutation>);
  mocked(useGardenCommitmentController).mockReturnValue(controller);
  mocked(usePrimaryAddress).mockReturnValue(VOUCHER_STORY_SCOPE.account);
  mocked(useCommitmentActivity).mockReturnValue({
    events: [],
    isError: false,
  } as unknown as ReturnType<typeof useCommitmentActivity>);
  mocked(useCommitmentCycle).mockReturnValue({
    cycle: null,
  } as unknown as ReturnType<typeof useCommitmentCycle>);
  mocked(useGardens).mockReturnValue({ data: [] } as unknown as ReturnType<typeof useGardens>);
  mocked(useActions).mockReturnValue({ data: [] } as unknown as ReturnType<typeof useActions>);
  const known: Readonly<Record<string, string>> = { ...VOUCHER_STORY_NAMES, ...names };
  mocked(useGreenGoodsEnsName).mockImplementation(
    (address) =>
      ({
        data: address ? (known[address.toLowerCase()] ?? null) : null,
      }) as ReturnType<typeof useGreenGoodsEnsName>
  );
  mocked(useEnsName).mockReturnValue({ data: null } as ReturnType<typeof useEnsName>);
  const garden = controller.routeGarden ?? snapshot.offer?.providerGarden;
  return (
    <IntlProvider key={lang} locale={lang} messages={MESSAGES[lang]}>
      <MemoryRouter
        key={`${snapshot.key.commitmentId}:${snapshot.coreState}`}
        initialEntries={[`/home/${garden}/commitments/${snapshot.key.commitmentId.toString()}`]}
      >
        <Routes>
          <Route path="/home/:id/commitments/:commitmentId" element={page} />
        </Routes>
      </MemoryRouter>
    </IntlProvider>
  );
}
