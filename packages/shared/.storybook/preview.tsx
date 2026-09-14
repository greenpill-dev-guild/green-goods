import "./storybook.css";
import type { Preview } from "@storybook/react";
import { sb } from "storybook/test";
import { withAdminStoryIsolation, withI18n, withQueryClient, withTheme } from "./decorators";

// Client sheet stories render the real sheet and replace only its data hooks, per story, with
// `mocked(hook).mockReturnValue(...)` in `beforeEach`. `spy: true` keeps each real implementation
// for every story that does not override it. Storybook only clears a module mock's call history
// between stories, so a story that overrides hooks returns `resetHookMocks(...)` (./moduleMocks)
// from `beforeEach`.
sb.mock(import("../src/hooks/app/useOffline.ts"), { spy: true });
sb.mock(import("../src/hooks/app/useOnlineStatus.ts"), { spy: true });
sb.mock(import("../src/hooks/auth/usePrimaryAddress.ts"), { spy: true });
sb.mock(import("../src/hooks/auth/useUser.ts"), { spy: true });
sb.mock(import("../src/hooks/auth/useWalletModalOpen.ts"), { spy: true });
sb.mock(import("../src/hooks/blockchain/useBaseLists.ts"), { spy: true });
sb.mock(import("../src/hooks/blockchain/useChainConfig.ts"), { spy: true });
sb.mock(import("../src/hooks/blockchain/useEnsName.ts"), { spy: true });
sb.mock(import("../src/hooks/blockchain/useSendToken.ts"), { spy: true });
sb.mock(import("../src/hooks/blockchain/useSendableTokens.ts"), { spy: true });
sb.mock(import("../src/hooks/client-ui/wallet/useSendFlowController.ts"), { spy: true });
sb.mock(import("../src/hooks/commitment-pooling/useCommitmentCycleNames.ts"), { spy: true });
sb.mock(import("../src/hooks/commitment-pooling/useCommitmentJobs.ts"), { spy: true });
sb.mock(import("../src/hooks/commitment-pooling/useCommitmentPooling.ts"), { spy: true });
sb.mock(import("../src/hooks/conviction/useAllocateHypercertSupport.ts"), { spy: true });
sb.mock(import("../src/hooks/conviction/useConvictionStrategies.ts"), { spy: true });
sb.mock(import("../src/hooks/conviction/useGardenCommunity.ts"), { spy: true });
sb.mock(import("../src/hooks/conviction/useHypercertConviction.ts"), { spy: true });
sb.mock(import("../src/hooks/conviction/useMemberVotingPower.ts"), { spy: true });
sb.mock(import("../src/hooks/cookie-jar/useAccessibleCookieJars.ts"), { spy: true });
sb.mock(import("../src/hooks/cookie-jar/useCookieJarWithdraw.ts"), { spy: true });
sb.mock(import("../src/hooks/cookie-jar/useGardenCookieJars.ts"), { spy: true });
sb.mock(import("../src/hooks/ens/useENSClaim.ts"), { spy: true });
sb.mock(import("../src/hooks/ens/useENSRegistrationStatus.ts"), { spy: true });
sb.mock(import("../src/hooks/ens/useENSReleaseName.ts"), { spy: true });
sb.mock(import("../src/hooks/ens/useGreenGoodsEnsName.ts"), { spy: true });
sb.mock(import("../src/hooks/ens/useProtocolMemberStatus.ts"), { spy: true });
sb.mock(import("../src/hooks/ens/useSlugAvailability.ts"), { spy: true });
sb.mock(import("../src/hooks/garden/useGardenJoinRequests.ts"), { spy: true });
sb.mock(import("../src/hooks/greenwill/useClaimGreenWillBadge.ts"), { spy: true });
sb.mock(import("../src/hooks/greenwill/useGreenWillBadges.ts"), { spy: true });
sb.mock(import("../src/hooks/profile/useProfileAvatar.ts"), { spy: true });
sb.mock(import("../src/hooks/roles/useHasRole.ts"), { spy: true });
sb.mock(import("../src/hooks/vault/useGardenVaults.ts"), { spy: true });
sb.mock(import("../src/hooks/vault/useMyVaultDeposits.ts"), { spy: true });
sb.mock(import("../src/hooks/vault/useOctantVaultPositions.ts"), { spy: true });
sb.mock(import("../src/hooks/vault/useOctantVaultWithdraw.ts"), { spy: true });
sb.mock(import("../src/hooks/vault/useVaultDeposit.ts"), { spy: true });
sb.mock(import("../src/hooks/vault/useVaultDeposits.ts"), { spy: true });
sb.mock(import("../src/hooks/vault/useVaultPreview.ts"), { spy: true });
sb.mock(import("../src/hooks/vault/useVaultWithdraw.ts"), { spy: true });
sb.mock(import("../src/hooks/work/useDrafts.ts"), { spy: true });
sb.mock(import("../src/hooks/work/useMyWorks.ts"), { spy: true });
sb.mock(import("../src/hooks/yield/useYieldAllocations.ts"), { spy: true });
// The public vault panel mounts the wallet runtime itself; its stories render the panel without it.
sb.mock(import("../../client/src/routes/WalletRuntimeProviders.tsx"), { spy: true });

const preview: Preview = {
  globalTypes: {
    theme: {
      description: "Global theme for components",
      toolbar: {
        title: "Theme",
        icon: "paintbrush",
        items: [
          { value: "light", title: "Light", icon: "sun" },
          { value: "dark", title: "Dark", icon: "moon" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: "light",
  },
  parameters: {
    controls: { expanded: true },
    backgrounds: { disable: true }, // Handled by theme decorator
    // Viewport toolbar (built into Storybook 10 core — no addon dependency). Lets
    // any story be rendered at mobile/tablet widths so media queries respond,
    // which is how we verify the admin flows' bottom-sheet + two-column breakpoints.
    viewport: {
      options: {
        mobile: { name: "Mobile (375)", styles: { width: "375px", height: "812px" }, type: "mobile" },
        tablet: { name: "Tablet (768)", styles: { width: "768px", height: "1024px" }, type: "tablet" },
        desktop: { name: "Desktop (1280)", styles: { width: "1280px", height: "800px" }, type: "desktop" },
      },
    },
  },
  decorators: [withAdminStoryIsolation, withQueryClient, withI18n, withTheme],
};

export default preview;
