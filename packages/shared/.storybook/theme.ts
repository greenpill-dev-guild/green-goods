import { create } from "@storybook/theming/create";

export default create({
  base: "light",

  // Brand
  brandTitle: "Green Goods Design System",
  brandUrl: "https://greengoods.app",
  brandImage: "/green-goods-logo.png", // From staticDirs
  brandTarget: "_self",

  // Colors - Green Goods palette
  colorPrimary: "#1FC16B", // Primary green
  colorSecondary: "#1A7544", // Dark green

  // UI
  appBg: "#f8faf9", // Light green-tinted background
  appContentBg: "#ffffff",
  appBorderColor: "#e2e8e4",
  appBorderRadius: 8,

  // Typography
  fontBase: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
  fontCode: "monospace",

  // Text colors
  textColor: "#0a0a0a",
  textInverseColor: "#ffffff",
  textMutedColor: "#6b7280",

  // Toolbar
  barTextColor: "#6b7280",
  barSelectedColor: "#1FC16B",
  barHoverColor: "#1A7544",
  barBg: "#ffffff",

  // Inputs
  inputBg: "#ffffff",
  inputBorder: "#d1d5db",
  inputTextColor: "#0a0a0a",
  inputBorderRadius: 6,
});
