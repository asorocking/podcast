/**
 * Builds dictionary.json with Russian translations.
 * Merges existing public/dictionary.json with words from Oxford 5000 + Google 20k.
 * Fills missing translations from open EN-RU dictionary (spishniak/rus-eng-eng-rus-txt-json).
 * Words still without translation get "—" (shown as "нет в словаре" in the app).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dictPath = path.join(__dirname, '../public/dictionary.json');
const itCuratedPath = path.join(__dirname, 'it-curated.json');
const TARGET = 10000;
const EN_RU_DICT_URL = 'https://raw.githubusercontent.com/spishniak/rus-eng-eng-rus-txt-json/master/eng-rus.json';

const existing = JSON.parse(fs.readFileSync(dictPath, 'utf8'));
let itCurated = {};
try {
  const raw = JSON.parse(fs.readFileSync(itCuratedPath, 'utf8'));
  itCurated = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k.toLowerCase().trim(), v]));
  console.log(`Loaded ${Object.keys(itCurated).length} IT-curated translations (priority over external dict)`);
} catch (e) {
  console.warn('IT-curated dictionary not found, skipping:', e.message);
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed: ${url}`);
  return res.text();
}

/** Normalize Russian translation to sentence case (first letter upper, rest lower) */
function normalizeRu(tr) {
  const s = tr.trim();
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/** Build lowercase key -> single Russian translation (first variant) from eng-rus.json */
function buildEnRuMap(rawJson) {
  const data = JSON.parse(rawJson);
  const map = new Map();
  for (const [en, ruList] of Object.entries(data)) {
    const key = en.toLowerCase().trim();
    if (!key || map.has(key)) continue;
    const tr = Array.isArray(ruList) ? ruList[0] : ruList;
    if (tr && typeof tr === 'string' && tr !== '—') map.set(key, normalizeRu(tr));
  }
  return map;
}

/** Try to get translation by stripping common English suffixes and looking up base form. Prefers itCurated. */
function lookupByBaseForm(word, enRuMap, itCurated = {}) {
  const w = word.toLowerCase();
  const tryBases = (...candidates) => {
    for (const b of candidates) {
      if (!b || b.length < 2) continue;
      if (itCurated[b]) return itCurated[b];
      if (enRuMap.has(b)) return enRuMap.get(b);
    }
    return null;
  };
  // Transcript-style: breakin -> breaking
  if (w.endsWith('in') && w.length > 5) {
    const withG = w.slice(0, -1) + 'g';
    if (itCurated[withG]) return itCurated[withG];
    if (enRuMap.has(withG)) return enRuMap.get(withG);
  }
  if (enRuMap.has(w)) return enRuMap.get(w);
  if (w.endsWith('ing') && w.length > 5) {
    const stem = w.slice(0, -3);
    let r = tryBases(stem);
    if (r) return r;
    if (stem.length >= 2 && stem[stem.length - 1] === stem[stem.length - 2]) r = tryBases(stem.slice(0, -1));
    if (r) return r;
    return tryBases(stem + 'e');
  }
  if (w.endsWith('ed') && w.length > 4) {
    const stem = w.slice(0, -2);
    const r = tryBases(stem, stem + 'e');
    if (r) return r;
  }
  // plurals: properties -> property, abilities -> ability
  if (w.endsWith('ies') && w.length > 4) {
    const base = w.slice(0, -3) + 'y';
    const r = tryBases(base);
    if (r) return r;
  }
  const suffixes = [
    ['ly', 2], ['ily', 3], ['er', 2], ['est', 3], ['ness', 4], ['ment', 4],
    ['tion', 4], ['ity', 3], ['ful', 3], ['less', 4], ['es', 2], ['s', 1],
  ];
  for (const [suf, len] of suffixes) {
    if (!w.endsWith(suf) || w.length <= len + 2) continue;
    const base = w.slice(0, -len);
    const r = tryBases(base);
    if (r) return r;
    if (suf === 'tion' && enRuMap.has(base + 't')) return enRuMap.get(base + 't');
    if (suf === 'ity' && enRuMap.has(base + 'e')) return enRuMap.get(base + 'e');
  }
  return null;
}

const LIBRETRANSLATE_URL = 'https://libretranslate.com/translate';

/** Translate one word via LibreTranslate (often better for IT terms). */
async function translateOneLibreTranslate(word) {
  try {
    const res = await fetch(LIBRETRANSLATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: word, source: 'en', target: 'ru', format: 'text' }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const tr = data?.translatedText?.trim();
    if (tr && tr !== word && /[\u0400-\u04FF]/.test(tr)) return normalizeRu(tr);
  } catch (e) {
    // ignore
  }
  return null;
}

/** Translate one word via MyMemory API. */
async function translateOneMyMemory(word) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|ru`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.responseStatus === 200 && data.responseData?.translatedText) {
    const tr = data.responseData.translatedText.trim();
    if (tr && tr !== word && /[\u0400-\u04FF]/.test(tr)) return normalizeRu(tr);
  }
  return null;
}

/** Try LibreTranslate first, then MyMemory. */
async function translateOneWord(word) {
  const tr = await translateOneLibreTranslate(word);
  if (tr) return tr;
  return translateOneMyMemory(word);
}

/** Translate batch of English words via MyMemory API (free, no key). Returns Map(word -> translation). */
async function translateBatchMyMemory(words, delayMs = 200) {
  const result = new Map();
  const BATCH = 30;
  for (let i = 0; i < words.length; i += BATCH) {
    const batch = words.slice(i, i + BATCH);
    const text = batch.join('\n');
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|ru`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.responseStatus === 200 && data.responseData?.translatedText) {
        const translated = data.responseData.translatedText.split(/\n/).map((s) => s.trim());
        batch.forEach((word, j) => {
          const tr = translated[j] ?? translated[translated.length - 1];
          if (tr && tr !== word && /[\u0400-\u04FF]/.test(tr)) result.set(word, normalizeRu(tr));
        });
      }
    } catch (e) {
      console.warn('MyMemory batch failed:', e.message);
    }
    if (i + BATCH < words.length) await new Promise((r) => setTimeout(r, delayMs));
  }
  return result;
}

