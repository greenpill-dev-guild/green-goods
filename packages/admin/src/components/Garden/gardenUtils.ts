import { GARDEN_ROLE_I18N_KEYS, type GardenRole } from "@green-goods/shared";
import type { IntlShape } from "react-intl";

export const getRoleLabel = (role: GardenRole, formatMessage: IntlShape["formatMessage"]) => ({
  singular: formatMessage({ id: GARDEN_ROLE_I18N_KEYS[role].singular }),
  plural: formatMessage({ id: GARDEN_ROLE_I18N_KEYS[role].plural }),
});
