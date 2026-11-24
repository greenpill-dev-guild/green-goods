# Purchasable sensors and browser configuration for Green Goods OS

**Checked:** 9 October 2026 Pacific. **Status:** procurement research and proposed experience, not a supported-product catalog.

The strongest initial off-the-shelf land-monitoring candidate is Ecowitt's local web/API ecosystem. A GW3000 receiver plus one WH51 soil probe is listed at **US$72.98 before additional items and country-dependent charges**. The receiver can retain CSV records on a microSD card while the laptop is closed. RuuviTag is the stronger direct-Bluetooth candidate for air temperature/humidity with local history, but it does not measure soil moisture. Neither has a tested Green Goods adapter.

**DIY/OEM follow-up:** a pre-soldered XIAO/Grove soil-sensing core totals **US$16.48**, before power, enclosure and other essentials. LILYGO's integrated T-Higrow BME280 kit was listed at **US$13.01** during live supplier inspection. These are development candidates with unresolved field/logging behavior. Seeed, Fine Offset/Ecowitt, Makerfabs and Dragino document customization or manufacturing services; no Green Goods agreement, approved branded model or wholesale quote exists. See [DIY options](#diy-assembly-options) and [branding routes](#white-label-oem-and-manufacturing-options).

This follows the [local architecture](architecture.md). The user requested accessible products that can be bought, placed and configured through a browser. No purchase, device access, firmware change, software implementation, vendor contact or external processing of private records has occurred.

## Scope and evidence quality

The user selected the **United States, Nigeria, Brazil and South Africa** for the purchasing comparison. Use a small garden or nursery as the provisional environment. Total budget, power/network availability and the first buyer remain unresolved. These countries define research coverage, not four simultaneous pilots or a change to the synthetic prototype in the [PRD](spec.md).

Prices are observed manufacturer listings, in their original currencies. They are not landed quotes, guaranteed stock, discounts, validated affordability or sales economics. Shipping, tax/imports, batteries, power, mounting and support can change the result. Do not infer universal affordability from a US-dollar price.

Labels: **E** established in primary documentation; **I** proposed Green Goods integration or recommendation; **U** unresolved without a named-device test; **C** correction to a tempting but unsupported assumption. Manufacturer specifications are not independent accuracy, field reliability or browser proof.

## Define a complete kit by its question

Candidate question: **Which growing areas need a manual moisture check, and what local conditions help explain the change?** Start with moisture readings plus notes. Ambient temperature/humidity can add context, provided the sensor is located in the relevant environment. A gateway's indoor probe does not automatically represent outdoor beds.

For that question, a practical package needs the chosen probes, a compatible collection interface, continuous logging where required, batteries/power, mounting/protection, installation labels, a placement/reference-check guide and a recoverable export. Rainfall or light can be added when needed. Air pollution and appliance energy are separate questions; one universal box is unlikely to provide a useful, calibrated record of every environmental condition.

Treat the WH51's reported percentage as a sensor-relative moisture measure unless an appropriate substrate-specific method establishes volumetric water content. Preserve raw/calibration context. Do not translate it automatically into irrigation quantities, soil health, carbon or verified regeneration. Calibration UI availability is not proof of scientific calibration.

## Shortlist

| Product / configuration | Observed listing | What it measures | Local access and practical limitation |
|---|---|---|---|
| Ecowitt GW1206: GW1200 + one WH51 | **US$48.99** | Soil moisture; gateway also has indoor temperature/humidity/pressure sensing | E: supplied receiver, local WebUI and generic HTTP API. U: independent local history was not established for this cheaper model; cloud history must not be presented as local logging. H01/H04/H06 |
| Ecowitt GW3000 + one WH51 | **US$54.99 + US$17.99 = US$72.98** | Soil moisture plus the gateway's indoor ambient sensing | E: microSD CSV storage, local WebUI/downloads and HTTP API. Card, power adapter and sensor AA battery are additional. I: best first local-history land candidate. H02/H03/H05/H06 |
| RuuviTag | **EUR39.90 base listing per tag** | Temperature, humidity, pressure and motion | E: battery included, local history, documented GATT/NUS history protocol. I: direct Web Bluetooth adapter. U: Green Goods browser interoperability; iOS Safari lacks Web Bluetooth. No soil probe. H08/H09 |
| SensorPush HT.w | **US$69.99 advertised** | Temperature/humidity | E: native-app local use; public second-generation BLE protocol for current readings. U: exact SKU/firmware compatibility and browser history retrieval. Do not choose HT1 assuming the same open protocol. H10/H11 |
| AirGradient Open Air, assembled O-1PST | **US$225** | Particles, CO2, VOC/NOx indices and temperature/humidity channels | E: Wi-Fi setup portal, local HTTP read/configuration API, server-connection opt-out. Power plug additional. I: good browser-facing air-monitoring reference; not the initial soil kit. H12/H13/H14 |
| Shelly Plug US Gen4 | **US$24.99** | Appliance power/energy, additional device channels | E: embedded WebUI and local RPC ecosystem. US 120 V variant; choose a locally appropriate certified model. I: later read-only energy example, not a soil sensor or whole-site meter. H15/H16 |
| SenseCAP S2105 | **US$146 sensor only** | Soil moisture, temperature and EC | E: LoRaWAN and BLE/app configuration. U: direct browser measurement interface was not established; radio/network infrastructure adds cost. Defer for the node-free starting workflow. H17 |

All rows describe possible procurement candidates. **No product is currently certified as working with Green Goods OS.** Live browser collection, firmware compatibility, security and offline recovery were not tested.

## Costed land configurations

These are arithmetic comparisons of named parts, not complete quotes. Use the same compatible regional radio variant throughout.

| Configuration | Calculation | Parts subtotal | Missing cost / behavior |
|---|---|---|---|
| Cheapest single-bed kit | GW1206 listing | **US$48.99** | AA battery, USB power and shipping/tax; offline history gate unresolved |
| Cheapest three-bed kit | US$48.99 + 2 × US$17.99 | **US$84.97** | Same missing items; extra probes do not add a local archive |
| One bed with local archive | US$54.99 + US$17.99 | **US$72.98** | Suitable formatted microSD, USB power adapter, AA battery and shipping/tax |
| Three beds with local archive | US$54.99 + 3 × US$17.99 | **US$108.96** | microSD, power, three AA batteries, placement/mounting and shipping/tax |

