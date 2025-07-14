#!/bin/bash

echo "🔧 Formatting all files with Biome..."

# Format all files
npx biome format --write .

echo "✅ Files formatted successfully!"

echo "📝 Adding formatted files to git..."
git add .

echo "🚀 Committing changes..."
git commit -m "docs: update README with HTTPS access note and remove outdated sections

- Updated the client application access URL in the README to reflect HTTPS usage due to mkcert plugin for PWA features.
- Removed outdated sections detailing the structure of the src directory and configuration files to streamline the documentation.
- Fixed Biome configuration to include tests directory and formatting
- Updated all configurations to use HTTPS for client service due to mkcert"

echo "📤 Pushing to remote branch..."
git push -u origin feat/celo-integration

echo "✅ Successfully pushed to remote!" 