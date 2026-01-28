import type { Meta, StoryObj } from "@storybook/react";
import {
  CardBase,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "./CardBase";

const meta: Meta<typeof CardBase> = {
  title: "Components/Cards/CardBase",
  component: CardBase,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "primary", "elevated"],
      description: "Visual variant",
    },
    mode: {
      control: "select",
      options: ["outline", "filled", "ghost", "no-outline"],
      description: "Border/background mode",
    },
    size: {
      control: "select",
      options: ["sm", "md", "lg", "auto"],
      description: "Padding size",
    },
    interactive: {
      control: "boolean",
      description: "Whether card is clickable",
    },
    container: {
      control: "boolean",
      description: "Enable container queries",
    },
  },
};

export default meta;
type Story = StoryObj<typeof CardBase>;

export const Default: Story = {
  args: {
    children: (
      <>
        <CardHeader>
          <CardTitle>Card Title</CardTitle>
          <CardDescription>Card description goes here</CardDescription>
        </CardHeader>
        <CardContent>
          <p>This is the card content area.</p>
        </CardContent>
        <CardFooter>
          <button className="px-4 py-2 bg-primary text-white rounded-lg">Action</button>
        </CardFooter>
      </>
    ),
    size: "md",
  },
};

export const Elevated: Story = {
  args: {
    variant: "elevated",
    size: "md",
    children: (
      <>
        <CardHeader>
          <CardTitle>Elevated Card</CardTitle>
          <CardDescription>With shadow effect</CardDescription>
        </CardHeader>
        <CardContent>
          <p>This card has a shadow for depth.</p>
        </CardContent>
      </>
    ),
  },
};

export const Interactive: Story = {
  args: {
    interactive: true,
    size: "md",
    children: (
      <>
        <CardHeader>
          <CardTitle>Clickable Card</CardTitle>
          <CardDescription>Hover and click me</CardDescription>
        </CardHeader>
        <CardContent>
          <p>This card responds to hover and click.</p>
        </CardContent>
      </>
    ),
  },
};

export const Ghost: Story = {
  args: {
    mode: "ghost",
    size: "md",
    children: (
      <>
        <CardHeader>
          <CardTitle>Ghost Card</CardTitle>
          <CardDescription>No border or background</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Minimal visual style.</p>
        </CardContent>
      </>
    ),
  },
};

export const AllModes: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-4">
      <CardBase mode="outline" size="md">
        <CardHeader>
          <CardTitle>Outline</CardTitle>
        </CardHeader>
        <CardContent>Border with light shadow</CardContent>
      </CardBase>
      <CardBase mode="filled" size="md">
        <CardHeader>
          <CardTitle>Filled</CardTitle>
        </CardHeader>
        <CardContent>Background color, no border</CardContent>
      </CardBase>
      <CardBase mode="ghost" size="md">
        <CardHeader>
          <CardTitle>Ghost</CardTitle>
        </CardHeader>
        <CardContent>No border or background</CardContent>
      </CardBase>
      <CardBase mode="no-outline" size="md">
        <CardHeader>
          <CardTitle>No Outline</CardTitle>
        </CardHeader>
        <CardContent>Clean look</CardContent>
      </CardBase>
    </div>
  ),
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <CardBase size="sm">
        <CardContent>Small padding (p-2)</CardContent>
      </CardBase>
      <CardBase size="md">
        <CardContent>Medium padding (p-4)</CardContent>
      </CardBase>
      <CardBase size="lg">
        <CardContent>Large padding (p-6)</CardContent>
      </CardBase>
    </div>
  ),
};
