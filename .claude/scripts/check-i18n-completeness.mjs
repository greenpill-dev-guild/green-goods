#!/usr/bin/env node
/**
 * Green Goods i18n Completeness Checker
 *
 * Ensures all translation keys exist in en.json, es.json, and pt.json
 * Run: node .claude/scripts/check-i18n-completeness.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const I18N_PATH = path.join(__dirname, '../../packages/shared/src/i18n');

const LANGUAGES = ['en', 'es', 'pt'];

function loadTranslations(lang) {
  const filePath = path.join(I18N_PATH, `${lang}.json`);
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Failed to load ${lang}.json:`, error.message);
    return null;
  }
}

function flattenKeys(obj, prefix = '') {
  const keys = new Set();
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null) {
      flattenKeys(value, fullKey).forEach(k => keys.add(k));
    } else {
      keys.add(fullKey);
    }
  }
  return keys;
}

function main() {
  console.log('🌿 Checking i18n completeness across the garden...\n');

  const translations = {};
  const allKeys = new Set();

  // Load all translation files
  for (const lang of LANGUAGES) {
    const data = loadTranslations(lang);
    if (!data) {
      process.exit(1);
    }
    translations[lang] = data;
    flattenKeys(data).forEach(key => allKeys.add(key));
  }

  // Check for missing keys in each language
  const issues = [];

  for (const key of allKeys) {
    for (const lang of LANGUAGES) {
      const keys = flattenKeys(translations[lang]);
      if (!keys.has(key)) {
        issues.push({ key, missingIn: lang });
      }
    }
  }

  if (issues.length === 0) {
    console.log('✅ All translation keys are present in en, es, and pt.');
    console.log(`   Total keys: ${allKeys.size}`);
    process.exit(0);
  } else {
    console.log('❌ Missing translations found:\n');

    const byLang = {};
    for (const issue of issues) {
      if (!byLang[issue.missingIn]) byLang[issue.missingIn] = [];
      byLang[issue.missingIn].push(issue.key);
    }

    for (const [lang, keys] of Object.entries(byLang)) {
      console.log(`  ${lang}.json is missing ${keys.length} key(s):`);
      keys.slice(0, 10).forEach(k => console.log(`    - ${k}`));
      if (keys.length > 10) {
        console.log(`    ... and ${keys.length - 10} more`);
      }
      console.log('');
    }

    console.log('The garden needs all three languages to flourish.');
    process.exit(1);
  }
}

main();