A Green Goods package would need to include the missing essentials rather than leave the participant to assemble a shopping list. Reuse an existing suitable power adapter only after checking the model's requirements. Wattage printed on a power supply is not measured sensor energy consumption. No comparative total-cost or support-margin claim is established.

Sources for each priced part: H01–H03. Local archive behavior: H05. These US-dollar calculations use the selected North American 915 MHz listings, not quotations for the other three countries. Manufacturer radio-region descriptions are leads; the exact compliant variant must be checked before procurement.

## Purchasing in the four selected countries

The same observation schema can support different regional hardware bundles. Do not ship a US radio or electrical variant everywhere because it appears on an international marketplace. Receiver and probes must share a supported frequency; local approvals, power supplies, replacement stock and warranty support need confirmation for the exact model.

| Country | Established purchasing evidence | Gap before a kit recommendation |
|---|---|---|
| United States | Ecowitt advertises a US warehouse for selected 915 MHz products. Ruuvi lists US shipping options. H20/H21 | Confirm this exact kit's stock, delivered price, markings and complete accessories; a warehouse banner does not verify every SKU |
| Nigeria | Ruuvi explicitly includes Nigeria in its special-destination shipping group. A Ubuy Nigeria Ecowitt listing describes US import, rather than verified local stock. H20/H27 | Exact radio/model approval, direct delivery or local distributor, returns and landed price unresolved; NCC includes IoT and short-range devices in its approval guidance. H22 |
| Brazil | Ruuvi's special-destination group includes South American countries. Instrufiber catalogs an Ecowitt-branded weather system by quotation, a sourcing lead rather than the proposed small soil kit. H20/H25 | Exact soil-kit availability, Portuguese setup/support, model homologation and landed price unresolved; ANATEL recommends checking the model and marking before import. H23 |
| South Africa | Ruuvi explicitly lists South Africa in the special-destination group. Ecotao catalogs Ecowitt-compatible 433 MHz weather systems and WH51 add-ons. H20/H26 | No confirmed GW3000-plus-WH51 local quote or exact approval record; verify model authorization or applicable exemption with the supplier and ICASA. H24 |

Ruuvi lists **EUR39.90 per order** for those special destinations. One EUR39.90 tag therefore gives an illustrative **EUR79.80 product-plus-listed-shipping subtotal**, before import charges and any checkout differences. The free-shipping threshold is limited to eligible tracked-mail countries; it should not be assumed for these three destinations. A shared order may spread freight across tags, but delivery, duties and local support still need checking. H08/H20.

Ecowitt advertises global delivery from China, the US or Germany according to stock, with shipping calculated at checkout. This is a manufacturer policy, not a verified country-specific order or delivered price. Its broad frequency guide does not establish regulatory clearance for Nigeria, Brazil or South Africa. H21.

The local catalogs above are leads, not supplier relationships or evidence of Green Goods compatibility. No price from a comparison site, stale delivery estimate or marketplace-generated review is carried into the cost model. AirGradient's delivery and local support in these countries remain unverified. The Shelly US plug is not the shared four-country energy kit.

**Architecture implication:** favor stock devices with documented local interfaces and regional sourcing options. Measure affordability as the delivered, working kit plus maintenance and support. Local assembly or distribution could help, but its economics, rights and reliability remain hypotheses.

## What browser configuration can do

Four operations should be distinguished:

1. **Connection:** identify the intended device, join its setup network through the OS or grant selected Bluetooth access.
2. **Installation metadata:** name the bed, describe placement/depth/substrate, choose units, record maintenance and set Green Goods review rules. These can live in the workspace without changing firmware.
3. **Device settings:** change only parameters the vendor's named firmware exposes, such as Wi-Fi, supported calibration settings or cloud-upload controls. Read back and verify the result.
4. **Collection:** retrieve readings/history, preserve the original response and ingest it under a supported schema. A BLE configuration interface does not necessarily expose measurement/history data.

Wi-Fi joining happens through the phone/laptop operating system. An ordinary web page cannot silently switch the user's network. Use a guided transition and preserve progress while the user leaves the app. A sensor's local web portal may be a different origin from the Green Goods PWA.

### Ecowitt: the most practical first land path

**Established:** the GW3000 manual describes activating its setup hotspot, opening `192.168.4.1` in a browser and using Local Network to configure Wi-Fi. Its SD-card section documents local CSV storage. Its default cloud upload needs attention during privacy setup. The receiver needs continuous power, but is a packaged sensor receiver rather than a community computer. H05.

The generic LAN API documents `GET /get_livedata_info`, network configuration, sensor management and soil calibration interfaces. Live data includes `ch_soil`. These are protocol facts, not proof that every response works on every firmware. The document filename/portal identify version 1.0.6 dated January 2026, while one internal changelog date appears inconsistent. Pin the actual version/device response during a later test. H06.

**Proposed Green Goods experience:**

1. Choose the supported kit and identify the receiver/probes from their labels.
2. Power the receiver and insert the batteries. Attach the supplied antenna where required.
3. Follow the vendor setup portal, set an appropriate password and choose the intended local network. A hotspot-only collection path is another test candidate; its availability window is limited.
4. Configure privacy before collecting private records. Verify cloud/server traffic is disabled as intended; default settings are not a sovereignty guarantee.
5. Add the receiver's local address to Green Goods and grant access only to that intended device.
6. Read firmware and sensor identities. Map each probe to a named growing area, confirm a reference reading and record placement.
7. For GW3000, confirm the card is usable and retrieve a small saved CSV. Preserve the original bytes and map its timestamps/units to the observation schema.
8. Close the laptop, collect on the device, then reconnect with internet unavailable and verify the missing period is recovered.

Stock WebUI setup exists today. The Green Goods wizard, adapter, private ingestion, calibration history and failure UI above are **proposed**. A direct phone PWA request still faces CORS, secure-origin and local-network permission constraints. The laptop extension can use scoped host permissions; vendor WebUI download plus file import is a fallback.

Continuous sensor recording on the GW3000 is the advantage of this configuration. A useful low-hardware-cost receiver is still a hardware dependency. If the user requires absolutely no separate receiver, use a directly accessible logger instead and narrow the measurement question.

Local API collection also needs a reachable local network. An existing router or an OS-provided phone/laptop hotspot is a candidate; internet access and a local Wi-Fi network are different requirements. The receiver's short setup hotspot is not proven to be a persistent three-device network. Test hotspot peer access, address discovery and reconnection before claiming that phone, laptop and this kit need no other network hardware. The SD archive can preserve records while the collection interface is unavailable, subject to power and clock tests.

