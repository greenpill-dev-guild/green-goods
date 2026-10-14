/**
 * @vitest-environment happy-dom
 */

import {
  commitmentFixture,
  contributorFixture,
} from "@green-goods/shared/__tests__/test-utils/commitment-pooling-fixtures";
import type { ComponentProps } from "react";
import { describe, expect, it } from "vitest";
import { renderWithProviders, screen, within } from "../test-utils";
import { CommitmentPeople } from "@/views/Home/Garden/Commitment/CommitmentPeople";

const ASKER = "0x1111111111111111111111111111111111111111" as const;
const PROVIDER = "0x2222222222222222222222222222222222222222" as const;
const NAMED_CONFIRMER = "0x3333333333333333333333333333333333333333" as const;
const HELPER = "0x4444444444444444444444444444444444444444" as const;
const GARDEN = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;

function renderPeople(props: Partial<ComponentProps<typeof CommitmentPeople>>) {
  return renderWithProviders(
    <CommitmentPeople
      commitment={commitmentFixture()}
      contributors={[]}
      seat={null}
      units={null}
      viewer={null}
      stewards={[]}
      {...props}
    />
  );
}

/** The fact row a label heads, so a test can read which account it names. */
const row = (label: string) => screen.getByText(label).closest("div") as HTMLElement;

describe("CommitmentPeople", () => {
  it("names the request creator as its confirmer after another person accepts", () => {
    renderPeople({
      commitment: commitmentFixture({
        direction: "REQUEST",
        creator: ASKER,
        counterparty: PROVIDER,
        leadProvider: PROVIDER,
      }),
      seat: "confirmer",
      viewer: ASKER,
    });

    // One "Confirms it" row names the asker; they need no second row saying they asked.
    expect(screen.getByText("Confirms it")).toBeInTheDocument();
    expect(screen.queryByText("Asked for this")).not.toBeInTheDocument();
    expect(screen.getByText("You")).toBeInTheDocument();
  });

  it("does not label the request creator as a confirmer when a named group replaces the fallback", () => {
    renderPeople({
      commitment: commitmentFixture({
        direction: "REQUEST",
        creator: ASKER,
        counterparty: PROVIDER,
        leadProvider: PROVIDER,
        confirmers: [NAMED_CONFIRMER],
      }),
      seat: "confirmer",
    });

    expect(screen.getByText("Asked for this")).toBeInTheDocument();
    expect(screen.queryByText("Confirms it")).not.toBeInTheDocument();
    expect(screen.queryByText("You")).not.toBeInTheDocument();
  });

  it("recognizes the requester from their account when another person confirms", () => {
    renderPeople({
      commitment: commitmentFixture({
        direction: "REQUEST",
        creator: ASKER,
        leadProvider: PROVIDER,
        confirmers: [NAMED_CONFIRMER],
      }),
      viewer: ASKER,
      seat: "bystander",
    });
    expect(within(row("Asked for this")).getByText("You")).toBeInTheDocument();
    expect(within(row("Asked for this")).getByText(ASKER)).toBeInTheDocument();
  });

  it("does not label another account as You based only on a seat", () => {
    renderPeople({
      commitment: commitmentFixture({ leadProvider: PROVIDER }),
      viewer: HELPER,
      seat: "provider",
    });
    expect(within(row("Doing this")).queryByText("You")).not.toBeInTheDocument();
  });

  it("names the asker, never the garden that took the request up, as who confirms it", () => {
    // On a garden claim the contract stores the garden as the counterparty.
    renderPeople({
      commitment: commitmentFixture({
        direction: "REQUEST",
        creator: ASKER,
        counterparty: GARDEN,
        counterpartyKind: "GARDEN",
        leadProvider: PROVIDER,
      }),
    });

    const confirms = row("Confirms it");
    expect(within(confirms).getByText(ASKER)).toBeInTheDocument();
    expect(screen.queryByText(GARDEN)).not.toBeInTheDocument();
    expect(screen.queryByText("Asked for this")).not.toBeInTheDocument();
  });

  it("says who is helping, and marks a confirming steward with the role", () => {
    renderPeople({
      commitment: commitmentFixture({
        commitmentId: 9n,
        direction: "REQUEST",
        creator: ASKER,
        counterparty: PROVIDER,
        leadProvider: PROVIDER,
      }),
      contributors: [
        contributorFixture({ commitmentId: 9n, contributor: PROVIDER, isLead: true }),
        contributorFixture({ commitmentId: 9n, contributor: HELPER }),
      ],
      seat: "provider",
      viewer: PROVIDER,
      stewards: [ASKER],
    });

    expect(within(row("Team")).getByText(/is helping$/)).toBeInTheDocument();
    expect(within(row("Team")).getByTitle(HELPER)).toBeInTheDocument();
    expect(within(row("Confirms it")).getByText("Steward")).toBeInTheDocument();
  });
});
