import {registerRoute as workbox_routing_registerRoute} from '/Users/afo/Code/greenpill/green-goods/node_modules/.bun/workbox-routing@7.4.0/node_modules/workbox-routing/registerRoute.mjs';
import {CacheableResponsePlugin as workbox_cacheable_response_CacheableResponsePlugin} from '/Users/afo/Code/greenpill/green-goods/node_modules/.bun/workbox-cacheable-response@7.4.0/node_modules/workbox-cacheable-response/CacheableResponsePlugin.mjs';
import {NetworkFirst as workbox_strategies_NetworkFirst} from '/Users/afo/Code/greenpill/green-goods/node_modules/.bun/workbox-strategies@7.4.0/node_modules/workbox-strategies/NetworkFirst.mjs';
import {ExpirationPlugin as workbox_expiration_ExpirationPlugin} from '/Users/afo/Code/greenpill/green-goods/node_modules/.bun/workbox-expiration@7.4.0/node_modules/workbox-expiration/ExpirationPlugin.mjs';
import {CacheFirst as workbox_strategies_CacheFirst} from '/Users/afo/Code/greenpill/green-goods/node_modules/.bun/workbox-strategies@7.4.0/node_modules/workbox-strategies/CacheFirst.mjs';
import {StaleWhileRevalidate as workbox_strategies_StaleWhileRevalidate} from '/Users/afo/Code/greenpill/green-goods/node_modules/.bun/workbox-strategies@7.4.0/node_modules/workbox-strategies/StaleWhileRevalidate.mjs';
import {BackgroundSyncPlugin as workbox_background_sync_BackgroundSyncPlugin} from '/Users/afo/Code/greenpill/green-goods/node_modules/.bun/workbox-background-sync@7.4.0/node_modules/workbox-background-sync/BackgroundSyncPlugin.mjs';
import {NetworkOnly as workbox_strategies_NetworkOnly} from '/Users/afo/Code/greenpill/green-goods/node_modules/.bun/workbox-strategies@7.4.0/node_modules/workbox-strategies/NetworkOnly.mjs';
import {clientsClaim as workbox_core_clientsClaim} from '/Users/afo/Code/greenpill/green-goods/node_modules/.bun/workbox-core@7.4.0/node_modules/workbox-core/clientsClaim.mjs';
import {precacheAndRoute as workbox_precaching_precacheAndRoute} from '/Users/afo/Code/greenpill/green-goods/node_modules/.bun/workbox-precaching@7.4.0/node_modules/workbox-precaching/precacheAndRoute.mjs';
import {cleanupOutdatedCaches as workbox_precaching_cleanupOutdatedCaches} from '/Users/afo/Code/greenpill/green-goods/node_modules/.bun/workbox-precaching@7.4.0/node_modules/workbox-precaching/cleanupOutdatedCaches.mjs';
import {NavigationRoute as workbox_routing_NavigationRoute} from '/Users/afo/Code/greenpill/green-goods/node_modules/.bun/workbox-routing@7.4.0/node_modules/workbox-routing/NavigationRoute.mjs';
import {createHandlerBoundToURL as workbox_precaching_createHandlerBoundToURL} from '/Users/afo/Code/greenpill/green-goods/node_modules/.bun/workbox-precaching@7.4.0/node_modules/workbox-precaching/createHandlerBoundToURL.mjs';/**
 * Welcome to your Workbox-powered service worker!
 *
 * You'll need to register this file in your web app.
 * See https://goo.gl/nhQhGp
 *
 * The rest of the code is auto-generated. Please don't update this file
 * directly; instead, make changes to your Workbox build configuration
 * and re-run your build process.
 * See https://goo.gl/2aRDsh
 */


importScripts(
  "sw-custom.js"
);







self.skipWaiting();

workbox_core_clientsClaim();


/**
 * The precacheAndRoute() method efficiently caches and responds to
 * requests for URLs in the manifest.
 * See https://goo.gl/S9QRab
 */
