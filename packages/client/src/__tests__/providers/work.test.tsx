import { ethers } from "ethers";
import { describe, it } from "vitest";
import { render } from "@testing-library/react";
import { EAS, NO_EXPIRATION, SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";

import { EAS as constants } from "@/constants";
import { useWork, WorkProvider } from "@/providers/work";

const TestComponent = () => {
  const { activeTab, workApprovals } = useWork();

  return (
    <div>
      <p>Workers: {workApprovals.length}</p>
      <p>Works: {activeTab}</p>
    </div>
  );
};

describe("WorkProvider", () => {
  it("should provide default value and allow updates", () => {
    render(
      <WorkProvider>
        <TestComponent />
      </WorkProvider>
    );

    // Check initial value
    // expect(screen.getByTestId('value')).toHaveTextContent('default');

    // Update value via button click
    // screen.getByRole('button', { name: /update value/i }).click();

    // Check updated value
    // expect(screen.getByTestId('value')).toHaveTextContent('updated');
  });
});

describe("Work Attestation", () => {
  it("should provide default value and allow updates", async () => {
    const provider = new ethers.AlchemyProvider("arbitrum", import.meta.env.VITE_ALCHEMY_API_KEY);

    // Create a wallet instance using the private key and connect it to the provider
    const wallet = new ethers.Wallet(import.meta.env.PRIVATE_KEY, provider);
    const eas = new EAS(constants[42161].EAS.address);

    eas.connect(wallet);

    // Initialize SchemaEncoder with the schema string
    const schema = constants["42161"].WORK.schema as `0x${string}`;
    const schemaEncoder = new SchemaEncoder(schema);

    const encodedData = schemaEncoder.encodeData([
      { name: "actionUID", value: 1, type: "uint256" },
      { name: "title", value: "Test Work", type: "string" },
      { name: "feedback", value: "Test Feedback", type: "string" },
      { name: "metadata", value: "Test Metadata", type: "string" },
      { name: "media", value: ["Test Media"], type: "string[]" },
    ]);

    const tx = await eas.attest({
      schema: constants["42161"].WORK.uid,
      data: {
        recipient: "0x55fdFb60fb07fCe2Dc8A7CC3ED8a6f1C793FeE68",
        expirationTime: NO_EXPIRATION,
        revocable: true, // Be aware that if your schema is not revocable, this MUST be false
        data: encodedData,
      },
    });

    console.log(tx);
  });
});

describe("Work Approval Attestation", () => {
  it("should provide default value and allow updates", async () => {
    const provider = new ethers.AlchemyProvider("arbitrum", import.meta.env.VITE_ALCHEMY_API_KEY);

    // Create a wallet instance using the private key and connect it to the provider
    const wallet = new ethers.Wallet(import.meta.env.PRIVATE_KEY, provider);
    const eas = new EAS(constants[42161].EAS.address);

    eas.connect(wallet);

    // Initialize SchemaEncoder with the schema string
    const schema = constants["42161"].WORK_APPROVAL.schema as `0x${string}`;
    const schemaEncoder = new SchemaEncoder(schema);

    const encodedData = schemaEncoder.encodeData([
      { name: "actionUID", value: 1, type: "uint256" },
      { name: "workUID", value: "", type: "bytes32" },
      { name: "approved", value: true, type: "bool" },
      { name: "feedback", value: "Test Feedback", type: "string" },
    ]);

    const tx = await eas.attest({
      schema: constants["42161"].WORK_APPROVAL.uid,
      data: {
        recipient: "0xb294D4d442B99f21f9E2d9E1821f83057B2beC5A",
        expirationTime: NO_EXPIRATION,
        revocable: true, // Be aware that if your schema is not revocable, this MUST be false
        data: encodedData,
      },
    });

    console.log(tx);
  });
});