async function main() {
  let words = new Set(Object.keys(existing).map((w) => w.toLowerCase()));

  // 1) Fetch external EN-RU dictionary for real translations
  let enRuMap = new Map();
  try {
    console.log('Fetching EN-RU dictionary...');
    const enRuJson = await fetchText(EN_RU_DICT_URL);
    enRuMap = buildEnRuMap(enRuJson);
    console.log(`Loaded ${enRuMap.size} EN-RU translations`);
  } catch (e) {
    console.warn('Could not fetch EN-RU dictionary:', e.message);
  }

  // 2) Fetch word lists to extend coverage
  try {
    const [oxfordText, googleText] = await Promise.all([
      fetchText('https://raw.githubusercontent.com/tgmgroup/Word-List-from-Oxford-Longman-5000/master/Oxford%205000.txt'),
      fetchText('https://raw.githubusercontent.com/first20hours/google-10000-english/master/20k.txt'),
    ]);

    const addWords = (text) => {
      text.split(/\n/).forEach((line) => {
        const w = line.trim().toLowerCase().replace(/^['"]|['"]$/g, '');
        if (w.length >= 2 && /^[a-z'-]+$/i.test(w)) words.add(w);
      });
    };

    addWords(oxfordText);
    addWords(googleText);
  } catch (e) {
    console.warn('Could not fetch word lists:', e.message);
    const fallback = `the of and to a in for is on that by this with i you it not or be are from at as your all have new more an was we will home can us about if page my has search free but our one other do no information time they site he up may what which their news out use any there see only so his when contact here business who web also now help get view online first am been would how were me services some these click its like service than find price date back top people had list name just over state year day into email two health world next used go work last most products music buy data make them should product system post her city add policy number such please available copyright support message after best software then good video well where info rights public books high school through each links she review years order very privacy book items company read group need many user said set under general research university mail full map reviews program life know games way days management part could great united hotel real item international center store travel comments made development report off member details line terms before did send right type because local those using results office education national car design take posted internet address community within states area want phone shipping reserved subject between forum family long based code show even black check special prices website index being women much sign file link open today technology south case project same pages version section own found sports house related security both county american photo game members power while care network down computer systems three total place end following download him without per access think north resources current posts big media law control water history pictures size art personal since including guide shop directory board location change white text small rating rate government children during usa return students shopping account times sites level digital profile previous form events love old main call hours image department title description another shall property class still money quality every listing content country private little visit save tools low reply customer compare movies include college value article man card jobs provide food source author different press learn sale around print course job process teen room stock training too credit point join science men categories advanced west sales look english left team estate box conditions select windows photos thread week category note live large gallery table register however market library really action start series model features air industry plan human provided yes required second hot cost movie better say questions going medical test friend come study application staff articles feedback again play looking issues complete street topic comment financial things working against standard tax person below mobile less got blog party payment equipment login student let programs offers legal above recent park stores side act problem red give memory performance social flight congress fuel walk produced wait supported pocket freedom argument competition creating drugs joint premium providers fresh characters attorney upgrade factor growing thousands stream apartments pick hearing eastern therapy entries dates signed upper serious prime limit began steps errors shops efforts informed quantity urban practices sorted reporting essential platform load labor immediately admin nursing defense machines designated tags heavy covered recovery integrated configuration merchant comprehensive expert universal protect drop solid presentation languages became orange compliance vehicles prevent theme rich campaign marine improvement saying challenge acceptance strategies seem affairs touch intended towards branch charges serve reasons magic mount smart gave ones avoid certified manage corner rank element birth virus abuse interactive requests separate quarter procedure leadership tables define racing religious facts breakfast column plants faith chain developer identify avenue missing died approximately domestic recommendations moved reach comparison mental viewed moment extended sequence inch attack centers opening damage lab reserve produce snow placed truth counter failure follows weekend dollar camp films bridge native fill movement printing owned approval draft chart played contacts readers clubs equal adventure matching offering shirts profit leaders posters institutions assistant variable advertisement expect compared reality handling origin gaming destination technique contracts voting courts notices calculate strip typically representation exists arrangements smooth conferences sitting putting consultant controller committees legislative researchers trailer residence attorneys parameter adapter processor node formal dimensions contribute lock storm micro colleges mile showed challenges editors threads bowl brothers recognition presents tank submission estimate encourage kid regulatory inspection consumers cancel limits territory transaction weapons paint delay pilot outlet contributions continuous resulting initiative novel execution disability increases winner contractor episode examination dish plays bulletin modify adam truly painting committed extensive affordable universe candidate databases slot outstanding eating perspective planned watching lodge messenger mirror tournament consideration discounts sterling sessions kernel stocks buyers journals gray catalogue charged broad chosen demo labour terminal publishers nights liquid rice loop salary reservation foods guard properly saving remaining empire resume twenty newly raise prepare depending expansion vary hundreds helped premier tomorrow purchased milk decide consent drama visiting performing downtown keyboard contest collected bands boot suitable absolutely millions lunch audit push chamber findings muscle featuring scheduled polls typical tower yours sum calculator significantly chicken temporary attend shower sufficient province awareness governor beer contribution measurement spyware formula constitution packaging solar catch reliable consultation doubt earn finder unable classroom tasks attacks memorial visitor twin insert gateway alumni drawing ordered biological fighting transition happens preferences romance instrument split themes powers heaven bits pregnant twice focused physician bargain cellular asking blocks normally spiritual hunting diabetes suit shift chip bodies photographs cutting writers marks flexible favourites mapping numerous relatively birds satisfaction represents indexed superior preferred saved paying cartoon shots intellectual granted choices spending comfortable magnetic interaction listening effectively registry crisis outlook massive employed bright treat poverty formed piano echo grid sheets revolution consolidation displays plasma allowing earnings mystery landscape dependent mechanical journey bidding consultants risks applicant cooperation counties acquisition ports implemented directories recognized blogger notification licensing stands teach occurred textbooks rapid pull diversity reverse deposit seminar sensitive templates formats depends holds router concrete folder completion upload pulse specification accident accessible resident plot possibly airline typically representation regard pump exists arrangements smooth strike consumption sitting putting consultant controller ownership committees residence attorneys density parallel sustainable statistical beds mention innovation operators strange hundred amended operate bills bathroom stable definitions lesson cinema asset scan elections drinking reaction blank enhanced entitled severe generate stainless newspapers hospitals deluxe humor aged exception lived duration bulk successfully fabric visits primarily tight contrast recommendation flying recruitment organized adoption improving expensive meant capture pounds plane programmes desire mechanism camping jewellery meets welfare peer caught eventually marked driven measured bottle agreements considering innovative conclusion closing thousand meat legend grace python monster villa bone columns disorders collaboration detection cookies inner formation tutorial engineers entity gate holder proposals moderator settlement portugal duties valuable erotic tone ethics forever dragon busy captain fantastic imagine brings heating leg neck governments purchasing scripts appointed taste dealing commit tiny operational rail liberal trips gap sides tube turns corresponding descriptions cache belt jacket determination animation oracle`.split(/\s+/);
    fallback.forEach((w) => words.add(w.toLowerCase()));
  }

  const merged = { ...existing };
  const wordArray = [...words];

  const pickTranslation = (key) => {
    const k = key.toLowerCase();
    if (itCurated[k]) return itCurated[k];
    const current = merged[key];
    if (current != null && current !== '—') return current;
    return enRuMap.get(key) ?? lookupByBaseForm(key, enRuMap, itCurated) ?? '—';
  };

  for (let i = 0; i < wordArray.length && Object.keys(merged).length < TARGET; i++) {
    const key = wordArray[i];
    if (!(key in merged)) merged[key] = pickTranslation(key);
  }

  let idx = 0;
  while (Object.keys(merged).length < TARGET && idx < wordArray.length) {
    const key = wordArray[idx++];
    if (!(key in merged)) merged[key] = pickTranslation(key);
  }

  // Replace remaining "—" with translations from EN-RU (direct or by base form)
  let filled = 0;
  for (const key of Object.keys(merged)) {
    if (merged[key] !== '—') continue;
    const tr = enRuMap.get(key) ?? lookupByBaseForm(key, enRuMap, itCurated);
    if (tr) {
      merged[key] = tr;
      filled++;
    }
  }
  if (filled) console.log(`Filled ${filled} entries from EN-RU (direct + base form)`);

  // Translate still missing via MyMemory API (free, no key): batch first, then one-by-one for rest
  let missing = Object.keys(merged).filter((k) => merged[k] === '—');
  if (missing.length > 0) {
    console.log(`Translating ${missing.length} remaining words via MyMemory (batch)...`);
    const apiTranslations = await translateBatchMyMemory(missing, 300);
    let apiFilled = 0;
    for (const key of missing) {
      if (apiTranslations.has(key)) {
        merged[key] = apiTranslations.get(key);
        apiFilled++;
      }
    }
    if (apiFilled) console.log(`Translated ${apiFilled} words via MyMemory batch`);
    missing = Object.keys(merged).filter((k) => merged[k] === '—');
    if (missing.length > 0) {
      console.log(`Translating ${missing.length} remaining words (LibreTranslate + MyMemory)...`);
      let oneByOneFilled = 0;
      for (const key of missing.slice(0, 300)) {
        const tr = await translateOneWord(key);
        if (tr) {
          merged[key] = tr;
          oneByOneFilled++;
        }
        await new Promise((r) => setTimeout(r, 250));
      }
      if (oneByOneFilled) console.log(`Translated ${oneByOneFilled} words via API (one-by-one)`);
    }
  }

  // Apply IT-curated overrides (fixes e.g. length -> длина, core -> ядро)
  for (const key of Object.keys(merged)) {
    const k = key.toLowerCase();
    if (itCurated[k]) merged[key] = itCurated[k];
  }
  // Inject IT-curated keys that are missing (e.g. breakin, transcript variants)
  for (const [key, tr] of Object.entries(itCurated)) {
    if (!(key in merged) && tr && tr !== '—') merged[key] = tr;
  }

  // Normalize long ALL-CAPS translations to sentence case (keep short acronyms like ИИ)
  for (const key of Object.keys(merged)) {
    const v = merged[key];
    if (v != null && v !== '—' && v.length > 3 && v === v.toUpperCase()) merged[key] = normalizeRu(v);
  }

  const withTranslation = Object.values(merged).filter((v) => v != null && v !== '—').length;
  fs.writeFileSync(dictPath, JSON.stringify(merged));
  console.log(`Dictionary built: ${Object.keys(merged).length} words, ${withTranslation} with Russian translation`);
}

main().catch(console.error);
