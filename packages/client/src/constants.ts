export const APP_NAME = "Green Goods";
export const APP_DEFAULT_TITLE = "Green Goods";
export const APP_TITLE_TEMPLATE = "%s - Green Goods";
export const APP_DESCRIPTION = "Start Bringing Biodiversity Onchain";
export const APP_URL = "https://greengoods.app";
export const APP_ICON = "https://greengoods.app/icon.png";

import schemas from "../../eas/src/resources/schemas.json";

export const EAS = {
  "42161": {
    GARDEN_ASSESSMENT: {
      uid: schemas[0].UID,
      schema: schemas[0].parsed,
    },
    WORK: {
      uid: schemas[1].UID,
      schema: schemas[1].parsed,
    },
    WORK_APPROVAL: {
      uid: schemas[2].UID,
      schema: schemas[2].parsed,
    },
    EAS: {
      address: "0xbD75f629A22Dc1ceD33dDA0b68c546A1c035c458",
    },
  },
};

export const GREEN_GOODS_GARDEN_OPERATOR_WHITELIST = [
  "afo@greenpill.builders",
  "coi@greenpill.builders",
  "nansel@greenpill.builders",
];
