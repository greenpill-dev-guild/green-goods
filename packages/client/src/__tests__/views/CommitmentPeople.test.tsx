/**
 * @vitest-environment jsdom
 */

import { commitmentFixture } from "@green-goods/shared/__tests__/test-utils/commitment-pooling-fixtures";
import { describe, expect, it } from "vitest";
import { renderWithProviders, screen } from "../test-utils";
import { CommitmentPeople } from "@/views/Home/Garden/Commitment/CommitmentPeople";

const ASKER = "0x1111111111111111111111111111111111111111" as const;
const PROVIDER = "0x2222222222222222222222222222222222222222" as const;
const NAMED_CONFIRMER = "0x3333333333333333333333333333333333333333" as const;

describe("CommitmentPeople", () => {
  it("names the request creator as its confirmer after another person accepts", () => {
    renderWithProviders(
      <CommitmentPeople
        commitment={commitmentFixture({
          direction: "REQUEST",
          creator: ASKER,
          counterparty: PROVIDER,
          leadProvider: PROVIDER,
        })}
        contributors={[]}
        seat="confirmer"
      />
    );

    expect(screen.getByText("Asked for this · confirms it")).toBeInTheDocument();
    expect(screen.getByText("You")).toBeInTheDocument();
  });

  it("does not label the request creator as a confirmer when a named group replaces the fallback", () => {
    renderWithProviders(
      <CommitmentPeople
        commitment={commitmentFixture({
          direction: "REQUEST",
          creator: ASKER,
          counterparty: PROVIDER,
          leadProvider: PROVIDER,
          confirmers: [NAMED_CONFIRMER],
        })}
        contributors={[]}
        seat="confirmer"
      />
    );

    expect(screen.getByText("Asked for this")).toBeInTheDocument();
    expect(screen.queryByText("Asked for this · confirms it")).not.toBeInTheDocument();
    expect(screen.queryByText("You")).not.toBeInTheDocument();
  });
});
