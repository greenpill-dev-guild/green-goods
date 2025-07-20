import schemas from "../../contracts/config/schemas.json";

export const APP_NAME = "Green Goods";
export const APP_DEFAULT_TITLE = "Green Goods";
export const APP_TITLE_TEMPLATE = "%s - Green Goods";
export const APP_DESCRIPTION = "Start Bringing Biodiversity Onchain";
export const APP_URL = "https://greengoods.app";
export const APP_ICON = "https://greengoods.app/icon.png";

export const EAS = {
  "42161": {
    GARDEN_ASSESSMENT: {
      uid: "0x0", // TODO: Set proper UID when schemas are deployed
      schema: schemas.schemas.gardenAssessment,
    },
    WORK: {
      uid: "0x0", // TODO: Set proper UID when schemas are deployed
      schema: schemas.schemas.work,
    },
    WORK_APPROVAL: {
      uid: "0x0", // TODO: Set proper UID when schemas are deployed
      schema: schemas.schemas.workApproval,
    },
    EAS: {
      address: "0xbD75f629A22Dc1ceD33dDA0b68c546A1c035c458",
    },
  },
  "42220": {
    GARDEN_ASSESSMENT: {
      uid: "0x0", // TODO: Set proper UID when schemas are deployed
      schema: schemas.schemas.gardenAssessment,
    },
    WORK: {
      uid: "0x0", // TODO: Set proper UID when schemas are deployed
      schema: schemas.schemas.work,
    },
    WORK_APPROVAL: {
      uid: "0x0", // TODO: Set proper UID when schemas are deployed
      schema: schemas.schemas.workApproval,
    },
    EAS: {
      address: "0xbD75f629A22Dc1ceD33dDA0b68c546A1c035c458",
    },
  },
};