### Ruuvi: direct logger without a receiver

The RuuviTag product listing describes an included battery and ten days of temperature/humidity/pressure history at five-minute intervals. The vendor's production NUS protocol documents history reads and resumption. A proposed browser adapter would request the documented service, subscribe, read a bounded history interval and reconcile duplicate records. H08/H09.

The stock user experience is Ruuvi Station on Android/iOS. The official 2017 browser article describes an experimental demonstration; it is not evidence of a current ready-made browser app. Green Goods labels/thresholds can be local workspace settings. Do not promise arbitrary sampling or calibration changes to the tag without a supported write protocol.

This is a promising greenhouse/ambient continuity path. It remains conditional on GATT connection behavior, firmware, browser permissions, time handling and retrieval tests. On iPhone, native-app export or an optional bridge is needed until a direct compatible browser path is established.

### AirGradient: strongest all-in-one local HTTP example

Open Air is an assembled air-monitoring device, not a land-soil kit. Its local API exposes `/measures/current` and `/config`; GET/PUT settings include configuration authority and cloud-posting controls. `disableCloudConnection` is set from its Wi-Fi setup page and disables vendor requests, including automatic updates. `offlineMode` disables network operation, so it must not be confused with keeping the LAN active while preventing cloud traffic. H13.

Its setup support article describes the hotspot/browser process and a server-connection opt-out but also lists active internet among Wi-Fi requirements. Treat fully disconnected commissioning as unresolved, even though subsequent local read/configuration is documented. History retention while the laptop is closed was not established from the inspected endpoints. H14.

The assembled price excludes a power plug. The DIY version is advertised at US$125 with different warranty/testing terms; it is not equivalent to the assembled buy-and-place experience. H12. Neither is an agronomic sensor, and gas indices should not be portrayed as definitive pollutant concentrations or certified health/outcome evidence.

### Shelly: later energy configuration example

The US Gen4 plug has an embedded web interface, power metering and a local component/RPC API. Cloud connectivity is configurable in its documented Cloud component. A future adapter can read device status locally; no MQTT broker is necessary for that request/response path. H16.

This is a separate energy hypothesis: one compatible appliance, with the manufacturer's installation/load limits and a region-appropriate model. Start with read-only collection. Relay automation, switching pumps and whole-site electrical installation are outside this proposed land workflow.

## Local transport and sensor trust

Local access is not automatically authenticated or encrypted. Record the named firmware's API authentication and cloud defaults, protect configuration access and restrict the adapter to the intended receiver. Do not expose its settings through a public relay. A broadcast sensor ID is metadata, not proof of cryptographic device identity; radio authentication, replay handling and tamper detection remain unverified for the shortlisted soil path.

Preserve sensor time and receipt time, original units, placement, reference checks and missing readings. Distinguish a flat reading from a disconnected probe. Validate bounded payloads before storage or AI use; text from devices remains data, not instructions. Human review is required for interpretation and publication. These devices do not verify an ecological outcome, authorize irrigation or establish a public funding claim.

## Corrections and rejected shortcuts

- **Pimoroni Enviro Grow:** cached regional search material presents an appealing three-probe kit with browser provisioning. The current canonical product page says it is no longer stocked. Treat it as a design/firmware reference, not a readily purchasable recommendation. H18.
- **SensorPush HT1:** the manufacturer's public BLE protocol explicitly excludes this first-generation device. Second-generation documentation establishes current reading access, not complete browser history/configuration parity with the native app. H10.
- **SenseCAP BLE:** documented BLE configuration does not establish BLE measurement retrieval. LoRaWAN connectivity is not browser connectivity, and sensor-only pricing is not kit cost. H17.
- **Ecowitt current data:** a low-cost receiver with live readings is not automatically an independent logger. Do not substitute cloud history for local records. H04/H05.
- **AirGradient cloud pricing:** inspected pages contain differing subscription-free and municipal paid-dashboard descriptions. Do not carry either as a guaranteed service quote. The proposed local API path avoids selecting a hosted service, subject to device tests. H12/H19.
- **Commodity multi-sensor claims:** purchasing more channels does not establish calibration, useful placement, data access or verified impact. Define one question and a reference-check process first.

## Proposed complete Green Goods kit

For the first land test, investigate a single purchase package containing a regional GW3000, one or three WH51 probes according to the question, a preformatted microSD card, suitable power supply, included sensor batteries, mounts/labels and a concise placement guide. Add an outdoor ambient probe only if indoor gateway readings do not represent the question. Its price is not estimated here.

Use vendor firmware and documented APIs first. A supported-kit registry would record SKU/revision, firmware, radio variant, measurement definitions, logging capacity, parser version, exposed settings, power/enclosure requirements, tested browsers, maintenance and recovery. The Green Goods software adapter is missing today. Wholesale availability, packaging rights, warranty responsibility and reseller support are also unresolved. No supplier relationship is implied.

The end-user objective is one guided setup with no soldering, terminal, broker deployment or custom firmware programming. This is a proposed acceptance criterion, not current certification. A custom open sensor package is a later option if stock equipment cannot satisfy a demonstrated need; it adds inventory, manufacturing, support and firmware-maintenance responsibilities.

## DIY assembly options

This follow-up addresses the user's request for orderable components people can assemble themselves and providers that could manufacture Green Goods-branded kits. Prices below were checked on 9 October 2026 Pacific. Prefer a reproducible component list and supported firmware profile over a generic instruction to buy any ESP32 or soil sensor. A small microcontroller inside the sensor is different from requiring a separate laptop-class community node.

| Candidate | Priced core / kit | Assembly and use | Unresolved or missing |
|---|---|---|---|
| Connector-based XIAO/Grove | Pre-soldered XIAO ESP32-C3 **US$5.99** + Grove Base **US$3.99** + Grove capacitive probe **US$6.50** = **US$16.48** | Seat the controller and connect the probe through the Grove system; manufacturer's base supports XIAO boards, with pin differences to check. H28–H30 | Exact connector/ADC behavior, firmware, USB cable/power, protected enclosure, mounting, history and reference checks. Battery use can add soldering; start with USB power for the assembly test |
| Wired learning kit | Same pre-soldered controller **US$5.99** + DFRobot SEN0193 **US$5.90** = **US$11.89** | Connect analog signal, supply and ground with the appropriate leads. H28/H45 | Exposed electronics, wiring mistakes, power, enclosure, firmware and logging. No outdoor lifetime claim |
| Better-protected probe candidate | Same controller **US$5.99** + DFRobot SEN0308 **US$14.90** = **US$20.89** | Separate wired probe; manufacturer advertises IP65. H28/H31 | Compatible leads and ADC configuration, protected controller, power/storage, firmware and field checks. Probe protection does not waterproof the assembled kit |
| Integrated development kit | LILYGO T-Higrow **BME280 Kit CH9102 [Q222]: US$13.01** | Integrated soil/ambient/light sensing; kit includes case and 200 mAh battery. Less hardware assembly, still firmware/setup work. H32 | Current firmware/revision compatibility, browser setup, independent history, weather rating and battery endurance |

