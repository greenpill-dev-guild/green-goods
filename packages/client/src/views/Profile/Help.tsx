import {
  RiArrowDropRightLine,
  RiExternalLinkLine,
  RiFileList3Line,
  RiFlagLine,
  RiLinkedinBoxLine,
  RiPlantLine,
  RiSeedlingLine,
  RiShieldUserLine,
  RiTwitterLine,
  RiUserUnfollowLine,
} from "@remixicon/react";
import { useIntl } from "react-intl";
import { FlexCard } from "@/components/Cards";
import { Avatar, Faq, FaqContent, FaqItem, FaqTrigger } from "@/components/Display";
import { CONTACT_ANCHORS } from "@/views/Public/contactAnchors";

/** A row that opens a guide, a social profile, a policy or a support request. */
interface HelpLink {
  /** Title and description come from `app.profile.help.<messageKey>.{title,description}`. */
  messageKey: string;
  url: string;
  icon: React.ReactNode;
}

interface FaqCategory {
  id: string;
  topics: string[];
}

type ProfileHelpProps = {};

const GARDENER_GUIDE_URL = "https://docs.greengoods.app/community/gardener-guide";

const LEARN_AND_CONNECT: readonly HelpLink[] = [
  { messageKey: "guides.gardener", url: GARDENER_GUIDE_URL, icon: <RiSeedlingLine /> },
  {
    messageKey: "guides.steward",
    url: "https://docs.greengoods.app/community/steward-guide",
    icon: <RiPlantLine />,
  },
  { messageKey: "socials.twitter", url: "https://x.com/greengoodsapp", icon: <RiTwitterLine /> },
  {
    messageKey: "socials.linkedin",
    url: "https://www.linkedin.com/company/greengoodsapp/",
    icon: <RiLinkedinBoxLine />,
  },
];

// The policies, and the two requests a person handles. Each opens its public website page.
const PRIVACY_AND_SAFETY: readonly HelpLink[] = [
  { messageKey: "support.privacy", url: "/privacy", icon: <RiShieldUserLine /> },
  { messageKey: "support.terms", url: "/terms", icon: <RiFileList3Line /> },
  {
    messageKey: "support.deletion",
    url: `/contact#${CONTACT_ANCHORS.deletion}`,
    icon: <RiUserUnfollowLine />,
  },
  {
    messageKey: "support.report",
    url: `/contact#${CONTACT_ANCHORS.report}`,
    icon: <RiFlagLine />,
  },
];

// FAQ topics grouped by the gardener journey. Each category renders its own
// Faq accordion (Radix type="single"), so one item per category can be open at
// once. Questions/answers are sourced from i18n via
// `app.profile.help.faq.<topic>.{question,answer}`.
const faqCategories: FaqCategory[] = [
  {
    id: "gettingStarted",
    topics: [
      "whatIsGreenGoods",
      "whatIsImpact",
      "signingIn",
      "gardensAndStewards",
      "howToGetInvolved",
    ],
  },
  {
    // What the Promises tab used to explain on the page now lives here (D10).
    id: "promises",
    topics: ["whatArePromises", "offerOrRequest", "takingUp", "confirming", "seasonsAndCampaigns"],
  },
  {
    id: "documentingWork",
    topics: [
      "whoCanSubmitWork",
      "howSubmissionWorks",
      "offlineSupport",
      "syncTroubleshooting",
      "reviewAndApproval",
      "trackingStatus",
      "workDeclined",
      "whatAreAssessments",
    ],
  },
  {
    id: "fundsWallet",
    topics: ["walletDrawer", "cookieJars", "sendingFunds"],
  },
  {
    id: "account",
    topics: [
      "smartAccountAddress",
      "profilePicture",
      "badges",
      "changeLanguage",
      "switchingAccounts",
      "accountRecovery",
    ],
  },
  {
    id: "privacyData",
    topics: ["dataStorage", "onChainData", "photoStorage", "whatIsEAS"],
  },
];

