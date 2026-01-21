# Green Goods v1 PRD — Action Domains & Schema Registry

*This section defines the core action domains Green Goods will optimize for, mapping to Greenpill's DePIN, DeSci, Environment, and Education pillars. Each domain includes the action lifecycle, verification requirements, and pilot program alignment.*

---

## 3.4 Action Domains & Target Outcomes

Green Goods is not a generic impact tracking tool—it is purpose-built to capture and verify specific categories of regenerative work emerging from Greenpill Network chapters and aligned initiatives. The protocol optimizes for **five core action domains** that reflect where local communities are actively creating value:

| Domain | Greenpill Pillar | Primary Chapters | Key Outcome |
|--------|------------------|------------------|-------------|
| **Solar Infrastructure** | DePIN | Nigeria (Tech & Sun) | Energy access + staking yield |
| **Waste Management** | Environment | Cape Town, Ivory Coast, Koh Phangan, Rio Brasil | Circular economy systems |
| **Agroforestry & Planting** | DeSci + Environment | Brasil (Diogo/AgroforestryDAO), Uganda (Jonathan) | Biodiversity + carbon sequestration |
| **Education & Knowledge Transfer** | Education | All chapters, Artizen Fund cohort | Skill building + intergenerational knowledge |
| **Mutual Credit & Farmer Verification** | DePIN + DeSci | Brasil (Commitment Pooling pilot) | Credit access for rural producers |

---

## Domain 1: Solar Infrastructure (DePIN)

### 1.1 Context: Tech & Sun (TAS) Program

The Tech & Sun initiative, led by Greenpill Nigeria, deploys solar-powered container hubs at Nigerian universities (University of Nigeria Nsukka, Nnamdi Azikiwe University). These hubs provide reliable electricity, Starlink internet, Ethereum staking infrastructure, and co-learning spaces for Web3 education.

Green Goods captures each phase of hub deployment and ongoing operations, creating an immutable audit trail for funders and enabling yield routing from staking rewards.

### 1.2 Action Lifecycle: Solar Hub Deployment

| Phase | Action Type | Description | Verification Evidence |
|-------|-------------|-------------|----------------------|
| **Site Acquisition** | `site_secured` | Document land/space agreement with university | Photos of location, signed agreement scan, GPS coordinates |
| **Container Procurement** | `container_acquired` | Record purchase/delivery of 20ft shipping container | Delivery receipt, photos of container, cost documentation |
| **Solar Installation** | `solar_installed` | Install solar panels, inverters, batteries | Photos of equipment, installation completion, Switch meter data |
| **Connectivity Setup** | `connectivity_established` | Deploy Starlink/MTN FibreX internet | Speed test results, equipment photos, subscription proof |
| **Staking Infrastructure** | `node_deployed` | Set up Ethereum staking node (Obol/Lido CSM) | Node address, initial sync proof, validator deposit tx |
| **Hub Launch** | `hub_launched` | Official opening ceremony and first users | Event photos, attendance count, media coverage |
| **Ongoing Operations** | `hub_session` | Daily/weekly usage sessions | User count, energy generated (kWh), session duration |
| **Workshop Hosted** | `workshop_hosted` | Educational event at hub | Attendance list, workshop materials, participant feedback |
| **Maintenance Performed** | `maintenance_completed` | Equipment servicing or repairs | Work description, before/after photos, parts replaced |

### 1.3 Solar Hub Action Schema

```json
{
  "title": "Solar Hub Session",
  "description": "Document a usage session at a Tech & Sun solar hub, including energy generation, user count, and activities conducted.",
  "capitals": ["MATERIAL", "INTELLECTUAL", "SOCIAL"],
  "uiConfig": {
    "media": {
      "title": "Capture Hub Activity",
      "description": "Take photos of the hub in operation, users working, and energy meter readings.",
      "maxImageCount": 6,
      "required": true
    },
    "details": {
      "inputs": [
        {
          "key": "sessionType",
          "title": "Session Type",
          "type": "select",
          "required": true,
          "options": ["Open Workspace", "Workshop/Training", "Hackathon", "Community Event", "Maintenance", "Other"]
        },
        {
          "key": "userCount",
          "title": "Number of Users",
          "type": "number",
          "required": true,
          "min": 1
        },
        {
          "key": "energyGenerated",
          "title": "Energy Generated (kWh)",
          "type": "number",
          "required": false,
          "step": 0.1,
          "description": "Read from Switch smart meter if available"
        },
        {
          "key": "sessionDuration",
          "title": "Session Duration (hours)",
          "type": "number",
          "required": true,
          "min": 0.5,
          "max": 24
        },
        {
          "key": "nodeUptime",
          "title": "Staking Node Uptime (%)",
          "type": "number",
          "required": false,
          "min": 0,
          "max": 100,
          "description": "If staking infrastructure is operational"
        }
      ]
    }
  }
}
```

