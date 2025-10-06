import type { IntlShape } from "react-intl";

const getTag = (intl: IntlShape, tag: string) => {
  const tagName = tag.replace(" ", "_");
  return intl.formatMessage({
    id: `app.garden.tags.${tagName}`,
    description: `Tag ${tagName}`,
    defaultMessage: tag,
  });
};

export default getTag;