// Questions a gardener guide walks through step by step, mapped to that page or section. The docs
// are in English only, so the link says so in Spanish and Portuguese.
const FAQ_GUIDES: Readonly<Partial<Record<string, string>>> = {
  signingIn: `${GARDENER_GUIDE_URL}/installing-and-updating#create-your-account`,
  howToGetInvolved: `${GARDENER_GUIDE_URL}/joining-a-garden`,
  offerOrRequest: `${GARDENER_GUIDE_URL}/make-a-promise`,
  takingUp: `${GARDENER_GUIDE_URL}/keep-a-promise`,
  confirming: `${GARDENER_GUIDE_URL}/confirm-a-promise`,
  howSubmissionWorks: `${GARDENER_GUIDE_URL}/uploading-your-work`,
  offlineSupport: `${GARDENER_GUIDE_URL}/uploading-your-work#if-you-are-offline`,
  syncTroubleshooting: `${GARDENER_GUIDE_URL}/recovery-and-sync`,
  trackingStatus: `${GARDENER_GUIDE_URL}/track-status-and-attestations`,
  workDeclined: `${GARDENER_GUIDE_URL}/track-status-and-attestations#if-it-is-rejected`,
  accountRecovery: `${GARDENER_GUIDE_URL}/installing-and-updating#create-your-account`,
};

function HelpSectionHeading({ children }: { children: React.ReactNode }) {
  return <h5 className="text-label-md text-text-strong-950">{children}</h5>;
}

function HelpLinkCard({ link }: { link: HelpLink }) {
  const intl = useIntl();
  return (
    <a href={link.url} target="_blank" rel="noopener noreferrer">
      <FlexCard>
        <div className="flex flex-row items-center gap-3 grow">
          <Avatar>
            <div className="flex items-center justify-center text-center mx-auto text-grey-200">
              {link.icon}
            </div>
          </Avatar>

          <div className="flex-1">
            <div className="text-base">
              {intl.formatMessage({ id: `app.profile.help.${link.messageKey}.title` })}
            </div>
            <div className="text-xs text-text-sub-600">
              {intl.formatMessage({ id: `app.profile.help.${link.messageKey}.description` })}
            </div>
          </div>
          <div className="flex text-right">
            <RiArrowDropRightLine />
          </div>
        </div>
      </FlexCard>
    </a>
  );
}

function FaqGuideLink({ href }: { href: string }) {
  const intl = useIntl();
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      hrefLang="en"
      className="mt-1 inline-flex min-h-11 items-center gap-1.5 font-medium text-primary-on-surface underline underline-offset-4"
    >
      {intl.formatMessage({ id: "app.profile.help.faq.guide" })}
      <RiExternalLinkLine className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="sr-only">
        {" "}
        {intl.formatMessage({ id: "app.profile.help.faq.guideNewTab" })}
      </span>
    </a>
  );
}

export const ProfileHelp: React.FC<ProfileHelpProps> = () => {
  const intl = useIntl();

  return (
    <>
      <HelpSectionHeading>
        {intl.formatMessage({ id: "app.profile.help.getInTouch" })}
      </HelpSectionHeading>
      {LEARN_AND_CONNECT.map((link) => (
        <HelpLinkCard key={link.messageKey} link={link} />
      ))}
      <HelpSectionHeading>
        {intl.formatMessage({ id: "app.profile.help.privacySafety" })}
      </HelpSectionHeading>
      {PRIVACY_AND_SAFETY.map((link) => (
        <HelpLinkCard key={link.messageKey} link={link} />
      ))}
      {faqCategories.flatMap((category) => [
        <HelpSectionHeading key={`${category.id}-heading`}>
          {intl.formatMessage({ id: `app.profile.help.category.${category.id}` })}
        </HelpSectionHeading>,
        <Faq key={`${category.id}-faq`}>
          {category.topics.map((topic) => {
            const guide = FAQ_GUIDES[topic];
            return (
              <FaqItem key={topic} value={topic}>
                <FaqTrigger>
                  {intl.formatMessage({ id: `app.profile.help.faq.${topic}.question` })}
                </FaqTrigger>
                <FaqContent data-testid={`faq-content-${topic}`}>
                  <p>{intl.formatMessage({ id: `app.profile.help.faq.${topic}.answer` })}</p>
                  {guide ? <FaqGuideLink href={guide} /> : null}
                </FaqContent>
              </FaqItem>
            );
          })}
        </Faq>,
      ])}
    </>
  );
};
