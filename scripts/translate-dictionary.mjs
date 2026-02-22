#!/usr/bin/env node
/**
 * 1. Remove abbreviations (xhtml, ng, etc.)
 * 2. Translate all words via Google Translate (en -> ru) with dt=at for synonyms;
 *    each entry is stored as string[] (several variants).
 * 3. Add phrasal verbs from scripts/phrasal-verbs-ru.json (no API)
 *
 * Usage:
 *   node scripts/translate-dictionary.mjs --quick   # only remove abbrevs + merge phrasal from JSON
 *   node scripts/translate-dictionary.mjs            # full: translate ALL words with synonyms (~1.5h), then merge phrasal
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DICT_PATH = join(__dirname, '../public/dictionary.json');
const PHRASAL_PATH = join(__dirname, 'phrasal-verbs-ru.json');
const ABBREVIATIONS = ['xhtml', 'ng'];
const DELAY_MS = Number(process.env.TRANSLATE_DELAY_MS) || 1200;
const QUICK = process.argv.includes('--quick');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Получить несколько вариантов перевода (синонимы) через Google Translate (dt=at).
 * @param {string} en — слово на английском
 * @returns {Promise<string[] | null>} — массив уникальных вариантов на русском или null
 */
async function translateWordWithSynonyms(en) {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ru&dt=t&dt=at&q=${encodeURIComponent(en)}`;
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const variants = new Set();

    if (Array.isArray(data) && Array.isArray(data[0]) && data[0][0] != null && typeof data[0][0][0] === 'string') {
      variants.add(data[0][0][0].trim());
    }
    if (Array.isArray(data[1])) {
      for (const block of data[1]) {
        if (Array.isArray(block) && Array.isArray(block[1])) {
          for (const v of block[1]) {
            if (typeof v === 'string' && v.trim()) variants.add(v.trim());
          }
        }
      }
    }

    return variants.size > 0 ? [...variants] : null;
  } catch (e) {
    console.error(`Translate failed for "${en}":`, e.message);
    return null;
  }
}

/** Нормализовать значение словаря в массив (для обратной совместимости со старым форматом string). */
function toArray(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value.filter((s) => typeof s === 'string' && s.trim());
  return [String(value).trim()].filter(Boolean);
}

async function main() {
  const dict = JSON.parse(readFileSync(DICT_PATH, 'utf8'));

  // 1. Remove abbreviations
  for (const abbr of ABBREVIATIONS) {
    if (dict[abbr] !== undefined) {
      delete dict[abbr];
      console.log('Removed:', abbr);
    }
  }

  // 2. Translate with synonyms (dt=at); store as string[]
  const keys = Object.keys(dict);
  let translated = 0;
  const SAVE_EVERY = 200;
  if (!QUICK) {
    for (let i = 0; i < keys.length; i++) {
      const en = keys[i];
      const variants = await translateWordWithSynonyms(en);
      if (variants && variants.length > 0) {
        dict[en] = variants;
        translated++;
        if (translated % 50 === 0) console.log(`Translated ${translated}/${keys.length}...`);
        if (translated % SAVE_EVERY === 0) {
          writeFileSync(DICT_PATH, JSON.stringify(dict), 'utf8');
          console.log('Progress saved.');
        }
      }
      await sleep(DELAY_MS);
    }
    console.log('Total translated:', translated);
  } else {
    console.log('Quick mode: skipping full translation.');
    // Normalize existing entries to array format (optional, for consistency)
    for (const en of keys) {
      const v = dict[en];
      if (typeof v === 'string' && v.trim()) dict[en] = [v.trim()];
    }
  }

  // 3. Add phrasal verbs from JSON (value can be string or string[])
  const phrasal = JSON.parse(readFileSync(PHRASAL_PATH, 'utf8'));
  let added = 0;
  for (const [en, ru] of Object.entries(phrasal)) {
    if (dict[en] === undefined) {
      dict[en] = Array.isArray(ru) ? ru : [String(ru).trim()];
      added++;
    }
  }
  console.log('Phrasal verbs merged:', added);

  writeFileSync(DICT_PATH, JSON.stringify(dict), 'utf8');
  console.log('Saved', DICT_PATH);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
