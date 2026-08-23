import { actionsKeys, assessmentsKeys, gardensKeys, platformKeys } from "./garden";
import { commitmentPoolingKeys } from "./commitment-pooling";
import { creditKeys } from "./credit";
import { greenWillKeys } from "./greenwill";
import { convictionKeys, hypercertsKeys, marketplaceKeys } from "./hypercert";
import {
  communityKeys,
  ensKeys,
  gardenerProfileKeys,
  gardenersKeys,
  profileAvatarKeys,
  roleKeys,
} from "./identity";
import { draftsKeys, mediaKeys, offlineKeys, queueKeys } from "./misc";
import { publicKeys } from "./public";
import { savedOffersKeys } from "./saved-offers";
import { tokensKeys } from "./tokens";
import { cookieJarKeys, vaultsKeys, yieldKeys } from "./vault";
import { approvalsKeys, stewardWorksKeys, workApprovalsKeys, worksKeys } from "./work";

export const queryKeys = {
  all: ["greengoods"] as const,
  queue: queueKeys,
  works: worksKeys,
  workApprovals: workApprovalsKeys,
  approvals: approvalsKeys,
  stewardWorks: stewardWorksKeys,
  offline: offlineKeys,
  media: mediaKeys,
  gardens: gardensKeys,
  vaults: vaultsKeys,
  cookieJar: cookieJarKeys,
  conviction: convictionKeys,
  community: communityKeys,
  yield: yieldKeys,
  platform: platformKeys,
  public: publicKeys,
  actions: actionsKeys,
  assessments: assessmentsKeys,
  gardeners: gardenersKeys,
  gardenerProfile: gardenerProfileKeys,
  profileAvatars: profileAvatarKeys,
  ens: ensKeys,
  role: roleKeys,
  drafts: draftsKeys,
  hypercerts: hypercertsKeys,
  marketplace: marketplaceKeys,
  greenWill: greenWillKeys,
  tokens: tokensKeys,
  commitmentPooling: commitmentPoolingKeys,
  credit: creditKeys,
  savedOffers: savedOffersKeys,
} as const;
