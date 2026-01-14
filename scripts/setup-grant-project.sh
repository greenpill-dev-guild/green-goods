#!/bin/bash

# =============================================================================
# Setup Arbitrum Grant Project Board
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

REPO="greenpill-dev-guild/green-goods"
ORG="greenpill-dev-guild"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Arbitrum Grant Project Board Setup${NC}"
echo -e "${BLUE}========================================${NC}"

# Check if gh is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}Error: GitHub CLI (gh) is not installed${NC}"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo -e "${RED}Error: Not authenticated with GitHub CLI${NC}"
    exit 1
fi

# Check if project already exists
echo -e "${YELLOW}Checking for existing project...${NC}"
PROJECT_NUMBER=$(gh project list --owner $ORG --format json | jq -r '.projects[] | select(.title | contains("Green Goods")) | .number' | head -1)

if [ -z "$PROJECT_NUMBER" ]; then
    echo -e "${YELLOW}Creating new project board...${NC}"
    PROJECT_NUMBER=$(gh project create --owner $ORG --title "Green Goods - Arbitrum Grant" --format json | jq -r '.number')
    echo -e "${GREEN}Created project #${PROJECT_NUMBER}${NC}"
else
    echo -e "${GREEN}Found existing project #${PROJECT_NUMBER}${NC}"
fi

# Add custom fields to project
echo -e "${YELLOW}Setting up project fields...${NC}"

# Get project ID
PROJECT_ID=$(gh project list --owner $ORG --format json | jq -r ".projects[] | select(.number == $PROJECT_NUMBER) | .id")

# Create custom fields (these may fail if they already exist)
gh project field-create $PROJECT_NUMBER --owner $ORG --name "Budget" --data-type TEXT 2>/dev/null || true
gh project field-create $PROJECT_NUMBER --owner $ORG --name "Area" --data-type SINGLE_SELECT --single-select-options "Growth,Finance,PM,Product,UI,Community,Marketing,QA,Engineering" 2>/dev/null || true

echo -e "${GREEN}Project fields configured${NC}"

# Add all grant issues to the project
echo -e "${YELLOW}Adding issues to project...${NC}"

# Get all issues with grant label
ISSUES=$(gh issue list --repo $REPO --label grant --json number --jq '.[].number')

for ISSUE in $ISSUES; do
    echo -e "Adding issue #${ISSUE}..."
    gh project item-add $PROJECT_NUMBER --owner $ORG --url "https://github.com/$REPO/issues/$ISSUE" 2>/dev/null || true
done

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Project board setup complete!${NC}"
echo -e "${GREEN}========================================${NC}"

echo -e "\nView your project at:"
echo -e "${BLUE}https://github.com/orgs/$ORG/projects/$PROJECT_NUMBER${NC}"

echo -e "\n${YELLOW}Manual steps:${NC}"
echo "1. Configure project views (Board, Table, Roadmap)"
echo "2. Set up status automations"
echo "3. Group by milestone or area"
