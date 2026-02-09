import { addons } from "@storybook/manager-api";
import greenGoodsTheme from "./theme";

addons.setConfig({
  theme: greenGoodsTheme,
  sidebar: {
    showRoots: true,
  },
});