### 1.4 Verification Requirements

| Action | Operator Verification | Evaluator Certification | On-chain Proof |
|--------|----------------------|------------------------|----------------|
| Site secured | GPS + document review | Not required | Location attestation |
| Solar installed | Photo review + meter data | M3tering Protocol verification | Energy asset registration |
| Node deployed | Validator address check | Obol/Lido confirmation | Deposit transaction |
| Hub session | Photo + meter reading | Spot check (10% sample) | Usage attestation |

### 1.5 Impact Metrics (Solar Domain)

- **Energy Generated:** Total kWh from solar installations
- **Users Served:** Unique individuals using hub facilities
- **Node Uptime:** Percentage availability of staking infrastructure
- **Yield Generated:** ETH rewards from staking operations
- **Workshops Hosted:** Count of educational sessions
- **Cost per kWh:** Operational efficiency metric

---

## Domain 2: Waste Management (Environment)

### 2.1 Context: Multi-Chapter Waste Initiatives

Waste management is being tackled across multiple Greenpill chapters with varying approaches:

| Chapter | Location | Approach | Focus |
|---------|----------|----------|-------|
| **Cape Town** | South Africa | Community beach cleanups | Coastal ecosystems, tourism areas |
| **Ivory Coast** | West Africa | Urban waste collection | Informal settlements, market areas |
| **Koh Phangan** | Thailand | Island waste optimization | Resort areas, dive sites, marine debris |
| **Rio Brasil** | Brazil | Systematic waste management | Urban/suburban circular economy |

Green Goods standardizes capture across these diverse approaches while allowing local customization of waste categories and processing methods.

### 2.2 Action Lifecycle: Waste Management

| Phase | Action Type | Description | Verification Evidence |
|-------|-------------|-------------|----------------------|
| **Area Assessment** | `waste_area_assessed` | Survey location to understand waste problem | GPS coordinates, photos of waste accumulation, area size estimate |
| **Cleanup Event** | `waste_cleanup` | Collect and remove waste from area | Before/after photos, waste weight, participant count |
| **Waste Sorting** | `waste_sorted` | Categorize collected waste by type | Photos of sorted piles, weight by category |
| **Recycling Delivered** | `waste_recycled` | Transport recyclables to processing facility | Delivery receipt, facility name, materials delivered |
| **Composting** | `waste_composted` | Process organic waste into compost | Compost pile photos, input weight, output estimate |
| **Upcycling Project** | `waste_upcycled` | Transform waste into useful products | Input materials, output products, process photos |
| **System Maintenance** | `waste_system_maintained` | Service collection points or processing equipment | Equipment photos, maintenance log |

### 2.3 Waste Cleanup Action Schema (Enhanced)

