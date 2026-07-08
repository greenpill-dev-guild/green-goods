import {
  RiArrowDropRightLine,
  RiBookOpenLine,
  RiTelegramLine,
  RiTwitterLine,
} from "@remixicon/react";
import { useIntl } from "react-intl";
import { FlexCard } from "@/components/Cards";
import { Avatar, Faq, FaqContent, FaqItem, FaqTrigger } from "@/components/Display";

interface Social {
  title: string;
  description: string;
  url: string;
  Icon: React.ReactNode;
}

interface FaqCategory {
  id: string;
  topics: string[];
}

type ProfileHelpProps = {};

const DOCS_GARDENER_GUIDE_URL = "https://docs.greengoods.app/community/gardener-guide";

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
      "gardensAndOperators",
      "howToGetInvolved",
    ],
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
    topics: ["walletDrawer", "cookieJars", "sendingFunds", "pools"],
  },
  {
    id: "account",
    topics: [
      "smartAccountAddress",
      "profileName",
      "badgesAndIdentity",
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

export const ProfileHelp: React.FC<ProfileHelpProps> = () => {
  const intl = useIntl();

  const socials: Social[] = [
    {
      title: intl.formatMessage({
        id: "app.profile.help.socials.telegram.title",
        description: "Telegram",
      }),
      description: intl.formatMessage({
        id: "app.profile.help.socials.telegram.description",
        description: "Telegram Description",
      }),
      url: "https://t.me/+N3o3_43iRec1Y2Jh",
      Icon: <RiTelegramLine />,
    },
    {
      title: intl.formatMessage({
        id: "app.profile.help.socials.twitter.title",
        description: "Twitter",
      }),
      description: intl.formatMessage({
        id: "app.profile.help.socials.twitter.description",
        description: "Twitter Description",
      }),
      url: "https://x.com/greengoodsapp",
      Icon: <RiTwitterLine />,
    },
  ];

  return (
    <>
      <h5 className="text-label-md text-text-strong-950">
        {intl.formatMessage({ id: "app.profile.help.getInTouch" })}
      </h5>
      <a href={DOCS_GARDENER_GUIDE_URL} target="_blank" rel="noopener noreferrer">
        <FlexCard>
          <div className="flex flex-row items-center gap-3 grow">
            <Avatar>
              <div className="flex items-center justify-center text-center mx-auto text-grey-200">
                <RiBookOpenLine />
              </div>
            </Avatar>

            <div className="flex-1">
              <div className="text-base">
                {intl.formatMessage({ id: "app.profile.help.docs.title" })}
              </div>
              <div className="text-xs text-text-sub-600">
                {intl.formatMessage({ id: "app.profile.help.docs.description" })}
              </div>
            </div>
            <div className="flex text-right">
              <RiArrowDropRightLine />
            </div>
          </div>
        </FlexCard>
      </a>
      {socials.map((social) => (
        <a key={social.title} href={social.url} target="_blank" rel="noopener noreferrer">
          <FlexCard>
            <div className="flex flex-row items-center gap-3 grow">
              <Avatar>
                <div className="flex items-center justify-center text-center mx-auto text-grey-200">
                  {social.Icon}
                </div>
              </Avatar>

              <div className="flex-1">
                <div className="text-base">{social.title}</div>
                <div className="text-xs text-text-sub-600">{social.description}</div>
              </div>
              <div className="flex text-right">
                <RiArrowDropRightLine />
              </div>
            </div>
          </FlexCard>
        </a>
      ))}
      {faqCategories.flatMap((category) => [
        <h5 key={`${category.id}-heading`} className="text-label-md text-text-strong-950">
          {intl.formatMessage({ id: `app.profile.help.category.${category.id}` })}
        </h5>,
        <Faq key={`${category.id}-faq`}>
          {category.topics.map((topic) => (
            <FaqItem key={topic} value={topic}>
              <FaqTrigger>
                {intl.formatMessage({ id: `app.profile.help.faq.${topic}.question` })}
              </FaqTrigger>
              <FaqContent data-testid={`faq-content-${topic}`}>
                {intl.formatMessage({ id: `app.profile.help.faq.${topic}.answer` })}
              </FaqContent>
            </FaqItem>
          ))}
        </Faq>,
      ])}
    </>
  );
};