workbox_precaching_precacheAndRoute([
  {
    "url": "sw-custom.js",
    "revision": "a58c2e8b4c6ed67943be89448af48a3b"
  },
  {
    "url": "staging-maskable-icon-512.png",
    "revision": "ee4f4520b740228e4508797377e73f17"
  },
  {
    "url": "staging-icon.png",
    "revision": "669ba5f8341b05bb0d4206b606bd21c7"
  },
  {
    "url": "staging-icon-512.png",
    "revision": "700c9a88c10111ed0cbb257071155a58"
  },
  {
    "url": "staging-icon-192.png",
    "revision": "f8070c3a035e3fcbcf129d53cd8f41fb"
  },
  {
    "url": "staging-apple-icon.png",
    "revision": "c77b91691be1ebfaf9274b674f21b5f8"
  },
  {
    "url": "social-home-hero.png",
    "revision": "a2126c52abae937dbcc3b02e057dc51f"
  },
  {
    "url": "maskable-icon-512.png",
    "revision": "7a606e411581e332a3e14f5dc776452a"
  },
  {
    "url": "index.html",
    "revision": "8a55c34184200336d33d36838ba400d2"
  },
  {
    "url": "icon.png",
    "revision": "eea566b90085b1ddea533870cefea57c"
  },
  {
    "url": "icon-512.png",
    "revision": "7a606e411581e332a3e14f5dc776452a"
  },
  {
    "url": "icon-192.png",
    "revision": "5999b679e79072b0a72c390d9968187d"
  },
  {
    "url": "favicon.ico",
    "revision": "e0b1f2ad1b246bbaef7278333b7c819a"
  },
  {
    "url": "apple-icon.png",
    "revision": "1a2ec135796a55b50c767a0d388f879d"
  },
  {
    "url": "social/impact.png",
    "revision": "781ab21835abc84d9b774581f3c3a8c1"
  },
  {
    "url": "social/gardens.png",
    "revision": "192d44eaf5a5b2d1a137b3548cf7bbae"
  },
  {
    "url": "social/fund.png",
    "revision": "ac4e0f2917ef4ac07f416fbc4528f1e1"
  },
  {
    "url": "social/cookies.png",
    "revision": "f79219c8af1033030f3f5dfa783877be"
  },
  {
    "url": "social/actions.png",
    "revision": "9348dc7601b80ae3699ce4ebc8db386b"
  },
  {
    "url": "impact/index.html",
    "revision": "50778c1e75216e5fa5a9fcc832e714c3"
  },
  {
    "url": "images/staging-ms-icon-70x70.png",
    "revision": "69e3673ca94cfc96b7122058c0d52253"
  },
  {
    "url": "images/staging-ms-icon-310x310.png",
    "revision": "2b2881933b2abc59be0f0d9799f04f7c"
  },
  {
    "url": "images/staging-ms-icon-144x144.png",
    "revision": "c78eb0900a6c9ed146541abad5a56ee6"
  },
  {
    "url": "images/staging-apple-icon-72x72.png",
    "revision": "1cdd2f2119012184684e0d2e14116d6f"
  },
  {
    "url": "images/staging-apple-icon-60x60.png",
    "revision": "d77f34cf9bab60e95d78107d2825888e"
  },
  {
    "url": "images/staging-apple-icon-57x57.png",
    "revision": "838494a99280c1f77ef9b28fe815b460"
  },
  {
    "url": "images/staging-apple-icon-144x144.png",
    "revision": "c78eb0900a6c9ed146541abad5a56ee6"
  },
  {
    "url": "images/staging-apple-icon-120x120.png",
    "revision": "a073b7ef9e9e35bd113a92dc1f72c3b0"
  },
  {
    "url": "images/staging-android-icon-72x72.png",
    "revision": "1cdd2f2119012184684e0d2e14116d6f"
  },
  {
    "url": "images/staging-android-icon-48x48.png",
    "revision": "b43d84981c8cdfcef3bc1b3006bde338"
  },
  {
    "url": "images/staging-android-icon-36x36.png",
    "revision": "9f336b3c32940287e1720f5e00354a09"
  },
  {
    "url": "images/staging-android-icon-144x144.png",
    "revision": "c78eb0900a6c9ed146541abad5a56ee6"
  },
  {
    "url": "images/no-image-placeholder.png",
    "revision": "19f9f2102aada53c978ba979d61ebdb5"
  },
  {
    "url": "images/ms-icon-70x70.png",
    "revision": "812b7ef14cef448ef369ff7c2e7456ed"
  },
  {
    "url": "images/ms-icon-310x310.png",
    "revision": "e40bd497dd5fe72054c3b299afbf19c5"
  },
  {
    "url": "images/ms-icon-144x144.png",
    "revision": "ddda81acabd75abda2c69f3fe54330ae"
  },
  {
    "url": "images/avatar.png",
    "revision": "8e2c4d70b3986fbffefa4a6c4fbfe7ee"
  },
  {
    "url": "images/apple-icon-72x72.png",
    "revision": "c042c10e65e78f5ebc98b44f85d8ec51"
  },
  {
    "url": "images/apple-icon-60x60.png",
    "revision": "87fcfded6e853400a5b7d2f9a978adb8"
  },
  {
    "url": "images/apple-icon-57x57.png",
    "revision": "d33621b86c12110e104987df66dba1df"
  },
  {
    "url": "images/apple-icon-144x144.png",
    "revision": "ddda81acabd75abda2c69f3fe54330ae"
  },
  {
    "url": "images/apple-icon-120x120.png",
    "revision": "372fa9e0a643432fceedce29f4919315"
  },
  {
    "url": "images/app-mock.png",
    "revision": "8ee204a16a7f03ab062d01c173e1f72c"
  },
  {
    "url": "images/android-icon-72x72.png",
    "revision": "c042c10e65e78f5ebc98b44f85d8ec51"
  },
  {
    "url": "images/android-icon-48x48.png",
    "revision": "19e9e1880ff706c1ec9de1c28ca30991"
  },
  {
    "url": "images/android-icon-36x36.png",
    "revision": "e3b08e4e05d9d193cb73255ebff58d00"
  },
  {
    "url": "images/android-icon-144x144.png",
    "revision": "ddda81acabd75abda2c69f3fe54330ae"
  },
  {
    "url": "gardens/index.html",
    "revision": "7851a396df7fe8b90c115633bd73ef34"
  },
  {
    "url": "fund/index.html",
    "revision": "55069dfd2d9fc6a18e4ceb0c93a4582f"
  },
  {
    "url": "cookies/index.html",
    "revision": "d2961b819ef953ce429891531db01a36"
  },
  {
    "url": "assets/w3m-modal-CSUz7K77.js",
    "revision": null
  },
  {
    "url": "assets/vaults-JPEywXKx.js",
    "revision": null
  },
  {
    "url": "assets/useVaultPreview-S0xEUjYL.js",
    "revision": null
  },
  {
    "url": "assets/useVaultDeposit-CeB6NdOm.js",
    "revision": null
  },
  {
    "url": "assets/useTxErrorMessages-BQkzKO4F.js",
    "revision": null
  },
  {
    "url": "assets/useServiceWorkerUpdate-DZ23nw0t.js",
    "revision": null
  },
  {
    "url": "assets/useReadContracts-D01MAPKs.js",
    "revision": null
  },
  {
    "url": "assets/useReadContract-CJpagCy4.js",
    "revision": null
  },
  {
    "url": "assets/usePublicGardens-B-YptEs5.js",
    "revision": null
  },
  {
    "url": "assets/useProtocolMemberStatus-E6AkBZa_.js",
    "revision": null
  },
  {
    "url": "assets/useMyWorks-BAuBL-kZ.js",
    "revision": null
  },
  {
    "url": "assets/useMyVaultDeposits-DykqRgVj.js",
    "revision": null
  },
  {
    "url": "assets/useInstallGuidance-DAfFuklg.js",
    "revision": null
  },
  {
    "url": "assets/useInViewReveal-C-B0Wycj.js",
    "revision": null
  },
  {
    "url": "assets/useGreenGoodsEnsName-C8gATsae.js",
    "revision": null
  },
  {
    "url": "assets/useGardenPermissions-6JDMVPol.js",
    "revision": null
  },
  {
    "url": "assets/useFocusTrap-CgtVUcL4.js",
    "revision": null
  },
  {
    "url": "assets/useEthUsdPrice-Bfnva4cY.js",
    "revision": null
  },
  {
    "url": "assets/useDrafts-BC9RzlH8.js",
    "revision": null
  },
  {
    "url": "assets/useDebouncedValue-CEI7CuGq.js",
    "revision": null
  },
  {
    "url": "assets/useCookieJarWithdraw-F8ujoF-4.js",
    "revision": null
  },
  {
    "url": "assets/useContractTxSender-BKgR8Uf-.js",
    "revision": null
  },
  {
    "url": "assets/useChainId-CnmBEw3E.js",
    "revision": null
  },
  {
    "url": "assets/useChainConfig-DklA_Lrj.js",
    "revision": null
  },
  {
    "url": "assets/useBalance-B50OFStX.js",
    "revision": null
  },
  {
    "url": "assets/tx-error-classifier-BR3ErzJ2.js",
    "revision": null
  },
  {
    "url": "assets/transactions-C7f0gFbx.js",
    "revision": null
  },
  {
    "url": "assets/tags-DQHDvbi8.js",
    "revision": null
  },
  {
    "url": "assets/swaps-O4FaWrzY.js",
    "revision": null
  },
  {
    "url": "assets/socials-pFxHux_i.js",
    "revision": null
  },
  {
    "url": "assets/send-DgHIFtm8.js",
    "revision": null
  },
  {
    "url": "assets/receive-Ct-BmFJ0.js",
    "revision": null
  },
  {
    "url": "assets/receipt-token-DzdxhS_f.js",
    "revision": null
  },
  {
    "url": "assets/readContract-BU4XQWbu.js",
    "revision": null
  },
  {
    "url": "assets/pwaStatusStyles-vm3g7e-_.js",
    "revision": null
  },
  {
    "url": "assets/property-CnFDNXw5.js",
    "revision": null
  },
  {
    "url": "assets/pay-with-exchange-Dlioptuz.js",
    "revision": null
  },
  {
    "url": "assets/onramp-Dou_hstF.js",
    "revision": null
  },
  {
    "url": "assets/octant-CoMYMz49.js",
    "revision": null
  },
  {
    "url": "assets/native-CJ5et6AR.js",
    "revision": null
  },
  {
    "url": "assets/index-ki7nLvCQ.js",
    "revision": null
  },
  {
    "url": "assets/index-kfGiwMqO.js",
    "revision": null
  },
  {
    "url": "assets/index-_4lxXPSr.js",
    "revision": null
  },
  {
    "url": "assets/index-ZoehqcW3.js",
    "revision": null
  },
  {
    "url": "assets/index-RX1SsTEu.js",
    "revision": null
  },
  {
    "url": "assets/index-DzhZa5RJ.js",
    "revision": null
  },
  {
    "url": "assets/index-DaAD3Bbc.js",
    "revision": null
  },
  {
    "url": "assets/index-DEw9JOtF.js",
    "revision": null
  },
  {
    "url": "assets/index-CySRAkZb.js",
    "revision": null
  },
  {
    "url": "assets/index-CsvifhpW.css",
    "revision": null
  },
  {
    "url": "assets/index-CrwjLBEw.js",
    "revision": null
  },
  {
    "url": "assets/index-CcCcawC3.js",
    "revision": null
  },
  {
    "url": "assets/index-BzOikiTK.js",
    "revision": null
  },
  {
    "url": "assets/index-BrVcukvQ.js",
    "revision": null
  },
  {
    "url": "assets/index-Bpd87Qcp.js",
    "revision": null
  },
  {
    "url": "assets/index-BFeXAr9P.js",
    "revision": null
  },
  {
    "url": "assets/index-BD2HRjpd.js",
    "revision": null
  },
  {
    "url": "assets/index-B42Mxjcp.js",
    "revision": null
  },
  {
    "url": "assets/hypercerts-fetch-DzxVUeH2.js",
    "revision": null
  },
  {
    "url": "assets/hypercerts-attestations-Bd4irEg1.js",
    "revision": null
  },
  {
    "url": "assets/features-CjgOhrKP.js",
    "revision": null
  },
  {
    "url": "assets/embedded-wallet-DauJkGE4.js",
    "revision": null
  },
  {
    "url": "assets/email-CA5KzdDu.js",
    "revision": null
  },
  {
    "url": "assets/eas-CQZn9uh2.js",
    "revision": null
  },
  {
    "url": "assets/data-capture-DcMyz9pf.js",
    "revision": null
  },
  {
    "url": "assets/clipboard-BT9uvZV2.js",
    "revision": null
  },
  {
    "url": "assets/ccip-DdlYT_wB.js",
    "revision": null
  },
  {
    "url": "assets/app-BjOg3Zsu.js",
    "revision": null
  },
  {
    "url": "assets/WorkView-CN0bJzhl.js",
    "revision": null
  },
  {
    "url": "assets/Work-WOhH_QSd.js",
    "revision": null
  },
  {
    "url": "assets/Work-D4CSMYRd.js",
    "revision": null
  },
  {
    "url": "assets/WalletRuntimeProviders-DIAsM2Zq.js",
    "revision": null
  },
  {
    "url": "assets/Vaults-CHCm2esT.js",
    "revision": null
  },
  {
    "url": "assets/TopNav-BM4G9BPN.js",
    "revision": null
  },
  {
    "url": "assets/SwapController-DnITlUDE.js",
    "revision": null
  },
  {
    "url": "assets/StandardTabs-D1m5PEgY.js",
    "revision": null
  },
  {
    "url": "assets/Root-dkPjn97V.js",
    "revision": null
  },
  {
    "url": "assets/RequireAuth-CLSS4PGq.js",
    "revision": null
  },
  {
    "url": "assets/PwaRuntime-39D3912l.js",
    "revision": null
  },
  {
    "url": "assets/PublicShell--h1H4ChF.js",
    "revision": null
  },
  {
    "url": "assets/PublicInstallAction-BTBsIIAl.js",
    "revision": null
  },
  {
    "url": "assets/PublicGardenCard-BwUGCagA.js",
    "revision": null
  },
  {
    "url": "assets/PublicFundingCard-BAfLBogp.js",
    "revision": null
  },
  {
    "url": "assets/PublicFooter-CV0UEoAC.js",
    "revision": null
  },
  {
    "url": "assets/PhX-C3b4cCEy.js",
    "revision": null
  },
  {
    "url": "assets/PhWarningCircle-Cm58gXb9.js",
    "revision": null
  },
  {
    "url": "assets/PhWarning-CpkID9oi.js",
    "revision": null
  },
  {
    "url": "assets/PhWallet-WVAuHGpA.js",
    "revision": null
  },
  {
    "url": "assets/PhVault-B8m1usHw.js",
    "revision": null
  },
  {
    "url": "assets/PhUser-A2fxqIV0.js",
    "revision": null
  },
  {
    "url": "assets/PhTrash-BamrmMsN.js",
    "revision": null
  },
  {
    "url": "assets/PhSpinner-CZMtAFdX.js",
    "revision": null
  },
  {
    "url": "assets/PhSignOut-Cq2PivQ6.js",
    "revision": null
  },
  {
    "url": "assets/PhSealCheck-BeVLq9PH.js",
    "revision": null
  },
  {
    "url": "assets/PhQuestionMark-W55Txvvb.js",
    "revision": null
  },
  {
    "url": "assets/PhQuestion-rUoqC2sC.js",
    "revision": null
  },
  {
    "url": "assets/PhQrCode-uIXlI5ER.js",
    "revision": null
  },
  {
    "url": "assets/PhPuzzlePiece-C-7mYqGO.js",
    "revision": null
  },
  {
    "url": "assets/PhPower-D8-AcNM6.js",
    "revision": null
  },
  {
    "url": "assets/PhPlus-CBvZvLax.js",
    "revision": null
  },
  {
    "url": "assets/PhPaperPlaneRight-Dvo-nXr9.js",
    "revision": null
  },
  {
    "url": "assets/PhMagnifyingGlass-B6D0sWFL.js",
    "revision": null
  },
  {
    "url": "assets/PhLightbulb-DMZJsowR.js",
    "revision": null
  },
  {
    "url": "assets/PhInfo-X33f06Ej.js",
    "revision": null
  },
  {
    "url": "assets/PhImage-BYrKfN9k.js",
    "revision": null
  },
  {
    "url": "assets/PhIdentificationCard-BeLXJpfZ.js",
    "revision": null
  },
  {
    "url": "assets/PhGlobe-q1mqj65V.js",
    "revision": null
  },
  {
    "url": "assets/PhFunnelSimple-DKx35ITq.js",
    "revision": null
  },
  {
    "url": "assets/PhEnvelope-SmaNeXoQ.js",
    "revision": null
  },
  {
    "url": "assets/PhDotsThree-CSAEcba1.js",
    "revision": null
  },
  {
    "url": "assets/PhDeviceMobile-CnybhXY-.js",
    "revision": null
  },
  {
    "url": "assets/PhDesktop-BuCDXYJj.js",
    "revision": null
  },
  {
    "url": "assets/PhCurrencyDollar-B6IKKjue.js",
    "revision": null
  },
  {
    "url": "assets/PhCreditCard-CZpdid2n.js",
    "revision": null
  },
  {
    "url": "assets/PhCopy-rgttky8E.js",
    "revision": null
  },
  {
    "url": "assets/PhCompass-Df1ugFO-.js",
    "revision": null
  },
  {
    "url": "assets/PhClock-Sj17weCB.js",
    "revision": null
  },
  {
    "url": "assets/PhCircleHalf-Bk9C4DvT.js",
    "revision": null
  },
  {
    "url": "assets/PhCheck-DrKd7pBC.js",
    "revision": null
  },
  {
    "url": "assets/PhCaretUp-BG10nSut.js",
    "revision": null
  },
  {
    "url": "assets/PhCaretRight-BY8D5MIg.js",
    "revision": null
  },
  {
    "url": "assets/PhCaretLeft-B7YLoNEF.js",
    "revision": null
  },
  {
    "url": "assets/PhCaretDown-ddSjwcwm.js",
    "revision": null
  },
  {
    "url": "assets/PhBrowser-BjzAmrHO.js",
    "revision": null
  },
  {
    "url": "assets/PhBank-hhPAIPVb.js",
    "revision": null
  },
  {
    "url": "assets/PhArrowsLeftRight-CYsRQ2qh.js",
    "revision": null
  },
  {
    "url": "assets/PhArrowsDownUp-PZosTqZG.js",
    "revision": null
  },
  {
    "url": "assets/PhArrowsClockwise-Brtx2Re-.js",
    "revision": null
  },
  {
    "url": "assets/PhArrowUpRight-Bn-JhHsY.js",
    "revision": null
  },
  {
    "url": "assets/PhArrowUp-izKvURUW.js",
    "revision": null
  },
  {
    "url": "assets/PhArrowSquareOut-DnQ7n_B4.js",
    "revision": null
  },
  {
    "url": "assets/PhArrowRight-BI-V03Xf.js",
    "revision": null
  },
  {
    "url": "assets/PhArrowLeft-C0jlxVhM.js",
    "revision": null
  },
  {
    "url": "assets/PhArrowDown-CkoOD89h.js",
    "revision": null
  },
  {
    "url": "assets/PhArrowClockwise-mOiWYLMV.js",
    "revision": null
  },
  {
    "url": "assets/PhArrowCircleDown-BtlNV0TZ.js",
    "revision": null
  },
  {
    "url": "assets/ModalDrawer-QXQ3pDod.js",
    "revision": null
  },
  {
    "url": "assets/Impact-gYyMV8bC.js",
    "revision": null
  },
  {
    "url": "assets/Home-DHOr_Zmj.js",
    "revision": null
  },
  {
    "url": "assets/Glossary-DWHK4l19.js",
    "revision": null
  },
  {
    "url": "assets/Gardens-DXV1lZmH.js",
    "revision": null
  },
  {
    "url": "assets/GardenDialog-CmfzZXoE.js",
    "revision": null
  },
  {
    "url": "assets/GardenCoverFallback-Bb_aW4qe.js",
    "revision": null
  },
  {
    "url": "assets/GardenCardSkeleton-C80Nkpq_.js",
    "revision": null
  },
  {
    "url": "assets/GardenCard-BM1d6ljt.js",
    "revision": null
  },
  {
    "url": "assets/Fund-Dh1tZy5o.js",
    "revision": null
  },
  {
    "url": "assets/EditorialReadDeeper-DdtpXANi.js",
    "revision": null
  },
  {
    "url": "assets/Cookies-CCWGmc5H.js",
    "revision": null
  },
  {
    "url": "assets/ConfirmDialog-Be8V2qdE.js",
    "revision": null
  },
  {
    "url": "assets/Carousel-B52FFn6M.js",
    "revision": null
  },
  {
    "url": "assets/Assessment-DPWbEpQZ.js",
    "revision": null
  },
  {
    "url": "assets/AppShell-DXiINCEf.js",
    "revision": null
  },
  {
    "url": "assets/Actions-1wIH6AJY.js",
    "revision": null
  },
  {
    "url": "actions/index.html",
    "revision": "8826c50e8f4aba9e4a8669b72c3685f9"
  },
  {
    "url": "apple-icon.png",
    "revision": "1a2ec135796a55b50c767a0d388f879d"
  },
  {
    "url": "favicon.ico",
    "revision": "e0b1f2ad1b246bbaef7278333b7c819a"
  },
  {
    "url": "icon-192.png",
    "revision": "5999b679e79072b0a72c390d9968187d"
  },
  {
    "url": "icon-512.png",
    "revision": "7a606e411581e332a3e14f5dc776452a"
  },
  {
    "url": "icon.png",
    "revision": "eea566b90085b1ddea533870cefea57c"
  },
  {
    "url": "maskable-icon-512.png",
    "revision": "7a606e411581e332a3e14f5dc776452a"
  },
  {
    "url": "images/android-icon-144x144.png",
    "revision": "ddda81acabd75abda2c69f3fe54330ae"
  },
  {
    "url": "images/android-icon-36x36.png",
    "revision": "e3b08e4e05d9d193cb73255ebff58d00"
  },
  {
    "url": "images/android-icon-48x48.png",
    "revision": "19e9e1880ff706c1ec9de1c28ca30991"
  },
  {
    "url": "images/android-icon-72x72.png",
    "revision": "c042c10e65e78f5ebc98b44f85d8ec51"
  },
  {
    "url": "images/apple-icon-120x120.png",
    "revision": "372fa9e0a643432fceedce29f4919315"
  },
  {
    "url": "images/apple-icon-144x144.png",
    "revision": "ddda81acabd75abda2c69f3fe54330ae"
  },
  {
    "url": "images/apple-icon-57x57.png",
    "revision": "d33621b86c12110e104987df66dba1df"
  },
  {
    "url": "images/apple-icon-60x60.png",
    "revision": "87fcfded6e853400a5b7d2f9a978adb8"
  },
  {
    "url": "images/apple-icon-72x72.png",
    "revision": "c042c10e65e78f5ebc98b44f85d8ec51"
  },
  {
    "url": "images/ms-icon-144x144.png",
    "revision": "ddda81acabd75abda2c69f3fe54330ae"
  },
  {
    "url": "images/ms-icon-310x310.png",
    "revision": "e40bd497dd5fe72054c3b299afbf19c5"
  },
  {
    "url": "images/ms-icon-70x70.png",
    "revision": "812b7ef14cef448ef369ff7c2e7456ed"
  },
  {
    "url": "manifest.webmanifest",
    "revision": "7c34f94b80650acfdbb18a30069851c6"
  }
], {});
workbox_precaching_cleanupOutdatedCaches();
workbox_routing_registerRoute(new workbox_routing_NavigationRoute(workbox_precaching_createHandlerBoundToURL("index.html"), {
  
  denylist: [/^\/$/,/^\/actions(?:[?#].*)?$/,/^\/cookies(?:[?#].*)?$/,/^\/fund(?:[?#].*)?$/,/^\/gardens(?:\/.*)?(?:[?#].*)?$/,/^\/glossary(?:[?#].*)?$/,/^\/impact(?:[?#].*)?$/],
}));


workbox_routing_registerRoute(/^\/.*\.js$/, new workbox_strategies_NetworkFirst({ "cacheName":"js-cache","networkTimeoutSeconds":3, plugins: [new workbox_cacheable_response_CacheableResponsePlugin({ statuses: [ 0, 200 ] })] }), 'GET');
workbox_routing_registerRoute(/.*\.(png|jpg|jpeg|svg|gif|webp)$/, new workbox_strategies_CacheFirst({ "cacheName":"image-cache", plugins: [new workbox_expiration_ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 2592000 }), new workbox_cacheable_response_CacheableResponsePlugin({ statuses: [ 0, 200 ] })] }), 'GET');
workbox_routing_registerRoute(/https:\/\/(greengoods\.mypinata\.cloud|gateway\.pinata\.cloud|ipfs\.io)\/ipfs\/.+/, new workbox_strategies_CacheFirst({ "cacheName":"ipfs-cache", plugins: [new workbox_expiration_ExpirationPlugin({ maxEntries: 500, maxAgeSeconds: 31536000 }), new workbox_cacheable_response_CacheableResponsePlugin({ statuses: [ 0, 200 ] })] }), 'GET');
workbox_routing_registerRoute(/indexer\.hyperindex\.xyz|localhost:3006/, new workbox_strategies_StaleWhileRevalidate({ "cacheName":"indexer-cache", plugins: [new workbox_expiration_ExpirationPlugin({ maxAgeSeconds: 86400, maxEntries: 100 }), new workbox_cacheable_response_CacheableResponsePlugin({ statuses: [ 0, 200 ] })] }), 'GET');
workbox_routing_registerRoute(/graphql/, new workbox_strategies_StaleWhileRevalidate({ "cacheName":"graphql-cache", plugins: [new workbox_expiration_ExpirationPlugin({ maxAgeSeconds: 86400, maxEntries: 100 }), new workbox_cacheable_response_CacheableResponsePlugin({ statuses: [ 0, 200 ] })] }), 'GET');
workbox_routing_registerRoute(/\/users\/me$/, new workbox_strategies_NetworkOnly({ plugins: [new workbox_background_sync_BackgroundSyncPlugin("gg-api-queue", { maxRetentionTime: 1440 })] }), 'POST');




self.__WB_DISABLE_DEV_LOGS = true;