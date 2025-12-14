# Actions Configuration Guide

This document explains how to configure actions and templates for the Green Goods protocol.

## Overview

The `actions.json` file is a single source of truth for:
- **Templates**: Reusable instruction templates for different action types
- **Actions**: Specific actions deployed on-chain with their UI configurations

During deployment, actions reference templates to generate complete instruction documents uploaded to IPFS.

## File Structure

```json
{
  "templates": {
    "keyword": {
      "steps": [...],
      "requirements": {...},
      "tips": [...]
    },
    "alias": {
      "aliasFor": "keyword"
    }
  },
  "actions": [
    {
      "title": "Action Name",
      "description": "...",
      "capitals": [...],
      "startTime": "...",
      "endTime": "...",
      "media": [...],
      "uiConfig": {...}
    }
  ]
}
```

## Templates

Templates define reusable instruction content matched by keywords in action titles.

### Template Structure

```json
{
  "keyword": {
    "steps": [
      "Step 1: What to do first",
      "Step 2: What to do next",
      "Step 3: Final step"
    ],
    "requirements": {
      "materials": [
        "Item 1",
        "Item 2 (optional)"
      ],
      "skills": [
        "Skill 1",
        "Skill 2"
      ],
      "timeEstimate": "30-60 minutes"
    },
    "tips": [
      "Helpful tip 1",
      "Helpful tip 2",
      "Helpful tip 3"
    ]
  }
}
```

### Template Matching

Templates are matched by checking if the action title (lowercase) contains the keyword:

```
"Watering Plants" → matches "water" template
"Identify Plant"  → matches "identify" template
"Waste Cleanup"   → matches "waste" → "litter" template (alias)
"Planting"        → matches "plant" template
"Unknown Action"  → matches "default" template
```

**Priority order**: `identify`, `observe`, `water`, `litter`, `waste`, `plant`, `default`

More specific keywords come first to avoid false matches (e.g., "Identify Plant" should match `identify`, not `plant`).

### Template Aliases

Use aliases to reuse templates for similar action types:

```json
{
  "litter": {
    "steps": [...],
    "requirements": {...},
    "tips": [...]
  },
  "waste": {
    "aliasFor": "litter"
  }
}
```

Now both "Litter Cleanup" and "Waste Removal" actions will use the same template.

## Actions

Actions define on-chain deployable work items with UI configurations.

### Action Structure

```json
{
  "title": "Watering",
  "description": "Document watering activities...",
  "capitals": ["LIVING", "MATERIAL", "EXPERIENTIAL"],
  "startTime": "2024-01-01T00:00:00Z",
  "endTime": "2025-12-31T23:59:59Z",
  "media": [
    "QmMediaHash1",
    "QmMediaHash2"
  ],
  "uiConfig": {
    "media": {
      "title": "Capture Photos",
      "description": "Take photos of your work",
      "maxImageCount": 7,
      "required": false
    },
    "details": {
      "title": "Input Details",
      "description": "Provide details about your work",
      "feedbackPlaceholder": "Feedback placeholder text",
      "inputs": [
        {
          "key": "fieldName",
          "title": "Field Label",
          "placeholder": "Field placeholder",
          "type": "text|number|select",
          "required": true,
          "options": []
        }
      ]
    },
    "review": {
      "title": "Review Details",
      "description": "Review before submitting"
    }
  }
}
```

### UI Config Input Types

**Text Input:**
```json
{
  "key": "plantName",
  "title": "Plant Species/Name",
  "placeholder": "Enter the plant species",
  "type": "text",
  "required": true,
  "options": []
}
```

**Number Input:**
```json
{
  "key": "waterAmount",
  "title": "Water Amount (liters)",
  "placeholder": "Enter amount",
  "type": "number",
  "required": true,
  "min": 0,
  "step": 0.1,
  "options": []
}
```

**Select Input (Single):**
```json
{
  "key": "wateringMethod",
  "title": "Watering Method",
  "placeholder": "Select method",
  "type": "select",
  "required": true,
  "options": ["Watering can", "Hose", "Sprinkler", "Other"]
}
```

**Select Input (Multiple):**
```json
{
  "key": "plantSelection",
  "title": "Plants Watered",
  "placeholder": "Select species",
  "type": "select",
  "required": false,
  "multiple": true,
  "options": ["Tree", "Shrub", "Flower", "Grass", "Other"]
}
```

## Adding a New Action Type

### Step 1: Add Template (if needed)

If your action type is new, add a template:

```json
{
  "templates": {
    "harvest": {
      "steps": [
        "Assess harvest readiness",
        "Gather harvesting tools",
        "Document harvest with photos",
        "Harvest carefully to avoid damage",
        "Record quantity and quality",
        "Store or distribute harvest appropriately"
      ],
      "requirements": {
        "materials": [
          "Harvest tools (knife, scissors, basket)",
          "Storage containers",
          "Camera or smartphone"
        ],
        "skills": [
          "Harvest timing knowledge",
          "Quality assessment",
          "Proper handling techniques"
        ],
        "timeEstimate": "30-90 minutes"
      },
      "tips": [
        "Harvest at optimal time of day (usually morning)",
        "Handle produce carefully to avoid bruising",
        "Track harvest yield over time for planning",
        "Document any pest or disease issues"
      ]
    }
  }
}
```

