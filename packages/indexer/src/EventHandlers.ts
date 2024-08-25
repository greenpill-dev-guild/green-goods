import {
  ActionRegistry,
  GardenToken,
  GardenAccount,
  EAS,
  Action,
  // Garden,
} from "generated";
import { Capital_t } from "generated/src/db/Enums.gen";

import {
  getWorkAttestation,
  getWorkApprovalAttestation,
  getGardenAssessmentAttestation,
} from "./eas";
import {
  WORK_SCHEMA_UID,
  WORK_APPROVAL_SCHEMA_UID,
  GARDEN_ASSESSMENT_SCHEMA_UID,
} from "./constants";

// Handler for the ActionRegistered event
ActionRegistry.ActionRegistered.handler(async ({ event, context }) => {
  // const actionId = event.params.action[0].toString(); // ToDo: add action id to event
  // const capitals: Capital_t[] = event.params.action[4].map((capital) => {
  //   const number = Number(capital);
  //   if (number === 1) {
  //     return "SOCIAL";
  //   } else if (number === 2) {
  //     return "MATERIAL";
  //   } else if (number === 3) {
  //     return "FINANCIAL";
  //   } else if (number === 4) {
  //     return "LIVING";
  //   } else if (number === 5) {
  //     return "INTELLECTUAL";
  //   } else if (number === 6) {
  //     return "SPIRITUAL";
  //   } else if (number === 7) {
  //     return "CULTURAL";
  //   } else {
  //     return "UNKNOWN";
  //   }
  // });
  // // Update or create a new Action entity
  // const actionEntity: Action = {
  //   id: actionId,
  //   ownerAddress: event.params.owner,
  //   startTime: Number(event.params.action[0]),
  //   endTime: Number(event.params.action[1]),
  //   title: event.params.action[2],
  //   instructions: "",
  //   capitals,
  //   media: event.params.action[5],
  // };
  // context.Action.set(actionEntity);
});

// Handler for the ActionUpdated event
ActionRegistry.ActionUpdated.handler(async ({ event, context }) => {
  const actionId = event.params.action[0].toString();

  const currentActionEntity: Action | undefined =
    await context.Action.get(actionId);

  if (currentActionEntity) {
    // Clear the latestGreeting
    context.Action.set({
      ...currentActionEntity,
    });
  }
});

// Handler for the GardenMinted event
GardenToken.GardenMinted.contractRegister(({ event, context }) => {
  // context.addGardenAccount(event.params.) // ToDo: Add garden account to event
});

// Handler for the GardenAccount NameUpdated event
GardenAccount.NameUpdated.handler(async ({ event, context }) => {});

// Handler for the GardenAccount GardenerAdded event
GardenAccount.GardenerAdded.handler(async ({ event, context }) => {});

// Handler for the GardenAccount GardenerRemoved event
GardenAccount.GardenerRemoved.handler(async ({ event, context }) => {});

// Handler for the GardenAccount GardenOperatorAdded event
GardenAccount.GardenOperatorAdded.handler(async ({ event, context }) => {});

// Handler for the GardenAccount GardenOperatorRemoved event
GardenAccount.GardenOperatorRemoved.handler(async ({ event, context }) => {});

// Handler for EAS.Attested event
EAS.Attested.handler(async ({ event, context }) => {
  const uid = event.params.uid;
  const schemaUID = event.params.schemaUID;

  if (schemaUID === WORK_SCHEMA_UID) {
    const work = await getWorkAttestation(uid);

    context.Work.set(work);
  } else if (schemaUID === WORK_APPROVAL_SCHEMA_UID) {
    const workApproval = await getWorkApprovalAttestation(uid);

    context.WorkApproval.set(workApproval);
  } else if (schemaUID === GARDEN_ASSESSMENT_SCHEMA_UID) {
    const gardenAssessment = await getGardenAssessmentAttestation(uid);
    // context.log.debug(gardenAssessment.polygonCoordinates.toString());
    // context.GardenAssessment.set(gardenAssessment);
  }
});
