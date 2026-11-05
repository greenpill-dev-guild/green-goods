import type { Meta, StoryObj } from "@storybook/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { withClientAppRuntime } from "../../../../shared/.storybook/decorators";
import PublicShell from "../../routes/PublicShell";
import Strategy from "./Strategy";

const meta = {
  title: "Client/Public/Strategy",
  component: Strategy,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  decorators: [
    withClientAppRuntime,
    (Story) => (
      <MemoryRouter initialEntries={["/strategy"]}>
        <Routes>
          <Route element={<PublicShell />}>
            <Route path="/strategy" element={<Story />} />
          </Route>
        </Routes>
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof Strategy>;
export default meta;
type Story = StoryObj<typeof meta>;

export const EnglishDesktop: Story = { globals: { locale: "en", viewport: { value: "desktop" } } };
export const EnglishMobile: Story = { globals: { locale: "en", viewport: { value: "mobile" } } };
export const SpanishDesktop: Story = { globals: { locale: "es", viewport: { value: "desktop" } } };
export const SpanishMobile: Story = { globals: { locale: "es", viewport: { value: "mobile" } } };
export const PortugueseDesktop: Story = {
  globals: { locale: "pt", viewport: { value: "desktop" } },
};
export const PortugueseMobile: Story = { globals: { locale: "pt", viewport: { value: "mobile" } } };
