import { describe, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { Root } from "../main";

describe("App", () => {
  it("renders the App component", () => {
    render(<Root />);
    screen.debug(); // prints out the jsx in the App component unto the command line
  });
});