### Step 2: Add Action

Add the action to the `actions` array:

```json
{
  "actions": [
    {
      "title": "Harvesting",
      "description": "Document harvest activities including crop type, quantity, and quality. Track yields and support food production efforts.",
      "capitals": ["LIVING", "MATERIAL", "EXPERIENTIAL"],
      "startTime": "2024-01-01T00:00:00Z",
      "endTime": "2025-12-31T23:59:59Z",
      "media": ["QmHarvestPlaceholder"],
      "uiConfig": {
        "media": {
          "title": "Capture Harvest Photos",
          "description": "Take photos of the harvest, including before/after shots",
          "maxImageCount": 7,
          "required": false
        },
        "details": {
          "title": "Input Harvest Details",
          "description": "Provide details about the harvest",
          "feedbackPlaceholder": "Notes about harvest quality, challenges, etc.",
          "inputs": [
            {
              "key": "cropType",
              "title": "Crop Type",
              "placeholder": "Select crop harvested",
              "type": "select",
              "required": true,
              "options": ["Vegetable", "Fruit", "Herb", "Grain", "Other"]
            },
            {
              "key": "quantity",
              "title": "Quantity Harvested (kg)",
              "placeholder": "Enter weight in kilograms",
              "type": "number",
              "required": true,
              "min": 0,
              "step": 0.1,
              "options": []
            },
            {
              "key": "quality",
              "title": "Quality Assessment",
              "placeholder": "Select quality level",
              "type": "select",
              "required": false,
              "options": ["Excellent", "Good", "Fair", "Poor"]
            }
          ]
        },
        "review": {
          "title": "Review Harvest Details",
          "description": "Review details before submitting"
        }
      }
    }
  ]
}
```

### Step 3: Deploy

```bash
cd packages/contracts

# Dry run first
bun deploy:dry

# Deploy to testnet
bun deploy:testnet
```

The deployment will:
1. Load `actions.json`
2. Match "Harvesting" action to "harvest" template
3. Generate complete instruction document
4. Upload to IPFS via Storacha
5. Register action on-chain with IPFS hash

## Validation

Before committing changes:

```bash
# Validate JSON structure
node -e "JSON.parse(require('fs').readFileSync('config/actions.json', 'utf8'))"

# Test template matching
node -e "
  const data = JSON.parse(require('fs').readFileSync('config/actions.json', 'utf8'));
  console.log('Templates:', Object.keys(data.templates).join(', '));
  console.log('Actions:', data.actions.length);
"
```

## Capitals Reference

Available capital types for actions:
- `LIVING` - Natural/living capital (plants, ecosystems)
- `MATERIAL` - Physical resources (tools, infrastructure)
- `SOCIAL` - Community/relationship building
- `EXPERIENTIAL` - Knowledge/learning
- `INTELLECTUAL` - Innovation/ideas
- `FINANCIAL` - Economic value

Choose 2-3 capitals that best represent the action's impact.

## IPFS Media Hashes

For new actions, use placeholder hashes initially:
```json
"media": [
  "QmPlaceholder1",
  "QmPlaceholder2"
]
```

Replace with actual IPFS hashes after uploading real images:
1. Upload images to Storacha (or Pinata)
2. Get CID (Content Identifier)
3. Update `media` array in `actions.json`
4. Redeploy with `--update-schemas` flag

## Deployment Workflow

```bash
# 1. Edit actions.json
vim config/actions.json

# 2. Validate
node -e "JSON.parse(require('fs').readFileSync('config/actions.json', 'utf8'))"

# 3. Dry run
bun deploy:dry

# 4. Deploy to testnet
bun deploy:testnet

# 5. Verify on-chain
cast call $ACTION_REGISTRY "getAction(uint256)" 1 --rpc-url $RPC
```

## Troubleshooting

**Template not matching:**
- Check keyword priority order in `ipfs-uploader.js`
- Ensure action title contains the template keyword
- Add new keyword to priority array if needed

**IPFS upload failing:**
- Verify `STORACHA_KEY` and `STORACHA_PROOF` in `.env`
- Check `.ipfs-cache.json` for cached hashes
- Use `--force` flag to skip cache

**Schema validation errors:**
- Ensure all required fields present
- Check JSON syntax (commas, brackets)
- Validate with `node -e` command above

## Reference

- Deployment script: `script/deploy.js`
- IPFS uploader: `script/utils/ipfs-uploader.js`
- Deployment guide: `/docs/DEPLOYMENT.md`
- Contracts handbook: `/docs/CONTRACTS_HANDBOOK.md`