These are single-unit listing calculations, not complete delivered-kit prices or evidence that DIY is cheaper over its lifetime. They exclude shipping/imports, setup/review time and failed parts. Commodity probe substitutions change the connector, power/output range and calibration contract. The less expensive unpopulated controller is not equivalent to the pre-soldered assembly route.

For an I2C alternative, Adafruit lists its STEMMA capacitive soil sensor at **US$7.50**, with a connection cable additional. It is an alternative probe interface, not a priced complete kit or a soil-temperature/air-temperature station. H44.

The T-Higrow vendor repository contains an example that displays data through a browser after Arduino build/upload and Wi-Fi configuration. This establishes a historical example, not the factory behavior of Q222 or a tested Green Goods endpoint. Its exact source/dependency rights and new-board compatibility remain unresolved. Do not carry its marketing term “soil fertility” into a nutrient or NPK claim. H32/H33.

### A browser-based DIY experience is plausible, with firmware work remaining

ESP Web Tools documents installation of prepared ESP firmware through Web Serial, including ESP32-C3. It requires a secure website; supported Improv firmware can then provision Wi-Fi and direct the user to a device UI. It installs a prepared binary rather than designing or compiling firmware in the browser. H34.

ESPHome documents a device-hosted web server/REST interface and a captive portal. Its web assets can be embedded for offline access; the default can load external assets. Cross-origin policy, authentication and OTA settings require explicit configuration. These features are an available implementation path, not a prebuilt Green Goods profile or a local historian. H35.

Proposed later workflow, subject to separate implementation/device-test authorization:

1. Order the exact supported parts and assemble the labeled connectors or leads.
2. Connect USB to a supported desktop Chromium browser and select a reviewed firmware profile.
3. Install the pinned binary, with a recoverable bootloader route. Bundle required installer assets/resources before claiming offline flashing.
4. Use the device's local setup portal to configure the intended network. A phone can handle this step after firmware installation; an iPhone browser is not the baseline USB-flashing path.
5. Name the observation location, perform a reference check and inspect private local readings.
6. Close the laptop, interrupt power and reconnect. Prove history recovery, clock handling and duplicate prevention before field use.

The firmware must either retain observations while the browser is absent or explicitly state that it only delivers live readings. Logging capacity, write wear, power-loss behavior and any additional storage/clock hardware remain uncosted. Deep sleep saves power only under a tested collection design and can make a device's web interface unavailable between wake periods. No battery-life estimate is offered.

The compiler/build process belongs to a maintainer or an experienced assembler unless an existing supported profile is sufficient. No Raspberry Pi, MQTT broker or Home Assistant server is inherently required for a device-hosted HTTP interface. The selected firmware, network/hotspot behavior and Green Goods adapter still need testing. Keep automation and irrigation actuators outside this monitoring trial.

### Local DIY sourcing in the four countries

These are examples of component supply, not interchangeable approved Green Goods parts or complete-kit quotations.

| Country | Observed source | Interpretation |
|---|---|---|
| United States | Seeed manufacturer components above; Adafruit STEMMA at US$7.50. H28–H30/H44 | Named manufacturer parts make the core bill reproducible. Delivered kit cost and local shipping remain separate |
| Nigeria | Hub360 capacitive probe showed **NGN1,450 promotional price**, with NGN1,800 crossed out. H41 | Local probe lead; exact manufacturer/revision and matching controller stock not verified. Indexed page text still showed the older price |
| Brazil | RoboCore capacitive probe showed **BRL6.79** and a stock count in the live page. H42 | Vendor supplies different revisions by lot. Supply/output and ESP32 guidance have changed across dated answers; inspect the exact lot before substituting |
| South Africa | Micro Robotics SEN0193 showed **ZAR136.85 including tax**, limited Centurion stock. H43 | Generic CAP-SW-12 at ZAR55.20 and IP65 SEN0308 at ZAR320.85 including tax both showed no branch stock during inspection. Catalog prices alone do not establish availability |

No currency conversion, confirmed delivery time or country-wide availability is inferred. Regional assembly/support could reduce some freight and repair friction, but requires a testable parts registry, local electrical/radio approvals and measured support costs. A radio module's certification does not by itself clear a finished branded kit. Existing H22–H24 approval gaps remain open.

## White-label, OEM and manufacturing options

Four different offers are possible: a Green Goods kit box/guide containing unchanged manufacturer products; negotiated co-branding; factory branding of a standard device; or a commissioned new design. Each has different rights, cost and support responsibilities. Branding alone does not supply a local API, firmware ownership, a warranty or permission to change certification labels.

| Provider | Established first-party offer | Fit for Green Goods | Not established |
|---|---|---|---|
| Seeed Studio / Fusion | Logos, packaging, tested firmware flashing and accessory customization; page advertises minimum one piece. H36 | Strong first lead for a small branded kit or validated XIAO-based package | Eligible exact SKU, completed-kit price, materials, warranty and whether the proposed firmware is accepted |
| Fine Offset / Ecowitt | Company page identifies Shenzhen Fine Offset and its OEM/ODM business for overseas brands. H37 | Strongest branded off-the-shelf soil/weather lead because local WebUI/API/history options were researched above | MOQ, wholesale price, brand/firmware rights, private defaults, exact regional certificates and availability |
| Makerfabs | IoT OEM/ODM, PCB assembly, mechanical design and packaging services. H38 | Candidate to manufacture a validated community sensor design | Specific white-label soil SKU, MOQ, engineering/testing charges and support agreement |
| Dragino | Customized enclosure logo/package design, module assistance and manufacturing/assembly. H39 | Later long-range/industrial sensor lead | Browser-facing path for a selected device, gateway/network cost, MOQ, quote and four-country authorization |
| AirGradient | Professional pages describe branded reports/dashboard and volume-project custom-branding options. H40 | Later air-quality service/kit lead | Explicit permission and terms to rebrand the physical monitor; dashboard white-label wording is not sufficient |

