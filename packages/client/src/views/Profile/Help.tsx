import {
  RiArrowDropRightLine,
  RiFileListLine,
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

interface FAQ {
  topic: string;
  question: string;
  answer: string;
}

type ProfileHelpProps = {};

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

  const faqTopics = [
    "whatIsGreenGoods",
    "gardensAndOperators",
    "howToGetInvolved",
    "whoCanSubmitWork",
    "howSubmissionWorks",
    "offlineSupport",
    "reviewAndApproval",
    "whatIsEAS",
    "badgesAndIdentity",
    "dataStorage",
    "howToContact",
  ];

  const faqs: FAQ[] = faqTopics.map((topic) => {
    return {
      topic,
      question: intl.formatMessage({
        id: `app.profile.help.faq.${topic}.question`,
      }),
      answer: intl.formatMessage({
        id: `app.profile.help.faq.${topic}.answer`,
      }),
    };
  });

  return (
    <>
      <h5 className="text-label-md text-text-strong-950">
        {intl.formatMessage({ id: "app.profile.help.getInTouch" })}
      </h5>
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
      <a href="https://forms.gle/EnxXDpzmBAt9AZdH7" target="_blank" rel="noopener noreferrer">
        <FlexCard>
          <div className="flex flex-row items-center gap-3 grow">
            <Avatar>
              <div className="flex items-center justify-center text-center mx-auto text-grey-200">
                <RiFileListLine />
              </div>
            </Avatar>

            <div className="flex-1">
              <div className="text-base">
                {intl.formatMessage({
                  id: "app.profile.help.onboardingForm.title",
                  defaultMessage: "Onboarding form",
                })}
              </div>
              <div className="text-xs text-text-sub-600">
                {intl.formatMessage({
                  id: "app.profile.help.onboardingForm.description",
                  defaultMessage: "Takes about 10 minutes",
                })}
              </div>
            </div>
            <div className="flex text-right">
              <RiArrowDropRightLine />
            </div>
          </div>
        </FlexCard>
      </a>
      <h5 className="text-label-md text-text-strong-950">
        {intl.formatMessage({ id: "app.profile.help.questions" })}
      </h5>
      <Faq>
        {faqs.map((faq) => {
          return (
            <FaqItem key={faq.topic} value={faq.topic}>
              <FaqTrigger>{faq.question}</FaqTrigger>
              <FaqContent data-testid={`faq-content-${faq.topic}`}>{faq.answer}</FaqContent>
            </FaqItem>
          );
        })}
      </Faq>
    </>
  );
};
