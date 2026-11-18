/**
 * The browser minimum gate. Below Chrome and Edge 111, Safari 16.4 and Firefox 128 the Green Goods
 * App, the Green Goods Hub and the reporting pages show a plain screen that says how to update,
 * instead of a layout the browser cannot read. The Green Goods Website stays open.
 *
 * `browserMinimumGatePlugin` (browser-support.mjs) injects this file, inside a function scope of
 * its own, at the top of each app's <body> and calls `browserMinimumGate(window, options)`, so it
 * runs before the app's bundle, which is a deferred module. It runs on the browsers it turns away,
 * so it is ES5: no let, const, arrow functions, template strings or newer built-ins. A test parses
 * it to hold that line.
 *
 * Options: `surface` is "hub" or "client"; `logo` is the image the screen shows; `minimum` names
 * the line in force (SUPPORTED_BROWSER_TARGETS); `telemetry` is `{ host, key }` for the surface's
 * PostHog project, or null to send nothing.
 */
function browserMinimumGate(window, options) {
  var document = window.document;
  var root = document.documentElement;

  function cssSupports(property, value) {
    var css = window.CSS;
    return !!(css && typeof css.supports === "function" && css.supports(property, value));
  }

  // One check per feature that arrives at the minimum on at least one engine, so together they
  // draw the line itself: Chrome 111 (color-mix, isWellFormed), Safari 16.4 (range media
  // queries, registerProperty, isWellFormed), Firefox 128 (registerProperty). The CSS checks are
  // features the built stylesheets use; isWellFormed stands in for the JavaScript level the bundles
  // are built for. None reads a user-agent string. When the minimum moves in
  // SUPPORTED_BROWSER_TARGETS, move these with it.
  var checks = [
    // The colors the stylesheets mix. Chrome 111, Safari 16.2, Firefox 113.
    ["color-mix", function () {
      return cssSupports("color", "color-mix(in srgb, red, blue)");
    }],
    // Every width rule the stylesheets write: (width <= 599px). Safari 16.4, Chrome 104.
    ["media-query-ranges", function () {
      return typeof window.matchMedia === "function" && window.matchMedia("(width >= 0px)").matches;
    }],
    // Registered custom properties (@property). Firefox 128, Safari 16.4, Chrome 78.
    ["registered-properties", function () {
      return !!(window.CSS && typeof window.CSS.registerProperty === "function");
    }],
    // Stands in for the JavaScript level the bundles are built for. Chrome 111, Safari 16.4,
    // Firefox 119.
    ["well-formed-strings", function () {
      return typeof window.String.prototype.isWellFormed === "function";
    }],
  ];

  var missing = [];
  for (var index = 0; index < checks.length; index += 1) {
    var passed = false;
    try {
      passed = checks[index][1]();
    } catch (error) {
      passed = false;
    }
    if (!passed) missing.push(checks[index][0]);
  }
  if (!missing.length) return;

  var surface = surfaceOf(options.surface);
  if (!surface) return;

  var language = readLanguage();
  // The app's entries read this before they start, so the app never draws behind the screen.
  root.setAttribute("data-browser-update", "required");
  render(language, surface);
  report(language, surface);

  // The Hub is gated everywhere. In the client, the boot presentation detector (index.html) has
  // already classified the page: the installed App and the reporting pages are gated, and the
  // website stays open.
  function surfaceOf(name) {
    if (name === "hub") return "hub";
    if (root.getAttribute("data-boot-presentation") === "pwa") return "app";
    if (root.getAttribute("data-boot-hero") === "focused") return "signing";
    return null;
  }

  // The app's own rule (resolveRequestedLocale in shared locale-messages): the stored language,
  // else the first browser language the app has copy for, else English.
  function readLanguage() {
    var stored = null;
    try {
      stored = window.localStorage.getItem("gg-language");
    } catch (error) {
      stored = null;
    }
    var navigator = window.navigator;
    var candidates = stored
      ? [stored]
      : navigator.languages && navigator.languages.length
        ? navigator.languages
        : [navigator.language];
    for (var position = 0; position < candidates.length; position += 1) {
      var tag = String(candidates[position] || "").toLowerCase().split("-")[0];
      if (tag === "en" || tag === "es" || tag === "pt") return tag;
    }
    return "en";
  }

  function render(language, surface) {
    var copy = COPY[language];
    var style = document.createElement("style");
    style.id = "browser-update-styles";
    style.appendChild(document.createTextNode(STYLES));
    (document.head || root).appendChild(style);

    var screen = document.createElement("main");
    screen.id = "browser-update";
    screen.setAttribute("lang", language);
    screen.setAttribute("data-surface", surface);
    screen.setAttribute("aria-labelledby", "browser-update-title");

    var content = append(screen, "div", "browser-update-content");
    var logo = append(content, "img", "browser-update-logo");
    logo.setAttribute("src", options.logo);
    logo.setAttribute("alt", "");
    logo.setAttribute("width", "819");
    logo.setAttribute("height", "464");
    append(content, "h1", null, copy.title).id = "browser-update-title";
    // What the App holds on the phone is safe while the app and its data remain: said first.
    if (surface === "app") append(content, "p", "browser-update-safe", copy.safe);
    // A reporting page was opened from a chat link, so its reader opens the link again.
    append(content, "p", "browser-update-lede", surface === "signing" ? copy.ledeLink : copy.lede);
    var steps = append(content, "ul", "browser-update-steps");
    for (var step = 0; step < copy.steps.length; step += 1) {
      var item = append(steps, "li", null);
      append(item, "strong", null, copy.steps[step][0]);
      append(item, "span", null, copy.steps[step][1]);
    }
    append(content, "p", "browser-update-minimum", copy.minimum);

    document.body.appendChild(screen);
  }

  function append(parent, tag, className, text) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.appendChild(document.createTextNode(text));
    parent.appendChild(element);
    return element;
  }

  // One event per browser, so the count is the number of people who land here. It goes straight
  // to PostHog's capture endpoint, in the body posthog-js sends, because the app's own analytics
  // never loads here. The event carries no identifier of its own and no page path (reporting
  // links hold private locators): a random id that is never stored, no person profile, no
  // location lookup, and only the surface, the minimum, the missing checks, the language and the
  // host.
  // PostHog still sees the request's IP address, as it does for the app's own analytics. It
  // stamps the time the event arrived, since old devices often keep the wrong time. The stored
  // flag says only that this browser has been counted, and is set once PostHog has taken the
  // event, so an offline or failed send is tried again. Development hosts send nothing.
  function report(language, surface) {
    var telemetry = options.telemetry;
    if (!telemetry || !telemetry.key || isDevelopmentHost(window.location.hostname)) return;
    var storage = null;
    try {
      storage = window.localStorage;
      // The flag names the minimum it was counted under, so moving the line counts browsers again.
      if (storage.getItem(REPORTED_KEY) === options.minimum) return;
    } catch (error) {
      storage = null;
    }
    if (window.navigator.onLine === false) {
      window.addEventListener("online", send);
      return;
    }
    send();

    function send() {
      window.removeEventListener("online", send);
      var event = {
        event: "browser_update_screen_shown",
        properties: {
          token: telemetry.key,
          distinct_id: "browser-update-" + Math.random().toString(36).slice(2) + new Date().getTime().toString(36),
          $process_person_profile: false,
          $geoip_disable: true,
          $lib: "green-goods-browser-gate",
          $host: window.location.host,
          surface: surface,
          minimum: options.minimum,
          missing_features: missing,
          language: language,
        },
      };
      try {
        var request = new window.XMLHttpRequest();
        request.open("POST", telemetry.host + "/e/?compression=base64", true);
        request.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
        request.onload = function () {
          if (request.status < 200 || request.status > 299 || !storage) return;
          try {
            storage.setItem(REPORTED_KEY, options.minimum);
          } catch (error) {
            // A browser that cannot store the flag may be counted again on its next visit.
          }
        };
        request.send("data=" + encodeURIComponent(base64(JSON.stringify(event))));
      } catch (error) {
        // Nothing is stored, so the next visit tries again.
      }
    }
  }

  // UTF-8 then base64, as posthog-js encodes a request body.
  function base64(text) {
    return window.btoa(
      encodeURIComponent(text).replace(/%([0-9A-F]{2})/g, function (match, hex) {
        return String.fromCharCode(parseInt(hex, 16));
      })
    );
  }

  // The development hosts the app's analytics also treats as local (posthog-browser.ts).
  function isDevelopmentHost(hostname) {
    var host = String(hostname || "").toLowerCase();
    return (
      host === "localhost" ||
      host.slice(-10) === ".localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host === "::1" ||
      host === "[::1]" ||
      host.slice(-17) === ".trycloudflare.com"
    );
  }
}

