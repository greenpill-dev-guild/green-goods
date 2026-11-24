import { useIntl } from "react-intl";
import {
  EditorialHeading,
  EditorialKicker,
  EditorialLede,
  EditorialLinkArrow,
} from "@/components/Public/atoms";
import { PublicEditorialHero } from "@/components/Public/PublicEditorialHero";
import { PublicFooter } from "@/components/Public/PublicFooter";
import { publicCuration } from "@/content/publicCuration";

const PRIORITIES = [
  {
    key: "delivery",
    title: "Usability and Tech and Sun",
    body: "Reduce friction in documenting and reviewing work. Support Tech and Sun delivery, with field feedback and evidence of completed work guiding the next improvements.",
    status: "Current priority; delivery and learning continue.",
    owner: "Afo, with engineering and pilot stewards.",
    dependency: "Usability checks, steward review, and evidence from the field.",
  },
  {
    key: "integrations",
    title: "Selective integrations",
    body: "Explore integrations only where they help communities do and document the work. Ma Earth and other integrations remain conditional. A hackathon integration alone does not demonstrate pilot delivery or adoption.",
    status: "Planned and conditional; no launch commitment.",
    owner: "Afo coordinates scope with each prospective partner.",
    dependency:
      "A clear community need, partner agreement, and capacity after delivery priorities.",
  },
  {
    key: "business",
    title: "Business and marketing",
    body: "Make the project easier to understand and support through reviewed materials and focused partner conversations. Keep public claims tied to evidence.",
    status: "Reviewed decks available; follow-through is ongoing.",
    owner: "Afo coordinates business and marketing.",
    dependency: "Reviewed evidence and permission for any public story or testimonial.",
  },
  {
    key: "mentorship",
    title: "Mentorship and growth",
    body: "Build the relationships and practical guidance that help people participate. Let readiness and support capacity set the pace of growth.",
    status: "Planned alongside the delivery work.",
    owner: "Afo coordinates mentorship and community follow-through.",
    dependency: "Available mentors, community readiness, and time to support participants.",
  },
] as const;

const MONTHS = [
  {
    key: "october",
    title: "October 2026",
    status: "Review period",
    body: "Review usability, reporting, and pilot preparation. Afo coordinates the review with engineering and pilot stewards; unresolved issues carry into November rather than being counted as completed delivery.",
  },
  {
    key: "november",
    title: "November 2026",
    status: "Current focus",
    body: "Prioritize usability and Tech and Sun delivery. Afo coordinates field feedback, steward review, and focused support; integration and outreach work must fit the capacity left after those needs.",
  },
  {
    key: "december",
    title: "December 2026",
    status: "Planned",
    body: "Use the delivery review to choose the next improvements, partner work, and mentorship steps. Afo coordinates this decision; expansion depends on evidence and the capacity to support it.",
  },
] as const;

const LABELS = {
  status: "Status:",
  owner: "Owner:",
  dependency: "Depends on:",
} as const;

const DECKS = [
  ["funders", "1OU4Flit-Nq8oHVuPMf5tfu5_AM2R2cD_", "For Funders (PDF)"],
  ["partners", "1IUHAB8pjaJLAPcNUMV4oUvnUhzX-zyo9", "For Partners (PDF)"],
  ["diaspora", "1YzGMk5sDmh_PN8_jstYPmbpWUHm4_LUa", "For Diaspora Supporters (PDF)"],
  ["web3", "1EFV79GLzQ7-88E1Ngv0RZwPy-hvHD_2l", "For Web3 Builders (PDF)"],
  ["brief", "1WeOr5i7OL1gZqJN3SyNEl0e7ByMhf1Sw", "Project Brief (PDF)"],
] as const;