```json
{
  "title": "Waste Cleanup",
  "description": "Document waste removal activities including type, quantity, and estimated weight. Helps maintain clean environments and track waste reduction impact.",
  "capitals": ["MATERIAL", "SOCIAL", "EXPERIENTIAL"],
  "uiConfig": {
    "media": {
      "title": "Capture the Waste Cleanup",
      "description": "Take before/after photos of the cleanup area and photos of collected waste.",
      "maxImageCount": 8,
      "required": true
    },
    "details": {
      "inputs": [
        {
          "key": "cleanupType",
          "title": "Cleanup Type",
          "type": "select",
          "required": true,
          "options": ["Beach Cleanup", "Street Cleanup", "River/Waterway", "Park/Green Space", "Market Area", "Residential Area", "Other"]
        },
        {
          "key": "wasteSelection",
          "title": "Waste Types Collected",
          "type": "select",
          "required": true,
          "multiple": true,
          "options": ["Plastic (PET)", "Plastic (HDPE)", "Plastic (Other)", "Metal (Aluminum)", "Metal (Steel)", "Glass", "Paper/Cardboard", "Organic", "E-Waste", "Textiles", "Fishing Gear", "Other"]
        },
        {
          "key": "wasteCount",
          "title": "Waste Items Removed",
          "type": "number",
          "required": true,
          "min": 1
        },
        {
          "key": "estimatedWeight",
          "title": "Estimated Weight (kg)",
          "type": "number",
          "required": true,
          "min": 0.1,
          "step": 0.1
        },
        {
          "key": "participantCount",
          "title": "Number of Participants",
          "type": "number",
          "required": true,
          "min": 1
        },
        {
          "key": "areaSize",
          "title": "Area Cleaned (sqm)",
          "type": "number",
          "required": false,
          "min": 1
        },
        {
          "key": "disposalMethod",
          "title": "Disposal Method",
          "type": "select",
          "required": true,
          "options": ["Recycling Center", "Landfill", "Composting", "Upcycling Project", "Municipal Collection", "Other"]
        }
      ]
    }
  }
}
```

### 2.4 Verification Requirements

| Action | Operator Verification | Evaluator Certification | On-chain Proof |
|--------|----------------------|------------------------|----------------|
| Waste cleanup | Before/after photo comparison, weight estimate plausibility | Spot verification for events >100kg | Weight attestation |
| Waste sorted | Category photos, weight distribution | Recycling facility confirmation (if applicable) | Material breakdown attestation |
| Recycling delivered | Receipt from facility | Facility confirmation (high-value only) | Delivery attestation |

### 2.5 Impact Metrics (Waste Domain)

- **Total Waste Removed:** kg collected across all cleanups
- **Diversion Rate:** Percentage of waste recycled/composted vs. landfilled
- **Area Cleaned:** Total sqm restored
- **Participants Engaged:** Unique individuals in cleanup events
- **Cost per kg:** Operational efficiency metric
- **Material Recovery Value:** Economic value of recyclables

---

## Domain 3: Agroforestry & Planting (DeSci + Environment)

### 3.1 Context: Two Distinct Approaches

**Approach A: Agroforestry DAO (Brasil - Diogo)**
Building not just a system to capture work, but one that spreads knowledge to future generations. Focus on sustainable farming practices, biodiversity corridors, and intergenerational knowledge transfer through documentation.

**Approach B: Educational Planting (Uganda - Jonathan)**
Combining planting with education—visiting schools and churches to plant native, fruit-bearing trees where each student becomes a caretaker for a specific tree, creating personal relationships with the ecosystem.

### 3.2 Action Lifecycle: Agroforestry

| Phase | Action Type | Description | Verification Evidence |
|-------|-------------|-------------|----------------------|
| **Site Assessment** | `site_assessed` | Evaluate land for planting suitability | GPS, soil photos, existing vegetation survey |
| **Species Selection** | `species_selected` | Choose appropriate native species | Species list, rationale, seed/seedling source |
| **Site Preparation** | `site_prepared` | Clear, amend soil, create planting plan | Before photos, soil test results (if available) |
| **Planting** | `planting_completed` | Plant trees/seedlings | Species, count, GPS of each tree (if feasible), photos |
| **Student Assignment** | `tree_assigned` | Assign tree to student caretaker (Uganda model) | Student name, tree ID, assignment photo |
| **Watering** | `watering_completed` | Water plants | Water amount, method, plant condition |
| **Monitoring/Observation** | `plant_observed` | Check health, growth, identify issues | Photos, measurements, health status |
| **Harvesting** | `harvest_completed` | Collect fruits, seeds, or other products | Yield weight, quality, distribution plan |
| **Knowledge Documentation** | `knowledge_documented` | Record farming techniques for future generations | Written guide, video, language(s) |

### 3.3 Planting Action Schema (Enhanced for Educational Model)

