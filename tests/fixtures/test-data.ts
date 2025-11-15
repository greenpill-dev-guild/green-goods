// Test Data Management - Simple foundation that can be built upon

export interface TestGarden {
  name: string;
  description: string;
  location: string;
}

export interface TestAction {
  title: string;
  instructions: string;
  capitals: string[];
}

export interface TestWork {
  actionId: string;
  description: string;
  media?: string[];
}

export const testGardens = {
  create: (): TestGarden => ({
    name: `E2E Test Garden ${Date.now()}`,
    description: "Automated test garden for end-to-end testing",
    location: "Test Location",
  }),

  sample: (): TestGarden => ({
    name: "Sample Garden",
    description: "Sample garden for testing purposes",
    location: "Sample Location",
  }),
};

export const testActions = {
  create: (): TestAction => ({
    title: `Test Action ${Date.now()}`,
    instructions: "Complete this test action for e2e testing",
    capitals: ["SOCIAL", "MATERIAL"],
  }),

  sample: (): TestAction => ({
    title: "Sample Conservation Action",
    instructions: "Plant native trees in the designated area",
    capitals: ["LIVING", "MATERIAL"],
  }),
};

export const testWorks = {
  create: (actionId: string): TestWork => ({
    actionId,
    description: `Test work submission for action ${actionId}`,
    media: [],
  }),
};

// Environment-specific test data
export const testEnvironments = {
  baseSepolia: {
    chainId: 84532,
    name: "Base Sepolia",
    rpcUrl: "https://sepolia.base.org",
  },
};