No equivalent public LILYGO or Ruuvi hardware white-label program was established in this bounded search. This is an evidence gap, not proof that the companies will refuse a partnership. Open schematics or purchasable products alone do not establish rebranding permission.

### Published Seeed fees and batch economics

Live supplier-page inspection confirmed the following advertised charges. These are not a negotiated Green Goods quote. NRE means a one-time engineering/setup charge for a unique customization item; the listed firmware service covers tested firmware, not an assumed new firmware development project. H36.

| Service | Listed NRE | Listed per-unit labor |
|---|---:|---:|
| Laser logo | US$299 | US$2 |
| Silk-screen logo, alternative to laser | US$339 | US$2 |
| Packaging | US$299 | US$1 |
| Firmware service | US$199 | US$1.50 |

For the laser + packaging + firmware combination, arithmetic gives **US$797 setup + US$4.50 labor per unit**. Spreading setup across an illustrative 20-unit order gives **US$44.35/unit**; across 100 units, **US$12.47/unit**, before base hardware and any other charges. These are calculated allocation examples, not quotes, demand, delivery forecasts or recommended volumes. Confirm actual service eligibility and material/test costs. Small-order access does not establish small-order affordability.

### Rights and responsibilities to settle before a branded order

- Exact bill of materials, revision/change notices, replacement stock, connectors and regional variants.
- Local read/configuration/export access; cloud defaults; retained logs; offline clock/recovery; factory tests and acceptance criteria.
- Firmware source and build rights, dependency notices, update/security ownership, per-device credentials and recovery. One shared factory secret is not an acceptable community identity design.
- Enclosure logo and packaging rights, required manufacturer/certification markings, warranty/returns, defects and field-maintenance responsibility.
- MOQ, engineering/test/tooling charges, unit/material costs, freight/imports, lead times and continuity after the supplier relationship ends.

ESPHome's license distinguishes GPLv3 C++ firmware code from MIT Python/other code; ESP Web Tools uses Apache 2.0. Hardware schematics, enclosure files and vendor examples need their own checks. A branded product can retain those licenses and notices, subject to exact distribution obligations. This research changes no license and does not establish legal clearance. No supplier receives ownership of community records or AI-training permission through a manufacturing arrangement. H33–H35.

**Recommendation:** compare a supported connector-based DIY workshop kit and a tested assembled kit using the same observation contract. Validate assembly/recovery and measured total cost before selecting either. For the earliest learning cohort, a Green Goods box, guide and support offer can be investigated before paying for factory branding, with manufacturer identity and required markings retained. Seeed is the first customization-service lead; Fine Offset is the first finished soil/weather OEM lead. New PCB/enclosure development should follow evidence that stock designs cannot meet the workflow. No provider has been contacted and no partnership is implied.

## California prototype purchase and Green Goods commissioning

The user identified California, macOS/Brave on the laptop and Brave/Chrome on an Android phone. This section recommends hardware for a physical bench exploration. It does not replace the synthetic input or authorize implementation in the original two-week PRD. No order, device access or firmware operation has occurred.

### Recommended first purchase

| Quantity | Item | Observed price | Purpose |
|---|---|---:|---|
| 1 | Pre-soldered XIAO ESP32-C3, SKU 102010633 | US$5.99 | USB-connected controller with Wi-Fi/BLE; H28, rechecked |
| 1 | Expansion Board Base for XIAO, SKU 103030356 | US$14.90 | Grove connectors, microSD slot, RTC and display; H46 |
| 1 | Grove capacitive soil probe, SKU 101020614 | US$6.50 | One qualitative soil-moisture question; H30, rechecked |
| 1 each | Small microSD card, CR1220 clock battery, USB-C data cable and suitable USB power supply if none is available | Unquoted | Storage, clock backup, installation and power when the laptop is absent |

Named components total **US$27.39** before accessories, shipping, tax or import charges. The expansion board replaces the US$3.99 Grove Base in the cheaper earlier core; buying both is unnecessary for this configuration. A spare pre-soldered controller is optional. No LiPo battery is needed for the initial USB-powered experiment.

Seeed lists the expansion board in stock. DigiKey also lists this exact board at US$14.90, with US tariff/shipping qualifications. No California delivery quote or arrival date was obtained. H46/H52. Manufacturer documentation identifies CR1220, includes C3 SD-card instructions and has a C3/expansion SD example; those examples are feasibility evidence, not a tested Green Goods logger. H46/H47. A manufacturer notice records a PMIC change, so retain the actual board revision during testing. H53.

The probe documentation says the measurement is qualitative and that a Grove cable accompanies the module. Verify package contents and respect the insertion line. Start in a pot or sheltered bench setting; this is not a waterproof field package. Firmware must implement recording, clock setup, gaps and retrieval. Hardware having a card slot or RTC does not establish those behaviors. H30.

### Keep installation and configuration inside Green Goods

**Proposed flow:** Add device → select the named board → connect USB → approve the browser's port chooser → install reviewed firmware → configure the device in Green Goods → retrieve private readings.

Use Espressif's `esptool-js` as a replaceable flashing adapter under a Green Goods interface. It is a browser flasher with Apache 2.0 licensing. ESP Web Tools is an alternative embedded installer and reference workflow; its default interface need not become Green Goods' product interface. No flasher has been integrated here. H34/H48.

Required work before this experience can be claimed:

1. **Exact firmware profile.** Build and test one binary for the named controller/base/probe revision, pin assignments, flash layout and USB mode. Chip-family detection alone cannot identify the correct board wiring. Include source/dependency notices and integrity metadata. Compilation happens in a maintainer build process; the participant installs the prepared image.
2. **Visible install session.** Detect Web Serial, request the intended port on a user action, show progress and handle disconnects, bootloader entry, failure and retry. Preserve a recoverable bootloader path. An update must explain and obtain approval for erased configuration/logs. Pause app-update reloads while installation is active; service workers are not unattended firmware installers.
3. **USB provisioning.** Implement Improv Serial or an equivalent bounded protocol in the firmware and the Green Goods wizard. It can exchange Wi-Fi network/configuration information through USB, avoiding a separate vendor portal. Wi-Fi credentials must not enter telemetry, logs, model input or a public record. Improv is provisioning, not sensor history or a complete authentication policy. H49.
4. **Device data/configuration protocol.** Reconnect after reboot, confirm reported firmware/device identity and own one serial session at a time. Use separately framed, versioned commands for clock, card status, sampling configuration, current readings and bounded history retrieval. Validate payloads and preserve original values, units/time quality and calibration context. Save acknowledgements/checkpoints so repeat transfers do not duplicate observations. A successful write does not prove successful boot or logging.
5. **Prepared offline package.** Cache the Green Goods page, flasher/runtime assets, required stubs, manifest and verified firmware bytes before showing offline readiness. Do not depend on a third-party CDN at install time. The current PWA shell cache is not proof that a firmware package is prepared. H54.
6. **Later phone route.** Test the same Green Goods workflow with the user's Android phone, USB host cable/adapter and current Chrome. Keep BLE/local-network collection as separately tested choices; HTTPS origin, local-network permissions, device authentication and history remain necessary. No native application or MQTT broker is inherently needed for the initial USB path.