```json
{
  "title": "Planting",
  "description": "Document planting activities for any plant type including trees, seedlings, shrubs, or other vegetation. Optionally assign caretakers for educational programs.",
  "capitals": ["LIVING", "MATERIAL", "EXPERIENTIAL", "INTELLECTUAL"],
  "uiConfig": {
    "media": {
      "title": "Photograph the Planting",
      "description": "Take before/after photos of the planting location and closeups of planted specimens.",
      "maxImageCount": 8,
      "required": true
    },
    "details": {
      "inputs": [
        {
          "key": "plantType",
          "title": "Plant Type",
          "type": "select",
          "required": true,
          "options": ["Tree", "Seedling", "Shrub", "Flower", "Vegetable", "Herb", "Grass", "Fruit Tree", "Agroforestry Species", "Other"]
        },
        {
          "key": "plantSelection",
          "title": "Plant Species/Name",
          "type": "text",
          "required": true,
          "placeholder": "Enter species name (e.g., Mango, Avocado, Acacia)"
        },
        {
          "key": "isNative",
          "title": "Is this a native species?",
          "type": "select",
          "required": true,
          "options": ["Yes - Native", "No - Non-native", "Naturalized", "Unknown"]
        },
        {
          "key": "plantCount",
          "title": "Number of Plants",
          "type": "number",
          "required": true,
          "min": 1
        },
        {
          "key": "plantingContext",
          "title": "Planting Context",
          "type": "select",
          "required": true,
          "options": ["School Program", "Church/Community", "Private Land", "Public Restoration", "Agroforestry System", "Urban Greening", "Other"]
        },
        {
          "key": "caretakerAssigned",
          "title": "Caretaker Assigned?",
          "type": "select",
          "required": false,
          "options": ["Yes - Student", "Yes - Community Member", "Yes - Farmer", "No - Collective Care"]
        },
        {
          "key": "caretakerName",
          "title": "Caretaker Name (if assigned)",
          "type": "text",
          "required": false
        },
        {
          "key": "seedSource",
          "title": "Seed/Seedling Source",
          "type": "select",
          "required": false,
          "options": ["Local Nursery", "Community Seed Bank", "Wild Collected", "Commercial", "Donated", "Other"]
        }
      ]
    }
  }
}
```

### 3.4 Knowledge Documentation Schema (AgroforestryDAO)

```json
{
  "title": "Knowledge Documentation",
  "description": "Record traditional or innovative farming techniques for intergenerational knowledge transfer. Part of the AgroforestryDAO knowledge commons.",
  "capitals": ["INTELLECTUAL", "CULTURAL", "EXPERIENTIAL"],
  "uiConfig": {
    "media": {
      "title": "Capture the Knowledge",
      "description": "Record video demonstrations, photograph techniques, or scan written materials.",
      "maxImageCount": 10,
      "required": true
    },
    "details": {
      "inputs": [
        {
          "key": "knowledgeType",
          "title": "Knowledge Type",
          "type": "select",
          "required": true,
          "options": ["Planting Technique", "Soil Management", "Water Conservation", "Pest Management", "Harvest Method", "Processing/Storage", "Traditional Practice", "Innovation", "Other"]
        },
        {
          "key": "title",
          "title": "Knowledge Title",
          "type": "text",
          "required": true,
          "placeholder": "e.g., 'Companion Planting with Cassava and Beans'"
        },
        {
          "key": "description",
          "title": "Detailed Description",
          "type": "textarea",
          "required": true,
          "placeholder": "Describe the technique step by step..."
        },
        {
          "key": "sourceType",
          "title": "Knowledge Source",
          "type": "select",
          "required": true,
          "options": ["Elder/Traditional", "Farmer Innovation", "Scientific Research", "Extension Service", "Personal Experimentation"]
        },
        {
          "key": "languages",
          "title": "Languages Documented",
          "type": "select",
          "required": true,
          "multiple": true,
          "options": ["Portuguese", "English", "Spanish", "Yoruba", "Swahili", "French", "Local Dialect", "Other"]
        },
        {
          "key": "applicableClimates",
          "title": "Applicable Climates",
          "type": "select",
          "required": false,
          "multiple": true,
          "options": ["Tropical", "Subtropical", "Temperate", "Arid", "Mediterranean"]
        }
      ]
    }
  }
}
```

### 3.5 Verification Requirements

