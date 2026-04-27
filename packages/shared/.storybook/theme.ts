import { create } from "storybook/theming/create";

export default create({
  base: "light",

  // Brand
  brandTitle: "Green Goods Component Library",
  brandUrl: "https://design.greengoods.app/",
  brandImage: "green-goods-logo.png", // From staticDirs; relative for standalone deploys
  brandTarget: "_self",

  // Warm Earth public-browser dialect
  colorPrimary: "#1FC16B", // Accent green
  colorSecondary: "#1A7544", // Contrast-safe action green

  // UI
  appBg: "#FAF8F5",
  appContentBg: "#FAF8F5",
  appBorderColor: "#A8A29E",
  appBorderRadius: 8,

  // Typography
  fontBase: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
  fontCode: "monospace",

  // Text colors
  textColor: "#292524",
  textInverseColor: "#F5F5F4",
  textMutedColor: "#78716C",

  // Toolbar
  barTextColor: "#78716C",
  barSelectedColor: "#1A7544",
  barHoverColor: "#16643B",
  barBg: "#FAF8F5",

  // Inputs
  inputBg: "#F5F5F4",
  inputBorder: "#A8A29E",
  inputTextColor: "#292524",
  inputBorderRadius: 6,
});