Native browser/device permission prompts remain platform-controlled. Green Goods can own the application screens but cannot suppress those prompts or turn on a browser-disabled API.

### Browser correction and compatibility gate

Brave's official deviations page, a non-exhaustive document with 2025 revision information, lists Web Serial as off by default with an advanced flag. This does not establish the user's installed Web Bluetooth behavior. The user's installed versions were not inspected. Treat macOS/Brave as a requested target needing explicit API/device proof, not as a certified Chromium-equivalent flashing environment. Do not weaken Shields or change flags automatically. H51. The [capture and device-flow supplement](capture-and-device-flows.md) adds optional Seeed temperature/humidity/light probes, delivery choices and versioned browser compatibility; these are proposals rather than hardware acceptance evidence.

Chrome 148's official release notes establish Android Web Serial support. Current MDN compatibility data also records Firefox desktop support. This corrects any universal desktop-Chromium-only assumption. Native API availability does not prove a particular flasher, USB adapter, power budget or C3 USB mode works on the phone. The ESP Web Tools page still says its Android path is unimplemented; that library limitation is separate from current Chrome capability. Test `esptool-js` independently before promising mobile flashing. H34/H48/H50.

If Brave's serial API is absent, Green Goods cannot solve that in page code. A user-chosen browser configuration or supported browser is a prerequisite; the application workflow can still stay at the Green Goods origin. No browser setting or software installation is authorized by this recommendation.

**First proof to seek after separate authorization:** one board flashed from Green Goods; configuration and reference reading shown in its UI; logs retained while the laptop is absent; private history retrieved after internet loss/restart; erased-data warning and USB recovery demonstrated. Android adds a distinct second proof. This is a proposed hardware/commissioning experiment, not current acceptance evidence or an implementation schedule.

## Acceptance and decision gates

| Gate | Evidence needed |
|---|---|
| Complete purchase | Country-specific landed quote and confirmation of every needed item, compatible radio/plug variant and return/warranty terms |
| Browser setup | Actual stock firmware configured with phone browser and laptop/Brave; identify any native-app requirement |
| Local-only behavior | Setup/read/configuration with WAN disconnected; test existing LAN and phone/laptop hotspots, default uploads, time sync, resets and update behavior |
| Record continuity | Close browsers and interrupt power/network, then retrieve logs; verify gaps, duplicates, clock drift and data-loss limits |
| Measurement usefulness | Placement and substrate-specific reference check; retain raw values and uncertainty; no automatic agronomic/outcome claim |
| Safe configuration | Scope permissions to one device, authenticate where supported, read back settings and preserve previous configuration |
| Accessibility | Manual entry/import, keyboard and screen-reader paths, understandable network transitions and a no-AI workflow |
| Maintenance/TCO | Record batteries, power, cleaning/calibration, failed probes, setup/support time and replacement availability |

Do not procure hardware or process live community records until the relevant site, budget and test authorization are explicit. First tests should use synthetic readings or appropriately authorized non-sensitive material. This recommendation does not revive deferred prototype hardware scope.

## Source-to-claim index

All sources below were checked on 9 October 2026 UTC. Prices/stock are mutable. The manuals and API documents were read as source evidence; no instructions were executed against devices.