| Action | Operator Verification | Evaluator Certification | On-chain Proof |
|--------|----------------------|------------------------|----------------|
| Planting | GPS + species ID + photo review | Silvi integration (future) for species verification | Planting attestation |
| Tree assignment | Student/caretaker confirmation | School/church confirmation | Assignment attestation |
| Plant observation | Growth photos, health assessment | AI-assisted health analysis (future) | Observation attestation |
| Knowledge documentation | Content review, accuracy check | Domain expert review | Knowledge attestation (Hypercert-eligible) |

### 3.6 Impact Metrics (Agroforestry Domain)

- **Trees Planted:** Total count by species
- **Native Species Ratio:** Percentage of native vs. non-native
- **Survival Rate:** Trees alive at 6-month/1-year checkpoints
- **Caretakers Engaged:** Students/community members assigned
- **Knowledge Records:** Documentation pieces created
- **Carbon Sequestration Estimate:** tCO2e (using standard factors)
- **Fruit/Harvest Yield:** kg of produce from established trees

---

## Domain 4: Education & Web3 Workshops (Education)

### 4.1 Context: Coordination Education + Artizen Fund

Green Goods serves as the verification layer for educational initiatives:

1. **General Web3 Workshops:** Teaching coordination and governance mechanisms across Greenpill chapters
2. **Artizen Fund Cohort:** Students funded to host events using regenerative tools, with Green Goods verifying attendance and learning outcomes
3. **Tech & Sun Educational Programs:** Blockchain/ReFi training at solar hubs

### 4.2 Action Lifecycle: Education

| Phase | Action Type | Description | Verification Evidence |
|-------|-------------|-------------|----------------------|
| **Event Planning** | `event_planned` | Schedule and prepare workshop | Event details, curriculum, venue confirmation |
| **Workshop Hosted** | `workshop_hosted` | Conduct educational session | Attendance list, photos, materials used |
| **Participant Attendance** | `attendance_verified` | Individual attendance record | Sign-in, photo proof, engagement evidence |
| **Learning Assessment** | `learning_completed` | Quiz, project, or demonstration | Assessment results, project submission |
| **Certificate Issued** | `certificate_issued` | Issue completion credential | NFT badge or attestation |
| **Follow-up Action** | `followup_completed` | Participant applies learning | Evidence of real-world application |

### 4.3 Web3 Workshop Action Schema (Enhanced)

```json
{
  "title": "Web3 Workshop",
  "description": "Record your participation in a Web3 workshop, demo, or learning session. Document what you explored, tools tried, and next steps in the regenerative Web3 ecosystem.",
  "capitals": ["INTELLECTUAL", "SOCIAL", "EXPERIENTIAL"],
  "uiConfig": {
    "media": {
      "title": "Capture Workshop Moments",
      "description": "Take photos during the workshop: your setup, screens, team activities, or prototypes.",
      "maxImageCount": 8,
      "required": true
    },
    "details": {
      "inputs": [
        {
          "key": "eventName",
          "title": "Event Name",
          "type": "text",
          "required": true,
          "placeholder": "e.g., DevConnect Istanbul, ETHDenver, Greenpill NYC Meetup"
        },
        {
          "key": "sessionTitle",
          "title": "Workshop/Session Title",
          "type": "text",
          "required": true,
          "placeholder": "e.g., Intro to Green Goods, Regen Stack 101"
        },
        {
          "key": "workshopType",
          "title": "Workshop Type",
          "type": "select",
          "required": true,
          "options": ["Hands-on Tutorial", "Lecture/Presentation", "Hackathon", "Discussion/Forum", "Demo Day", "Office Hours", "Other"]
        },
        {
          "key": "duration",
          "title": "Duration (minutes)",
          "type": "number",
          "required": true,
          "min": 15,
          "max": 480
        },
        {
          "key": "participantCount",
          "title": "Number of Participants",
          "type": "number",
          "required": true,
          "min": 1
        },
        {
          "key": "role",
          "title": "Your Role",
          "type": "select",
          "required": true,
          "options": ["Facilitator/Instructor", "Participant", "Organizer", "Mentor", "Observer"]
        },
        {
          "key": "experienceLevel",
          "title": "Target Audience Experience Level",
          "type": "select",
          "required": true,
          "options": ["New to Web3", "Beginner", "Intermediate", "Advanced", "Mixed Levels"]
        },
        {
          "key": "ecosystem",
          "title": "Primary Chain/Ecosystem",
          "type": "select",
          "required": true,
          "options": ["Ethereum/L2s", "Arbitrum", "Optimism", "Base", "Celo", "Polygon", "Multi-chain", "Chain-agnostic", "Other"]
        },
        {
          "key": "topics",
          "title": "Topics Covered",
          "type": "select",
          "required": true,
          "multiple": true,
          "options": [
            "Regenerative finance (ReFi)",
            "Impact measurement/MRV",
            "Grant funding/Allo/Gitcoin",
            "Identity & attestations (EAS)",
            "DeFi/staking basics",
            "Governance mechanisms",
            "Smart accounts/Account abstraction",
            "Hypercerts/Impact certificates",
            "Conviction Voting",
            "Developer tooling",
            "Community building",
            "Other"
          ]
        },
        {
          "key": "toolsUsed",
          "title": "Tools/Platforms Used",
          "type": "select",
          "required": false,
          "multiple": true,
          "options": ["Green Goods", "Karma GAP", "Gitcoin Passport", "Safe", "Juicebox", "Snapshot", "Tally", "Other"]
        },
        {
          "key": "artizenFunded",
          "title": "Artizen Fund Supported?",
          "type": "select",
          "required": false,
          "options": ["Yes", "No", "Pending Application"]
        }
      ]
    }
  }
}
```

