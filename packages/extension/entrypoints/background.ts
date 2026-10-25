import { defineBackground } from "wxt/utils/define-background";
import { browser } from "wxt/browser";

// The service worker does nothing but open the graph tab from the toolbar. Execution lives in
// the graph tab (decision 3); nothing here keeps the worker alive.
export default defineBackground(() => {
  browser.action?.onClicked.addListener(() => {
    void browser.tabs.create({ url: browser.runtime.getURL("/graph.html") });
  });
});