| ID | Primary source | Narrow claim |
|---|---|---|
| H01 | [GW1206 kit](https://shop.ecowitt.com/products/gw1206) | US$48.99 listing; receiver/probe combination |
| H02 | [GW3000](https://shop.ecowitt.com/products/gw3000) | US$54.99 listing, additional power/card items |
| H03 | [WH51](https://shop.ecowitt.com/products/wh51) | Selected North American 915 MHz single-probe US$17.99 listing; AA battery excluded |
| H04 | [GW1200 manual](https://oss.ecowitt.net/uploads/20250331/GW1200.pdf) | Embedded browser setup, sensor selection; cloud storage described |
| H05 | [GW3000 manual](https://oss.ecowitt.net/uploads/20260320/GW3000Manual.pdf) | Local WebUI, SD CSV history, hotspot window and default upload |
| H06 | [LAN HTTP API v1.0.6](https://oss.ecowitt.net/uploads/20260114/HTTP%20API%20interface%20Protocol%20%28Generic%29-%28V1.0.6-2026-1-14%29%20.pdf) | Live `ch_soil`, request methods, network/sensor/calibration interfaces; internal date inconsistency |
| H07 | [Generic WebUI manual](https://oss.ecowitt.net/uploads/20250408/WS%20View%20Plus%20%26%20Web%20UI%20Manual%20%28Generic%29.pdf) | Browser-based network/SD management; cloud service setup is separable |
| H08 | [RuuviTag](https://ruuvi.com/ruuvitag/) | EUR39.90 base listing, included battery, sensor set and local history |
| H09 | [NUS](https://docs.ruuvi.com/communication/bluetooth-connection/nordic-uart-service-nus), [production history protocol](https://docs.ruuvi.com/communication/bluetooth-connection/nordic-uart-service-nus/log-read), [historical browser demonstration](https://ruuvi.com/web-bluetooth/) | Documented GATT/history interface; old demo is not current product proof |
| H10 | [SensorPush BLE protocol](https://www.sensorpush.com/bluetooth-api) | Current-reading interface; HT1 exclusion; history parity not established |
| H11 | [HT.w](https://www.sensorpush.com/products/p/ht-w), [G1](https://www.sensorpush.com/products/p/g1-gateway) | Advertised sensor price, native-app path and gateway cloud dependence |
| H12 | [Open Air](https://www.airgradient.com/outdoor) | Assembled US$225 / DIY US$125; sensor set and missing power plug |
| H13 | [Local monitor API](https://github.com/Open-Air-Foundation/firmware-one-openair/blob/master/docs/local-server.md), [API access](https://www.airgradient.com/documentation/kb/where-do-i-access-the-api-documentation-api-token-and-local-api) | HTTP reads/configuration and cloud/network control distinction |
| H14 | [Wi-Fi setup](https://www.airgradient.com/documentation/kb/connecting-your-airgradient-open-air-to-wifi), [local configuration](https://www.airgradient.com/documentation/kb/configure-mqtt-via-local-api) | Browser provisioning and local configuration; fully offline commissioning not proven |
| H15 | [Shelly US listings](https://us.shelly.com/collections/all-smart-home-products) | Plug US Gen4 advertised US$24.99 |
| H16 | [Plug US Gen4](https://kb.shelly.cloud/knowledge-base/shelly-plug-us-gen4), [device API](https://shelly-api-docs.shelly.cloud/gen2/Devices/Gen4/ShellyPlugUSG4/), [Cloud component](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Cloud/) | Local WebUI, metering/RPC and configurable cloud component; regional limits |
| H17 | [S2105](https://www.seeedstudio.com/SenseCAP-S2105-LoRaWAN-Soil-Temperature-Moisture-and-EC-Sensor-p-5358.html) | US$146 sensor, LoRaWAN and BLE/app configuration; no browser measurement guarantee |
| H18 | [Enviro Grow current store](https://shop.pimoroni.com/products/enviro-grow), [setup reference](https://learn.pimoroni.com/article/getting-started-with-enviro), [firmware](https://github.com/pimoroni/enviro) | Retired listing; useful historical provisioning pattern, not a stocked recommendation |
| H19 | [AirGradient municipal page](https://www.airgradient.com/professional/cities/) | Hosted-dashboard descriptions conflict; no subscription assumption carried forward |
| H20 | [Ruuvi delivery policy](https://ruuvi.com/shipping/) | Listed US shipping options; Nigeria, South Africa and South America in EUR39.90/order group; import charges and limited free-shipping eligibility |
| H21 | [Ecowitt shipping](https://shop.ecowitt.com/policies/shipping-policy), [manufacturer frequency guide](https://shop.ecowitt.com/blogs/must-read/how-to-choose-the-right-radio-frequency-for-your-first-or-existing-ecowitt-device) | Global-delivery claim, selected US-warehouse 915 MHz items, checkout charges; broad guide does not certify the exact country/model |
| H22 | [NCC consumer approval guidance](https://consumer.ncc.gov.ng/information-education/faqs/9-type-approvals), [current type-approval portal](https://www.ncc.gov.ng/industry/numbering-type-approval/type-approval) | IoT/short-range equipment approval and approved-equipment lookup; exact candidate approval not checked |
| H23 | [ANATEL import guidance](https://www.gov.br/anatel/pt-br/regulado/certificacao-de-produtos/importacao-para-uso-proprio) | Verify homologated model and marking; own-use pathway is not general resale authority |
| H24 | [ICASA type approval](https://www.icasa.org.za/pages/type-approval) | Equipment authorization or applicable exemption; exact candidate records not checked |
| H25 | [Instrufiber catalog](https://www.instrufiber.com.br/estacao-meteorologica/estacao-meteorologica-ultrasonica-profissional-wifi-ethernet-logger-sd-instrufiber-wh3000c) | Brazilian Ecowitt-branded weather-system sourcing lead, quotation rather than verified small-kit price/stock |
| H26 | [Ecotao weather catalog](https://ecotao.co.za/civilengineering/testandmeasurement/environmental/weather-station.html) | South African 433 MHz ecosystem and WH51 add-on sourcing lead; not a confirmed proposed-kit quote |
| H27 | [Ubuy Nigeria listing](https://www.u-buy.com.ng/product/MD3BPPBO2-gw1206-soil-moisture-tester-kit-includes-gw1200-iot-wi-fi-gateway-and-wh51-soil-moisture-sensor-915-mhz) | US-import listing with extra charges and product/warranty caveats; not verified local inventory or country fit |
| H28 | [Pre-soldered XIAO ESP32-C3](https://www.seeedstudio.com/Seeed-Studio-XIAO-ESP32C3-Pre-Soldered-p-6331.html) | SKU 102010633, US$5.99 and Wi-Fi/BLE; live page checked |
| H29 | [Grove Base](https://www.seeedstudio.com/Grove-Shield-for-Seeeduino-XIAO-p-4621.html), [base documentation](https://wiki.seeedstudio.com/Grove-Shield-for-Seeeduino-XIAO-embedded-battery-management-chip/) | SKU 103020312, US$3.99, connector system and XIAO pin differences |
| H30 | [Grove capacitive probe](https://www.seeedstudio.com/Grove-Capacitive-Moisture-Sensor-Corrosion-Resistant-p-2580.html), [documentation](https://wiki.seeedstudio.com/Grove-Capacitive_Moisture_Sensor-Corrosion-Resistant/) | SKU 101020614, live US$6.50 rather than indexed US$6.99; analog sensing |
| H31 | [DFRobot SEN0308](https://www.dfrobot.com/product-2054.html) | US$14.90, vendor IP65 and analog-interface claims; no complete-kit protection/accuracy proof |
| H32 | [T-Higrow](https://lilygo.cc/products/t-higrow?variant=42347095163061) | Q222 BME280 kit US$13.01 via live supplier interface/WebMCP read; case/battery and integrated sensors; not a field-ready certification |
| H33 | [Vendor HiGrow repository](https://github.com/Xinyuan-LilyGO/LilyGo-HiGrow) | Example build/upload and browser display; exact new-SKU compatibility and reusable rights unresolved |
| H34 | [ESP Web Tools](https://esphome.github.io/esp-web-tools/), [license](https://github.com/esphome/esp-web-tools/blob/main/LICENSE) | Prepared firmware installation, HTTPS/Web Serial, supported ESP families, optional Improv; Apache 2.0 |
| H35 | [ESPHome web server](https://esphome.io/components/web_server/), [captive portal](https://esphome.io/components/captive_portal/), [license](https://github.com/esphome/esphome/blob/dev/LICENSE) | Local UI/REST, embedded assets/security settings; GPLv3 C++ versus MIT other code; no automatic historian |
| H36 | [Seeed customization service](https://landing-page.seeedstudio.com/logo-customization), [2 June 2026 explanation](https://www.seeedstudio.com/blog/2026/06/02/seeed-fuion-light-customization-3-common-questions-before-you-start/) | Branding/packaging/firmware scope, minimum one-piece advertisement, live NRE/labor charges; eligibility/quote unresolved |
| H37 | [Ecowitt company](https://shop.ecowitt.com/pages/our-company) | Fine Offset identity and OEM/ODM business; no published Green Goods terms |
| H38 | [Makerfabs services](https://www.makerfabs.com/about-us) | OEM/ODM, assembly/mechanical/packaging capabilities; exact product/terms unquoted |
| H39 | [Dragino OEM/ODM](https://www.dragino.com/about/oem-odm.html) | Logo/package/module/manufacturing scope; specific kit and commercial terms unresolved |
| H40 | [AirGradient professional](https://www.airgradient.com/professional/), [volume projects](https://www.airgradient.com/professional/schools/buildings/) | Reports/dashboard branding and custom-branding lead; physical rebranding permission not established |
| H41 | [Hub360 probe](https://hub360.cc/shop/1116-capacitive-soil-moisture-sensor-11018) | Live NGN1,450 promotion versus indexed NGN1,800; exact part/stock compatibility unverified |
| H42 | [RoboCore probe](https://www.robocore.net/sensor-ambiente/sensor-de-umidade-de-solo-capacitivo) | Live BRL6.79 listing/stock signal; lot-dependent revisions and dated electrical guidance |
| H43 | [Micro Robotics SEN0193](https://www.robotics.org.za/SEN0193), [CAP-SW-12](https://www.robotics.org.za/CAP-SW-12), [SEN0308](https://www.robotics.org.za/SEN0308) | Live ZAR136.85 tax-inclusive limited-stock candidate; cheaper/IP65 alternatives showed no branch stock |
| H44 | [Adafruit STEMMA probe](https://www.adafruit.com/product/4026) | US$7.50 I2C capacitive sensor; cable additional, not complete environmental station |
| H45 | [DFRobot SEN0193](https://www.dfrobot.com/product-1385.html) | US$5.90 analog capacitive probe; no outdoor kit certification |
| H46 | [XIAO Expansion Base](https://www.seeedstudio.com/Seeeduino-XIAO-Expansion-board-p-4746.html), [documentation](https://wiki.seeedstudio.com/Seeeduino-XIAO-Expansion-Board/) | SKU 103030356, US$14.90, Grove/SD/RTC and CR1220; C3 instructions, not Green Goods proof |
| H47 | [C3 expansion examples](https://wiki.seeedstudio.com/XIAO-ESP32C3-Zephyr/) | Official C3/base and SD sample; no new firmware or SDK selection implied |
| H48 | [Espressif browser flasher](https://github.com/espressif/esptool-js), [license](https://github.com/espressif/esptool-js/blob/main/LICENSE) | Browser/Web Serial adapter, Apache 2.0; actual board/browser behavior untested |
| H49 | [Improv Serial](https://www.improv-wifi.com/serial/) | Wi-Fi provisioning frames, device information and network commands; distinct from application data/authentication |
| H50 | [Chrome 148 release](https://developer.chrome.com/release-notes/148?hl=en), [MDN Serial data](https://github.com/mdn/browser-compat-data/blob/main/api/Serial.json) | Android support correction; native capability is not flasher/device proof |
| H51 | [Brave deviations](https://github.com/brave/brave-browser/wiki/Deviations-from-Chromium-%28features-we-disable-or-remove%29) | Documented Serial restriction; page is non-exhaustive, installed Serial/Bluetooth behavior untested |
| H52 | [DigiKey expansion board](https://www.digikey.com/en/products/detail/seeed-technology-co-ltd/103030356/13572081) | Exact-part US-dollar price/stock signal, shipping/tariff qualification; no delivered quote |
| H53 | [Manufacturer change notice](https://files.seeedstudio.com/wiki/Seeeduino-XIAO-Expansion-Board/document/PCN-103030356.pdf) | 19 November 2025 PMIC substitution under the same SKU; vendor says functional compatibility retained |
| H54 | [PWA config](../../../packages/client/vite.config.ts), [shell cache](../../../packages/client/src/sw/shell.ts), [asset verification](../../../packages/client/src/sw/shellAssets.ts), [worker](../../../packages/client/src/sw/worker.ts) | `VitePWA`, `PwaShell`, `populateShellAssets` and `installGreenGoodsWorker` inspected at 06a31db; targeted Client/Shared searches found no installer references; offline firmware readiness absent/unproved |

## Evidence and quality review

**Disposition:** carry forward Ecowitt local-history and Ruuvi direct-logger candidates for a human hardware/workflow decision. Retain AirGradient and Shelly as separate air/energy examples. Defer SenseCAP for the first node-free browser workflow; exclude retired Enviro Grow from purchase recommendations.

Prices were verified against primary listings and configuration arithmetic is independently checked. Existing hardware capabilities, proposed Green Goods software, unknown logging/API behavior and extra costs are kept separate. The four requested countries are now included; exact regional SKUs, delivered quotes, kit selection, site and budget remain open. Direct retrieval of NCC, ICASA and Ecotao pages timed out on some attempts; indexed primary-page text was available and is sufficient for the narrow sourcing/approval leads, not a complete regulatory audit. No measurements, demand, supply agreement or Green Goods compatibility are invented. No hardware or product runtime proof exists.

**DIY/OEM review:** H28–H45 adds orderable cores, current regional component leads, documented customization services, rights gaps and setup-cost allocation. Live supplier inspection corrected stale indexed prices and stock assumptions. The core bills do not inherit a logger, weather rating or tested battery life. Firmware installation is distinct from compilation; dashboard branding is distinct from physical white-label permission. The named OEM services establish capability, not partner interest, acceptance of a Green Goods design, pricing or an agreement. Carry forward a bounded DIY-versus-assembled comparison and quote brief after hardware/workflow selection. No purchase, contact, installation, firmware change or license change occurred.

**California/commissioning review:** H46–H54 supports the US$27.39 recommended component set and an in-app installation/provisioning design. The user's desktop/phone choices are recorded without inspecting personal devices. Brave restrictions and newer Android/Firefox capabilities correct browser-family assumptions; no flag is changed or compatibility certified. The software, firmware, data protocol and offline package are missing. SD/RTC examples do not establish a logger. Keep this physical experiment separate from the original synthetic prototype and obtain bounded implementation/test authorization before any build or device operation.