var REPORTED_KEY = "gg-browser-update-reported";

// "Green\u00a0Goods" keeps the name on one line.
var COPY = {
  en: {
    title: "Update your browser to use Green\u00a0Goods",
    lede: "Green\u00a0Goods needs a newer version of this browser. Update it, then open Green\u00a0Goods again.",
    ledeLink: "Green\u00a0Goods needs a newer version of this browser. Update it, then open the link again.",
    safe: "What you saved stays on this phone. Keep the app installed and don't clear its data.",
    steps: [
      ["Android", "Update this browser, usually Chrome, from the Play Store."],
      ["iPhone or iPad", "Update iOS in Settings > General > Software Update. Safari updates with it."],
      ["Computer", "Update Chrome, Edge, Firefox or Safari."],
    ],
    minimum: "Green\u00a0Goods works on Chrome and Edge 111, Safari and iOS 16.4, Firefox 128, and newer.",
  },
  es: {
    title: "Actualiza tu navegador para usar Green\u00a0Goods",
    lede: "Green\u00a0Goods necesita una versión más reciente de este navegador. Actualízalo y vuelve a abrir Green\u00a0Goods.",
    ledeLink: "Green\u00a0Goods necesita una versión más reciente de este navegador. Actualízalo y vuelve a abrir el enlace.",
    safe: "Lo que guardaste sigue en este teléfono. Mantén la app instalada y no borres sus datos.",
    steps: [
      ["Android", "Actualiza este navegador, normalmente Chrome, desde Play Store."],
      ["iPhone o iPad", "Actualiza iOS en Ajustes > General > Actualización de software. Safari se actualiza con iOS."],
      ["Computadora", "Actualiza Chrome, Edge, Firefox o Safari."],
    ],
    minimum: "Green\u00a0Goods funciona en Chrome y Edge 111, Safari e iOS 16.4, Firefox 128 y versiones más recientes.",
  },
  pt: {
    title: "Atualize seu navegador para usar o Green\u00a0Goods",
    lede: "O Green\u00a0Goods precisa de uma versão mais recente deste navegador. Atualize-o e abra o Green\u00a0Goods de novo.",
    ledeLink: "O Green\u00a0Goods precisa de uma versão mais recente deste navegador. Atualize-o e abra o link de novo.",
    safe: "O que você salvou continua neste telefone. Mantenha o app instalado e não apague os dados dele.",
    steps: [
      ["Android", "Atualize este navegador, geralmente o Chrome, na Play Store."],
      ["iPhone ou iPad", "Atualize o iOS em Ajustes > Geral > Atualização de Software. O Safari é atualizado junto."],
      ["Computador", "Atualize o Chrome, Edge, Firefox ou Safari."],
    ],
    minimum: "O Green\u00a0Goods funciona no Chrome e Edge 111, Safari e iOS 16.4, Firefox 128 e versões mais recentes.",
  },
};

