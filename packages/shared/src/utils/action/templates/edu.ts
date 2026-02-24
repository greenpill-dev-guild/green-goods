import type { ActionInstructionConfig } from "../../../types/domain";

export const eduPublishSession: ActionInstructionConfig = {
  description:
    "Announce and publish an upcoming educational session. Document planned duration, capacity, session type, and venue details.",
  uiConfig: {
    media: {
      title: "Attach Flyer or Poster",
      description: "Optionally attach a flyer, poster, or screenshot of the session announcement.",
      maxImageCount: 3,
      minImageCount: 0,
      required: false,
      needed: [],
      optional: ["Flyer/poster", "Venue photo"],
    },
    details: {
      title: "Session Planning Details",
      description: "Provide details about the planned educational session.",
      feedbackPlaceholder: "Additional notes about the session plan, prerequisites, or logistics",
      inputs: [
        {
          key: "plannedDurationMin",
          title: "Planned Duration (min)",
          placeholder: "Enter planned session duration in minutes",
          type: "number",
          required: true,
          options: [],
          unit: "min",
        },
        {
          key: "capacity",
          title: "Capacity",
          placeholder: "Enter maximum participant capacity",
          type: "number",
          required: true,
          options: [],
        },
        {
          key: "sessionType",
          title: "Session Type",
          placeholder: "Select the session format",
          type: "select",
          required: true,
          options: [
            "Workshop",
            "Lecture",
            "Office hours",
            "Hackathon",
            "Field trip",
            "Panel",
            "Other",
          ],
        },
      ],
    },
    review: {
      title: "Review Session Plan",
      description: "Review the session details before publishing.",
    },
  },
};

export const eduDeliverSession: ActionInstructionConfig = {
  description:
    "Document a completed educational workshop or session. Record delivered duration, facilitator count, and format details.",
  uiConfig: {
    media: {
      title: "Capture Workshop Photo",
      description: "Take a photo of the room, materials, or session in progress.",
      maxImageCount: 5,
      minImageCount: 1,
      required: true,
      needed: ["Session in progress or materials"],
      optional: ["Participants (privacy-safe)", "Whiteboard/screen"],
    },
    details: {
      title: "Workshop Delivery Details",
      description: "Provide details about the delivered workshop session.",
      feedbackPlaceholder: "Notes about engagement, challenges, or feedback received",
      inputs: [
        {
          key: "deliveredDurationMin",
          title: "Delivered Duration (min)",
          placeholder: "Enter actual session duration in minutes",
          type: "number",
          required: true,
          options: [],
          unit: "min",
        },
        {
          key: "facilitators",
          title: "Facilitators",
          placeholder: "Enter number of facilitators",
          type: "number",
          required: true,
          options: [],
        },
        {
          key: "trackTags",
          title: "Topics Covered",
          placeholder: "Select topics covered",
          type: "multi-select",
          required: true,
          options: [
            "Web3 basics",
            "Smart contracts",
            "DeFi",
            "Governance",
            "Impact measurement",
            "Regenerative finance",
            "Developer tools",
            "Other",
          ],
        },
      ],
    },
    review: {
      title: "Review Workshop",
      description: "Review the workshop delivery details before submitting.",
    },
  },
};

