#!/bin/bash
# Green Goods Branch Creation Script
# Creates a branch from a GitHub issue following naming conventions
#
# Usage: ./scripts/create-branch.sh <issue-number>
# Example: ./scripts/create-branch.sh 123
#
# Output: feat/123-add-dark-mode (based on issue labels and title)

set -e

if [ -z "$1" ]; then
  echo "Usage: ./scripts/create-branch.sh <issue-number>"
  echo "Example: ./scripts/create-branch.sh 123"
  exit 1
fi

ISSUE_NUM=$1

echo "Fetching issue #${ISSUE_NUM}..."

# Get issue details
ISSUE_TITLE=$(gh issue view "$ISSUE_NUM" --json title --jq '.title' 2>/dev/null)
if [ -z "$ISSUE_TITLE" ]; then
  echo "Error: Could not fetch issue #${ISSUE_NUM}"
  exit 1
fi

# Get labels to determine branch type
LABELS=$(gh issue view "$ISSUE_NUM" --json labels --jq '.labels[].name' 2>/dev/null)

# Map labels to branch types
TYPE="feat"
if echo "$LABELS" | grep -qi "bug"; then
  TYPE="fix"
elif echo "$LABELS" | grep -qi "documentation"; then
  TYPE="docs"
elif echo "$LABELS" | grep -qi "polish"; then
  TYPE="polish"
elif echo "$LABELS" | grep -qi "task"; then
  TYPE="task"
elif echo "$LABELS" | grep -qi "enhancement"; then
  TYPE="feat"
fi

# Clean up title for branch name
# - Convert to lowercase
# - Replace spaces with hyphens
# - Remove special characters
# - Limit to 30 characters
CLEAN_TITLE=$(echo "$ISSUE_TITLE" | \
  tr '[:upper:]' '[:lower:]' | \
  tr ' ' '-' | \
  tr -cd '[:alnum:]-' | \
  head -c 30 | \
  sed 's/-$//')

# Construct branch name
BRANCH_NAME="${TYPE}/${ISSUE_NUM}-${CLEAN_TITLE}"

echo ""
echo "Issue: #${ISSUE_NUM} - ${ISSUE_TITLE}"
echo "Labels: ${LABELS:-none}"
echo "Branch: ${BRANCH_NAME}"
echo ""

# Check if branch already exists
if git show-ref --verify --quiet "refs/heads/${BRANCH_NAME}"; then
  echo "Branch already exists. Checking out..."
  git checkout "$BRANCH_NAME"
else
  # Create and checkout new branch
  echo "Creating new branch..."
  git checkout -b "$BRANCH_NAME"
  echo ""
  echo "Branch created and checked out: ${BRANCH_NAME}"
fi

echo ""
echo "Ready to work on issue #${ISSUE_NUM}"
