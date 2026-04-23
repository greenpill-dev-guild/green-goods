import { actionsKeys, assessmentsKeys, gardensKeys, platformKeys } from "./garden";
import { greenWillKeys } from "./greenwill";
import { convictionKeys, hypercertsKeys, marketplaceKeys } from "./hypercert";
import { communityKeys, ensKeys, gardenerProfileKeys, gardenersKeys, roleKeys } from "./identity";
import { draftsKeys, mediaKeys, offlineKeys, queueKeys } from "./misc";
import { cookieJarKeys, vaultsKeys, yieldKeys } from "./vault";
import { approvalsKeys, operatorWorksKeys, workApprovalsKeys, worksKeys } from "./work";

export const queryKeys = {
  all: ["greengoods"] as const,
  queue: queueKeys,
  works: worksKeys,
  workApprovals: workApprovalsKeys,
  approvals: approvalsKeys,
  operatorWorks: operatorWorksKeys,
  offline: offlineKeys,
  media: mediaKeys,
  gardens: gardensKeys,
  vaults: vaultsKeys,
  cookieJar: cookieJarKeys,
  conviction: convictionKeys,
  community: communityKeys,
  yield: yieldKeys,
  platform: platformKeys,
  actions: actionsKeys,
  assessments: assessmentsKeys,
  gardeners: gardenersKeys,
  gardenerProfile: gardenerProfileKeys,
  ens: ensKeys,
  role: roleKeys,
  drafts: draftsKeys,
  hypercerts: hypercertsKeys,
  marketplace: marketplaceKeys,
  greenWill: greenWillKeys,
} as const;
