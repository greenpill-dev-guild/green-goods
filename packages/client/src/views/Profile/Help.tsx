import { Avatar } from "@/components/UI/Avatar/Avatar";
import { Card } from "@/components/UI/Card/Card";
import {
  RiArrowDropRightLine,
  RiTelegramLine,
  RiWhatsappLine,
} from "@remixicon/react";

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

const faqs: FAQ[] = [
  {
    question: "What is Green Goods?",
    answer:
      "Green Goods is a platform that allows you to bring biodiversity onchain.",
  },
  {
    question: "What is biodiversity?",
    answer:
      "Biodiversity is the variety of life on Earth. It includes all living organisms, from plants and animals to fungi and bacteria.",
  },
  {
    question: "How can I bring biodiversity onchain?",
    answer:
      "You can bring biodiversity onchain by creating a garden assessment and submitting it to the Green Goods EAS.",
  },
  {
    question: "What is EAS?",
    answer:
      "EAS stands for Ethereum Attestation Service. It is a service that allows you to submit and verify data on the Ethereum blockchain.",
  },
  {
    question: "Who can submit garden work?",
    answer:
      "Anyone can submit garden work to the Green Goods EAS. You do not need to be a professional gardener to participate.",
  },
  {
    question: "How can I get involved with Green Goods?",
    answer:
      "You can get involved with Green Goods by creating a garden assessment, joining the community, and sharing your knowledge and expertise.",
  },
  {
    question: "How can I learn more about Green Goods?",
    answer:
      "You can learn more about Green Goods by visiting our website, joining our Discord server, and following us on social media.",
  },
  {
    question: "How can I contact Green Goods?",
    answer:
      "You can contact Green Goods by sending an email at greengoods@greenpill.builders.",
  },
];

const socials: Social[] = [
  {
    title: "WhatsApp",
    description: "Join our community on WhatsApp",
    url: "https://discord.gg/greengoods",
    Icon: <RiWhatsappLine />,
  },
  {
    title: "Telegram",
    description: "Join our community on Telegram",
    url: "https://t.me/gp_dev_guild",
    Icon: <RiTelegramLine />,
  },
];

export const ProfileHelp: React.FC<ProfileHelpProps> = () => {
  return (
    <>
      <div className=" flex flex-col gap-4 my-4">
        <h5 className="">Get In Touch</h5>
        {socials.map((social) => (
          <Card
            key={social.title}
          >
            <div className="flex flex-row items-center gap-3">
              <Avatar>
                <div className="flex items-center justify-center text-center mx-auto text-slate-500">
                  <a
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {social.Icon}
                  </a>
                </div>
              </Avatar>

              <div className="flex-1">
                <div className="text-base">{social.title}</div>
                <div className="text-xs text-slate-600">
                  {social.description}
                </div>
              </div>
              <RiArrowDropRightLine />
            </div>
          </Card>
        ))}
        <h5>Questions</h5>
        {faqs.map((faq) => (
          <div key={faq.question} className="">
            <div className="font-semibold text-sm collapse-title">
              {faq.question}
            </div>
            <p className="collapse-content text-xs">{faq.answer}</p>
          </div>
        ))}
      </div>
    </>
  );
};