export const eduVerifyAttendance: ActionInstructionConfig = {
  description:
    "Verify and document attendance for an educational session. Record attendee count, verification method, and privacy mode used.",
  uiConfig: {
    media: {
      title: "Capture Attendance Proof",
      description: "Upload a roster export, QR scan screenshot, or attendance record.",
      maxImageCount: 3,
      minImageCount: 1,
      required: true,
      needed: ["Attendance record/roster"],
      optional: ["QR scan screenshot"],
    },
    details: {
      title: "Attendance Verification Details",
      description: "Provide details about the verified attendance.",
      feedbackPlaceholder: "Notes about verification process or any discrepancies",
      inputs: [
        {
          key: "attendees",
          title: "Attendees Verified",
          placeholder: "Enter number of verified attendees",
          type: "number",
          required: true,
          options: [],
        },
        {
          key: "verifyMethod",
          title: "Verification Method",
          placeholder: "Select how attendance was verified",
          type: "select",
          required: true,
          options: [
            "Sign-in sheet",
            "QR code scan",
            "POAP/NFT claim",
            "Roll call",
            "Digital roster",
            "Other",
          ],
        },
        {
          key: "uniqueCountBand",
          title: "Unique Attendee Estimate",
          placeholder: "Select approximate unique attendee range",
          type: "band",
          required: false,
          options: [],
          bands: ["1-5", "6-15", "16-30", "31-50", "51-100", "100+"],
        },
      ],
    },
    review: {
      title: "Review Attendance",
      description: "Review the attendance verification details before submitting.",
    },
  },
};

export const eduFollowupAction: ActionInstructionConfig = {
  description:
    "Document a follow-up action taken after an educational session. Captures proof of real-world application.",
  uiConfig: {
    media: {
      title: "Capture Proof",
      description: "Upload a screenshot or proof of the follow-up action taken.",
      maxImageCount: 5,
      minImageCount: 1,
      required: true,
      needed: ["Action proof (screenshot, photo, or export)"],
      optional: ["Additional context"],
    },
    details: {
      title: "Follow-up Action Details",
      description: "Provide details about the follow-up action taken.",
      feedbackPlaceholder: "Notes about the experience, challenges, or next steps planned",
      inputs: [
        {
          key: "followUpType",
          title: "Follow-up Type",
          placeholder: "Select what type of follow-up action",
          type: "select",
          required: true,
          options: [
            "Wallet setup",
            "First transaction",
            "Smart contract deploy",
            "dApp interaction",
            "Repository contribution",
            "Blog/documentation",
            "Community event",
            "Other",
          ],
        },
        {
          key: "proofCountBand",
          title: "Proof Items",
          placeholder: "Select number of proof items",
          type: "band",
          required: true,
          options: [],
          bands: ["1", "2-3", "4-5", "6+"],
        },
        {
          key: "proofType",
          title: "Proof Type",
          placeholder: "Select proof category",
          type: "select",
          required: true,
          options: [
            "On-chain transaction",
            "Wallet screenshot",
            "Repository commit",
            "Blog post",
            "Event photo",
            "Other",
          ],
        },
      ],
    },
    review: {
      title: "Review Follow-up",
      description: "Review the follow-up action details before submitting.",
    },
  },
};

export const eduLearningAssessment: ActionInstructionConfig = {
  description: "Document a learning assessment result (quiz, project, or practical evaluation).",
  uiConfig: {
    media: {
      title: "Capture Assessment Proof",
      description: "Upload a screenshot of the quiz result, project output, or assessment record.",
      maxImageCount: 3,
      minImageCount: 1,
      required: true,
      needed: ["Assessment result screenshot"],
      optional: ["Project output", "Certificate"],
    },
    details: {
      title: "Assessment Details",
      description: "Provide details about the learning assessment.",
      feedbackPlaceholder:
        "Notes about the assessment experience, difficulty, or areas for improvement",
      inputs: [
        {
          key: "result",
          title: "Result",
          placeholder: "Select pass or fail",
          type: "select",
          required: true,
          options: ["Pass", "Fail"],
        },
        {
          key: "scoreBand",
          title: "Score Range",
          placeholder: "Select score range",
          type: "band",
          required: true,
          options: [],
          bands: ["0-25%", "26-50%", "51-75%", "76-90%", "91-100%"],
        },
        {
          key: "assessmentType",
          title: "Assessment Type",
          placeholder: "Select assessment format",
          type: "select",
          required: true,
          options: [
            "Written quiz",
            "Practical project",
            "Oral presentation",
            "Code review",
            "Portfolio",
            "Other",
          ],
        },
      ],
    },
    review: {
      title: "Review Assessment",
      description: "Review the learning assessment details before submitting.",
    },
  },
};
