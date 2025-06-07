import { Faq, FaqContent, FaqItem, FaqTrigger } from "@/components/UI/Accordion/Faq";
import { Avatar } from "@/components/UI/Avatar/Avatar";
import { FlexCard } from "@/components/UI/Card/Card";
import { RiArrowDropRightLine, RiTelegramLine, RiWhatsappLine } from "@remixicon/react";
import { useIntl } from "react-intl";

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

interface ProfileHelpProps {}

export const ProfileHelp: React.FC<ProfileHelpProps> = () => {
  const intl = useIntl();

  const socials: Social[] = [
    {
      title: "WhatsApp",
      description: intl.formatMessage({
        id: "app.profile.help.socials.whatsapp.description",
        description: "WhatsApp Description",
      }),
      url: "https://discord.gg/greengoods",
      Icon: <RiWhatsappLine />,
    },
    {
      title: "Telegram",
      description: intl.formatMessage({
        id: "app.profile.help.socials.telegram.description",
        description: "Telegram Description",
      }),
      url: "https://t.me/gp_dev_guild",
      Icon: <RiTelegramLine />,
    },
  ];

  const faqTopics = [
    "whatIsGreenGoods",
    "whatIsBiodiversity",
    "howToBringBiodiversityOnchain",
    "whatIsEAS",
    "whoCanSubmitWork",
    "howToGetInvolved",
    "howToLearnMore",
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
      <h5 className="">Get In Touch</h5>
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
      <h5>Questions</h5>
      <Faq type="single">
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