### 4.4 Attendance Verification Schema (for Artizen Fund Compliance)

```json
{
  "title": "Event Attendance",
  "description": "Verify individual attendance at a workshop or event. Used for Artizen Fund compliance and credential issuance.",
  "capitals": ["INTELLECTUAL", "SOCIAL"],
  "uiConfig": {
    "media": {
      "title": "Attendance Proof",
      "description": "Take a photo showing your presence at the event (selfie with event banner, screen, or group).",
      "maxImageCount": 3,
      "required": true
    },
    "details": {
      "inputs": [
        {
          "key": "eventId",
          "title": "Event ID/Name",
          "type": "text",
          "required": true
        },
        {
          "key": "checkInTime",
          "title": "Check-in Time",
          "type": "datetime",
          "required": true
        },
        {
          "key": "engagementLevel",
          "title": "Engagement Level",
          "type": "select",
          "required": true,
          "options": ["Active Participant", "Observer", "Presenter/Speaker", "Helper/Volunteer"]
        },
        {
          "key": "learningOutcome",
          "title": "Key Learning/Takeaway",
          "type": "textarea",
          "required": true,
          "placeholder": "Describe one thing you learned or will apply..."
        },
        {
          "key": "nextAction",
          "title": "Planned Next Step",
          "type": "text",
          "required": false,
          "placeholder": "e.g., 'Pilot Green Goods with local chapter'"
        }
      ]
    }
  }
}
```

### 4.5 Verification Requirements

| Action | Operator Verification | Evaluator Certification | On-chain Proof |
|--------|----------------------|------------------------|----------------|
| Workshop hosted | Attendance list + photos | Chapter steward confirmation | Event attestation |
| Attendance verified | Photo proof + engagement check | Cross-reference with event records | Attendance attestation |
| Learning completed | Assessment review | Instructor confirmation | Credential attestation (NFT) |

### 4.6 Impact Metrics (Education Domain)

- **Workshops Hosted:** Total count by type
- **Participants Trained:** Unique individuals across all sessions
- **New Web3 Users Onboarded:** First-time wallet creators
- **Completion Rate:** Percentage completing full curriculum
- **Follow-up Actions:** Documented applications of learning
- **Geographic Reach:** Countries/regions served
- **Artizen Fund Compliance Rate:** Verified vs. funded events

---

## Domain 5: Mutual Credit & Farmer Verification (DePIN + DeSci)

### 5.1 Context: Commitment Pooling in Brasil

Rural farmers often lack access to credit due to inability to verify their productive capacity. Green Goods serves as the verification tool for commitment pooling pilots in Brasil, where farmers demonstrate consistent agricultural output to unlock mutual credit lines.

### 5.2 Action Lifecycle: Farmer Verification