// Plain CSS the browsers below the minimum can read: no color-mix, range queries, dvh, gap, inset
// or cascade layers. Colors are the Warm Earth values from DESIGN.md as hex, since the app's
// tokens may not resolve on these browsers. Every other element in <body> is hidden, so the
// screen is the whole page for sight and for screen readers.
var STYLES =
  "html[data-browser-update] body > :not(#browser-update) { display: none !important; }" +
  "#browser-update { position: fixed; top: 0; right: 0; bottom: 0; left: 0; z-index: 2147483647;" +
  " display: -webkit-box; display: -webkit-flex; display: flex; -webkit-flex-direction: column; flex-direction: column;" +
  " box-sizing: border-box; margin: 0; padding: 40px 24px;" +
  " padding: calc(40px + env(safe-area-inset-top, 0px)) 24px calc(40px + env(safe-area-inset-bottom, 0px));" +
  " overflow-y: auto; -webkit-overflow-scrolling: touch; background: #faf8f5; color: #292524;" +
  " font-family: 'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;" +
  " font-size: 16px; font-weight: 400; line-height: 24px; text-align: left; letter-spacing: normal; }" +
  "#browser-update[data-surface='signing'] { font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }" +
  "html[data-theme='dark'] #browser-update { background: #110c08; color: #f5f5f4; }" +
  "#browser-update * { box-sizing: border-box; margin: 0; padding: 0; font: inherit; color: inherit; }" +
  "#browser-update .browser-update-content { width: 100%; max-width: 28rem; margin: auto; }" +
  "#browser-update .browser-update-logo { display: block; width: auto; height: 56px; margin-bottom: 32px; }" +
  "#browser-update h1 { font-size: 24px; font-weight: 600; line-height: 32px; }" +
  "#browser-update .browser-update-safe, #browser-update .browser-update-lede { margin-top: 12px; }" +
  "#browser-update .browser-update-safe + .browser-update-lede { margin-top: 8px; }" +
  "#browser-update .browser-update-steps { margin-top: 24px; list-style: none; border-top: 1px solid #e7e5e4; }" +
  "#browser-update .browser-update-steps li { display: block; padding: 12px 0; border-bottom: 1px solid #e7e5e4; }" +
  "#browser-update .browser-update-steps strong { display: block; font-size: 14px; font-weight: 600; line-height: 20px; }" +
  "#browser-update .browser-update-steps span { display: block; }" +
  "#browser-update .browser-update-minimum { margin-top: 24px; font-size: 14px; line-height: 20px; color: #57534e; }" +
  "html[data-theme='dark'] #browser-update .browser-update-steps," +
  " html[data-theme='dark'] #browser-update .browser-update-steps li { border-color: #44403c; }" +
  "html[data-theme='dark'] #browser-update .browser-update-minimum { color: #a8a29e; }";
