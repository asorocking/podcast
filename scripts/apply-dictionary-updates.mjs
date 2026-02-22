#!/usr/bin/env node
/**
 * Apply dictionary updates without API calls:
 * 1. Remove abbreviations (xhtml, ng)
 * 2. Add phrasal verbs with pre-translated Russian
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DICT_PATH = join(__dirname, '../public/dictionary.json');
const PHRASAL_PATH = join(__dirname, 'phrasal-verbs-ru.json');
const ABBREVIATIONS = ['xhtml', 'ng'];

const dict = JSON.parse(readFileSync(DICT_PATH, 'utf8'));
const phrasal = JSON.parse(readFileSync(PHRASAL_PATH, 'utf8'));

for (const abbr of ABBREVIATIONS) {
  if (dict[abbr] !== undefined) {
    delete dict[abbr];
    console.log('Removed:', abbr);
  }
}

let added = 0;
for (const [en, ru] of Object.entries(phrasal)) {
  if (dict[en] === undefined) {
    dict[en] = ru;
    added++;
  }
}
console.log('Phrasal verbs added:', added);

writeFileSync(DICT_PATH, JSON.stringify(dict), 'utf8');
console.log('Saved. Total entries:', Object.keys(dict).length);