| Phase | Action Type | Description | Verification Evidence |
|-------|-------------|-------------|----------------------|
| **Farm Registration** | `farm_registered` | Document farm location, size, crops | GPS boundaries, land ownership proof, crop inventory |
| **Planting Season** | `season_planted` | Record what was planted, when, where | Planting photos, seed receipts, area planted |
| **Growth Monitoring** | `growth_documented` | Regular updates on crop progress | Photos over time, growth measurements |
| **Harvest Documentation** | `harvest_recorded` | Record harvest quantity and quality | Harvest photos, weight/count, quality grade |
| **Sale/Distribution** | `sale_completed` | Document where produce went | Buyer receipt, market photos, price achieved |
| **Commitment Fulfilled** | `commitment_fulfilled` | Demonstrate completion of stated commitment | Summary of promised vs. delivered output |

### 5.3 Farmer Verification Action Schema

```json
{
  "title": "Harvest Documentation",
  "description": "Document harvest from your farm for commitment pooling verification. This record helps establish your productive capacity for credit access.",
  "capitals": ["MATERIAL", "FINANCIAL", "LIVING"],
  "uiConfig": {
    "media": {
      "title": "Harvest Evidence",
      "description": "Photograph the harvest: crops in field, weighing/measuring, storage, and any quality indicators.",
      "maxImageCount": 10,
      "required": true
    },
    "details": {
      "inputs": [
        {
          "key": "cropType",
          "title": "Crop Type",
          "type": "select",
          "required": true,
          "options": ["Vegetable", "Fruit", "Grain", "Legume", "Root Crop", "Leafy Green", "Coffee", "Cacao", "Other"]
        },
        {
          "key": "cropName",
          "title": "Specific Crop Name",
          "type": "text",
          "required": true,
          "placeholder": "e.g., Tomato, Cassava, Coffee Arabica"
        },
        {
          "key": "quantity",
          "title": "Harvest Quantity (kg)",
          "type": "number",
          "required": true,
          "min": 0.1,
          "step": 0.1
        },
        {
          "key": "qualityGrade",
          "title": "Quality Grade",
          "type": "select",
          "required": true,
          "options": ["Premium/Grade A", "Standard/Grade B", "Economy/Grade C", "Processing Grade"]
        },
        {
          "key": "areaHarvested",
          "title": "Area Harvested (hectares)",
          "type": "number",
          "required": true,
          "min": 0.01,
          "step": 0.01
        },
        {
          "key": "estimatedValue",
          "title": "Estimated Market Value (local currency)",
          "type": "number",
          "required": false
        },
        {
          "key": "intendedUse",
          "title": "Intended Use",
          "type": "select",
          "required": true,
          "options": ["Direct Sale", "Cooperative Sale", "Processing", "Personal Consumption", "Seed Saving", "Mixed"]
        },
        {
          "key": "commitmentPoolId",
          "title": "Commitment Pool ID (if applicable)",
          "type": "text",
          "required": false,
          "placeholder": "Reference to linked commitment pool"
        }
      ]
    }
  }
}
```

### 5.4 Verification Requirements

| Action | Operator Verification | Evaluator Certification | On-chain Proof |
|--------|----------------------|------------------------|----------------|
| Farm registered | GPS verification, ownership check | Cooperative confirmation | Farm attestation |
| Harvest recorded | Photo review, yield plausibility | Buyer confirmation (if sold) | Harvest attestation |
| Commitment fulfilled | Output vs. commitment comparison | Pool administrator verification | Fulfillment attestation (credit-unlocking) |

### 5.5 Impact Metrics (Mutual Credit Domain)

- **Farms Registered:** Total verified farms
- **Harvest Volume:** Total kg documented
- **Commitment Fulfillment Rate:** Percentage meeting stated targets
- **Credit Unlocked:** Value of credit lines enabled
- **Yield per Hectare:** Productivity metrics by crop
- **Market Access Improvement:** Change in sale prices achieved

---

## Schema Registry: Complete Action Catalog

### Core Actions (Available in All Gardens)