export default function Strategy() {
  const { formatMessage, formatDate } = useIntl();
  const reviewedDate = formatDate("2026-11-04T12:00:00Z", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  return (
    <>
      <PublicEditorialHero
        variant="banner"
        imageSrc={publicCuration.heroImagePath}
        imageFallbackSrc={publicCuration.fallbackImagePaths[0]}
        imageAlt=""
        kicker={formatMessage({ id: "public.strategy.kicker", defaultMessage: "Q4 2026 Strategy" })}
        titleId="public-strategy-title"
        title={formatMessage({ id: "public.strategy.title", defaultMessage: "Growing with care" })}
        lede={formatMessage({
          id: "public.strategy.lede",
          defaultMessage:
            "Our direction for October through December 2026: make Green Goods easier to use, support real delivery, and grow from what communities teach us.",
        })}
      />
      <div className="bg-bg-weak-50 px-6 pt-32 pb-20 sm:px-10 sm:pt-36 md:pt-40 md:pb-28">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm leading-relaxed text-text-sub-600">
            {formatMessage(
              { id: "public.strategy.reviewed", defaultMessage: "Source and review date: {date}" },
              { date: <time dateTime="2026-11-04">{reviewedDate}</time> }
            )}
          </p>
          <p className="mt-3 max-w-3xl text-base leading-relaxed text-text-sub-600">
            {formatMessage({
              id: "public.strategy.source",
              defaultMessage:
                "Public summary of the approved Q4 2026 strategy, draft 4. Afo coordinates this direction. Priorities describe the work ahead; they are not release or adoption claims.",
            })}
          </p>

          <section className="mt-12" aria-labelledby="strategy-priorities">
            <EditorialKicker className="mb-3">
              {formatMessage({
                id: "public.strategy.priorities.kicker",
                defaultMessage: "§ 01: Priorities",
              })}
            </EditorialKicker>
            <EditorialHeading id="strategy-priorities">
              {formatMessage({
                id: "public.strategy.priorities.title",
                defaultMessage: "Delivery comes first",
              })}
            </EditorialHeading>
            <ol className="mt-8 divide-y divide-stroke-soft-200 border-y border-stroke-soft-200">
              {PRIORITIES.map((priority, index) => (
                <li
                  key={priority.key}
                  className="grid gap-4 py-7 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:gap-10"
                >
                  <div>
                    <EditorialKicker className="mb-2">0{index + 1}</EditorialKicker>
                    <EditorialHeading as="h3" size="sub">
                      {formatMessage({
                        id: `public.strategy.${priority.key}.title`,
                        defaultMessage: priority.title,
                      })}
                    </EditorialHeading>
                  </div>
                  <div>
                    <EditorialLede>
                      {formatMessage({
                        id: `public.strategy.${priority.key}.body`,
                        defaultMessage: priority.body,
                      })}
                    </EditorialLede>
                    <dl className="mt-4 space-y-2 text-sm leading-relaxed text-text-sub-600">
                      {(["status", "owner", "dependency"] as const).map((field) => (
                        <div key={field}>
                          <dt className="inline font-semibold text-text-strong-950">
                            {formatMessage({
                              id: `public.strategy.label.${field}`,
                              defaultMessage: LABELS[field],
                            })}{" "}
                          </dt>
                          <dd className="inline">
                            {formatMessage({
                              id: `public.strategy.${priority.key}.${field}`,
                              defaultMessage: priority[field],
                            })}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="mt-16" aria-labelledby="strategy-roadmap">
            <EditorialKicker className="mb-3">
              {formatMessage({
                id: "public.strategy.roadmap.kicker",
                defaultMessage: "§ 02: Q4 roadmap",
              })}
            </EditorialKicker>
            <EditorialHeading id="strategy-roadmap">
              {formatMessage({
                id: "public.strategy.roadmap.title",
                defaultMessage: "A season of focused work",
              })}
            </EditorialHeading>
            <EditorialLede className="mt-4 max-w-3xl">
              {formatMessage({
                id: "public.strategy.roadmap.lede",
                defaultMessage:
                  "This is the sequence we are working toward, reviewed on November 4. Planned work depends on the delivery and capacity checks above; dates do not establish that a feature is live.",
              })}
            </EditorialLede>
            <ol className="mt-8 divide-y divide-stroke-soft-200 border-y border-stroke-soft-200">
              {MONTHS.map((month) => (
                <li
                  key={month.key}
                  className="grid gap-3 py-7 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:gap-10"
                >
                  <div>
                    <EditorialHeading as="h3" size="sub">
                      {formatMessage({
                        id: `public.strategy.${month.key}.title`,
                        defaultMessage: month.title,
                      })}
                    </EditorialHeading>
                    <p className="mt-2 text-sm font-medium text-text-sub-600">
                      {formatMessage({
                        id: `public.strategy.${month.key}.status`,
                        defaultMessage: month.status,
                      })}
                    </p>
                  </div>
                  <EditorialLede>
                    {formatMessage({
                      id: `public.strategy.${month.key}.body`,
                      defaultMessage: month.body,
                    })}
                  </EditorialLede>
                </li>
              ))}
            </ol>
          </section>

          <section className="mt-16" aria-labelledby="strategy-materials">
            <EditorialKicker className="mb-3">
              {formatMessage({
                id: "public.strategy.materials.kicker",
                defaultMessage: "§ 03: Reviewed materials",
              })}
            </EditorialKicker>
            <EditorialHeading id="strategy-materials">
              {formatMessage({
                id: "public.strategy.materials.title",
                defaultMessage: "A closer look",
              })}
            </EditorialHeading>
            <EditorialLede className="mt-4 max-w-3xl">
              {formatMessage({
                id: "public.strategy.materials.body",
                defaultMessage:
                  "Choose the reviewed deck for your context, or start with the brief. These PDFs describe the project; planned work remains subject to the limits on this page.",
              })}
            </EditorialLede>
            <ul className="mt-6 flex flex-wrap gap-x-8 gap-y-4">
              {DECKS.map(([audience, fileId, label]) => (
                <li key={audience}>
                  <EditorialLinkArrow
                    className="border-primary-on-surface/35 text-primary-on-surface hover:border-primary-on-surface hover:text-primary-on-surface focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-on-surface"
                    to={`https://drive.google.com/file/d/${fileId}/view`}
                    external
                  >
                    {formatMessage({
                      id: `public.strategy.deck.${audience}`,
                      defaultMessage: label,
                    })}
                  </EditorialLinkArrow>
                </li>
              ))}
            </ul>
          </section>

          <section
            className="mt-16 border-t border-stroke-soft-200 pt-8"
            aria-labelledby="strategy-next"
          >
            <EditorialHeading id="strategy-next">
              {formatMessage({
                id: "public.strategy.next.title",
                defaultMessage: "Help the next work take root",
              })}
            </EditorialHeading>
            <EditorialLede className="mt-4 max-w-3xl">
              {formatMessage({
                id: "public.strategy.next.body",
                defaultMessage:
                  "To discuss a partnership, email Afo at contact@greengoods.app with the community you work with, the need you want to address, and the support you can offer. To support an existing garden, explore its public record and funding options.",
              })}
            </EditorialLede>
            <div className="mt-6 flex flex-wrap gap-x-8 gap-y-4">
              <EditorialLinkArrow
                className="border-primary-on-surface/35 text-primary-on-surface hover:border-primary-on-surface hover:text-primary-on-surface focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-on-surface"
                to="mailto:contact@greengoods.app"
              >
                {formatMessage({
                  id: "public.strategy.next.contact",
                  defaultMessage: "Discuss a Partnership",
                })}
              </EditorialLinkArrow>
              <EditorialLinkArrow
                className="border-primary-on-surface/35 text-primary-on-surface hover:border-primary-on-surface hover:text-primary-on-surface focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-on-surface"
                to="/fund"
              >
                {formatMessage({
                  id: "public.strategy.next.support",
                  defaultMessage: "Support a Garden",
                })}
              </EditorialLinkArrow>
            </div>
          </section>
        </div>
      </div>
      <PublicFooter variant="soil" />
    </>
  );
}
