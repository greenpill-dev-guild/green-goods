import {
  RiArrowDropRightLine,
  RiFileListLine,
  RiTelegramLine,
  RiTwitterLine,
} from "@remixicon/react";
import { useIntl } from "react-intl";
import { Faq, FaqContent, FaqItem, FaqTrigger } from "@/components/UI/Accordion/Faq";
import { Avatar } from "@/components/UI/Avatar/Avatar";
import { FlexCard } from "@/components/UI/Card/Card";

interface Social {
  title: string;
  description: string;
  url: string;
  Icon: React.ReactNode;
}

interface FAQ {
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
    "howSubmissionWorks",
    "gardensAndOperators",
    "whoCanSubmitWork",
    "whatIsEAS",
    "offlineSupport",
    "smartAccountAddress",
    "dataStorage",
    "duplicateHandling",
    "howToGetInvolved",
    "howToContact",
  ];

  const faqs: FAQ[] = faqTopics.map((topic) => {
    return {
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
      <h5 className="">{intl.formatMessage({ id: "app.profile.help.getInTouch" })}</h5>
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
                <div className="text-xs text-slate-600">{social.description}</div>
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
              <div className="text-base">Onboarding Form</div>
              <div className="text-xs text-slate-600">Takes ~10 minutes to complete</div>
            </div>
            <div className="flex text-right">
              <RiArrowDropRightLine />
            </div>
          </div>
        </FlexCard>
      </a>
      <h5>{intl.formatMessage({ id: "app.profile.help.questions" })}</h5>
      <Faq>
        {faqs.map((faq) => {
          return (
            <FaqItem key={faq.question} value={faq.question}>
              <FaqTrigger>{faq.question}</FaqTrigger>
              <FaqContent>{faq.answer}</FaqContent>
            </FaqItem>
          );
        })}
      </Faq>
    </>
  );
};