| Action ID | Title | Capitals | Primary Domain |
|-----------|-------|----------|----------------|
| ACT-001 | Planting | LIVING, MATERIAL, EXPERIENTIAL | Agroforestry |
| ACT-002 | Identify Plant | LIVING, INTELLECTUAL, EXPERIENTIAL | Agroforestry |
| ACT-003 | Watering | LIVING, MATERIAL, EXPERIENTIAL | Agroforestry |
| ACT-004 | Harvesting | LIVING, MATERIAL, EXPERIENTIAL | Agroforestry, Mutual Credit |
| ACT-005 | Waste Cleanup | MATERIAL, SOCIAL, EXPERIENTIAL | Waste Management |
| ACT-006 | Web3 Workshop | INTELLECTUAL, SOCIAL, EXPERIENTIAL | Education |

### Domain-Specific Actions

| Action ID | Title | Capitals | Domain | Availability |
|-----------|-------|----------|--------|--------------|
| ACT-101 | Solar Hub Session | MATERIAL, INTELLECTUAL, SOCIAL | Solar Infrastructure | TAS Gardens only |
| ACT-102 | Node Deployment | MATERIAL, FINANCIAL | Solar Infrastructure | TAS Gardens only |
| ACT-103 | Energy Meter Reading | MATERIAL | Solar Infrastructure | TAS Gardens only |
| ACT-201 | Waste Sorting | MATERIAL, INTELLECTUAL | Waste Management | Waste-focused Gardens |
| ACT-202 | Recycling Delivery | MATERIAL, FINANCIAL | Waste Management | Waste-focused Gardens |
| ACT-301 | Tree Assignment | LIVING, SOCIAL, CULTURAL | Agroforestry | Educational Gardens |
| ACT-302 | Knowledge Documentation | INTELLECTUAL, CULTURAL | Agroforestry | AgroforestryDAO Gardens |
| ACT-401 | Event Attendance | INTELLECTUAL, SOCIAL | Education | All Gardens |
| ACT-402 | Certificate Issuance | INTELLECTUAL | Education | Certified Programs |
| ACT-501 | Farm Registration | LIVING, MATERIAL | Mutual Credit | Credit Pool Gardens |
| ACT-502 | Commitment Fulfilled | FINANCIAL, MATERIAL | Mutual Credit | Credit Pool Gardens |

### Eight Forms of Capital Reference

Green Goods actions are tagged with the forms of capital they create or enhance:

| Capital | Description | Example Actions |
|---------|-------------|-----------------|
| **LIVING** | Biodiversity, ecosystems, soil, water | Planting, Watering, Observation |
| **MATERIAL** | Physical infrastructure, equipment, land | Solar installation, Waste collection |
| **FINANCIAL** | Money, credit, investment | Harvest sale, Credit unlocking |
| **SOCIAL** | Relationships, trust, networks | Community cleanup, Workshop hosting |
| **INTELLECTUAL** | Knowledge, skills, data | Knowledge documentation, Training |
| **EXPERIENTIAL** | Wisdom from practice, tacit knowledge | All hands-on actions |
| **CULTURAL** | Traditions, identity, meaning | Traditional practice documentation |
| **SPIRITUAL** | Purpose, connection, meaning | Community ceremonies (future) |

---

## Implementation Priority

### Phase 1 (v1 Launch - Q1 2026)

**Actions to ship:**
- ACT-001 Planting (enhanced with caretaker assignment)
- ACT-002 Identify Plant
- ACT-003 Watering
- ACT-004 Harvesting
- ACT-005 Waste Cleanup (enhanced with categories)
- ACT-006 Web3 Workshop (enhanced)

**Gardens to activate:**
- Greenpill Nigeria (TAS)
- Greenpill Brasil (AgroforestryDAO)
- Greenpill Cape Town (Waste)
- DevConnect/Event Gardens

### Phase 2 (v1.5 - Q2 2026)

**Actions to add:**
- ACT-101 through ACT-103 (Solar Hub suite)
- ACT-201, ACT-202 (Waste advanced)
- ACT-301, ACT-302 (Agroforestry advanced)
- ACT-401, ACT-402 (Education credentialing)

### Phase 3 (v2 - Q3 2026)

**Actions to add:**
- ACT-501, ACT-502 (Mutual Credit suite)
- IoT sensor integration actions
- AI-verified observation actions

---

## Appendix: Action Schema JSON Files

Full JSON schemas for all actions are maintained in the Green Goods repository at:
`/packages/config/actions.json`

Gardens can customize actions through the Admin Dashboard (Phase 2) or by requesting configuration from the protocol team.
