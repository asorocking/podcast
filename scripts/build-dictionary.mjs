/**
 * Builds dictionary.json with at least 5000 words.
 * Merges existing public/dictionary.json with words from Oxford 5000 + Google 20k.
 * Words without translation get "—" (shown as "нет в словаре" in the app).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dictPath = path.join(__dirname, '../public/dictionary.json');
const TARGET = 5500;

const existing = JSON.parse(fs.readFileSync(dictPath, 'utf8'));

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed: ${url}`);
  return res.text();
}

async function main() {
  let words = new Set(Object.keys(existing).map((w) => w.toLowerCase()));

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
    // Fallback: add common words from a small embedded list to reach ~5000
    const fallback = `the of and to a in for is on that by this with i you it not or be are from at as your all have new more an was we will home can us about if page my has search free but our one other do no information time they site he up may what which their news out use any there see only so his when contact here business who web also now help get view online first am been would how were me services some these click its like service than find price date back top people had list name just over state year day into email two health world next used go work last most products music buy data make them should product system post her city add policy number such please available copyright support message after best software then good video well where info rights public books high school through each links she review years order very privacy book items company read group need many user said set under general research university mail full map reviews program life know games way days management part could great united hotel real item international center store travel comments made development report off member details line terms before did send right type because local those using results office education national car design take posted internet address community within states area want phone shipping reserved subject between forum family long based code show even black check special prices website index being women much sign file link open today technology south case project same pages version section own found sports house related security both county american photo game members power while care network down computer systems three total place end following download him without per access think north resources current posts big media law control water history pictures size art personal since including guide shop directory board location change white text small rating rate government children during usa return students shopping account times sites level digital profile previous form events love old main call hours image department title description another shall property class still money quality every listing content country private little visit save tools low reply customer compare movies include college value article man card jobs provide food source author different press learn sale around print course job process teen room stock training too credit point join science men categories advanced west sales look english left team estate box conditions select windows photos thread week category note live large gallery table register however market library really action start series model features air industry plan human provided yes required second hot cost movie better say questions going medical test friend come study application staff articles feedback again play looking issues complete street topic comment financial things working against standard tax person below mobile less got blog party payment equipment login student let programs offers legal above recent park stores side act problem red give memory performance social flight congress fuel walk produced wait supported pocket freedom argument competition creating drugs joint premium providers fresh characters attorney upgrade factor growing thousands stream apartments pick hearing eastern therapy entries dates signed upper serious prime limit began steps errors shops efforts informed quantity urban practices sorted reporting essential platform load labor immediately admin nursing defense machines designated tags heavy covered recovery integrated configuration merchant comprehensive expert universal protect drop solid presentation languages became orange compliance vehicles prevent theme rich campaign marine improvement saying challenge acceptance strategies seem affairs touch intended towards branch charges serve reasons magic mount smart gave ones avoid certified manage corner rank element birth virus abuse interactive requests separate quarter procedure leadership tables define racing religious facts breakfast column plants faith chain developer identify avenue missing died approximately domestic recommendations moved reach comparison mental viewed moment extended sequence inch attack centers opening damage lab reserve produce snow placed truth counter failure follows weekend dollar camp films bridge native fill movement printing owned approval draft chart played contacts readers clubs equal adventure matching offering shirts profit leaders posters institutions assistant variable advertisement expect compared reality handling origin gaming destination technique contracts voting courts notices calculate strip typically representation exists arrangements smooth conferences sitting putting consultant controller committees legislative researchers trailer residence attorneys parameter adapter processor node formal dimensions contribute lock storm micro colleges mile showed challenges editors threads bowl brothers recognition presents tank submission estimate encourage kid regulatory inspection consumers cancel limits territory transaction weapons paint delay pilot outlet contributions continuous resulting initiative novel execution disability increases winner contractor episode examination dish plays bulletin modify adam truly painting committed extensive affordable universe candidate databases slot outstanding eating perspective planned watching lodge messenger mirror tournament consideration discounts sterling sessions kernel stocks buyers journals gray catalogue charged broad chosen demo labour terminal publishers nights liquid rice loop salary reservation foods guard properly saving remaining empire resume twenty newly raise prepare depending expansion vary hundreds helped premier tomorrow purchased milk decide consent drama visiting performing downtown keyboard contest collected bands boot suitable absolutely millions lunch audit push chamber findings muscle featuring scheduled polls typical tower yours sum calculator significantly chicken temporary attend shower sufficient province awareness governor beer contribution measurement spyware formula constitution packaging solar catch reliable consultation doubt earn finder unable classroom tasks attacks memorial visitor twin insert gateway alumni drawing ordered biological fighting transition happens preferences romance instrument split themes powers heaven bits pregnant twice focused physician bargain cellular asking blocks normally spiritual hunting diabetes suit shift chip bodies photographs cutting writers marks flexible favourites mapping numerous relatively birds satisfaction represents indexed superior preferred saved paying cartoon shots intellectual granted choices spending comfortable magnetic interaction listening effectively registry crisis outlook massive employed bright treat poverty formed piano echo grid sheets revolution consolidation displays plasma allowing earnings mystery landscape dependent mechanical journey bidding consultants risks applicant cooperation counties acquisition ports implemented directories recognized blogger notification licensing stands teach occurred textbooks rapid pull diversity reverse deposit seminar sensitive templates formats depends holds router concrete folder completion upload pulse specification accident accessible resident plot possibly airline typically representation regard pump exists arrangements smooth strike consumption sitting putting consultant controller ownership committees residence attorneys density parallel sustainable statistical beds mention innovation operators strange hundred amended operate bills bathroom stable definitions lesson cinema asset scan elections drinking reaction blank enhanced entitled severe generate stainless newspapers hospitals deluxe humor aged exception lived duration bulk successfully fabric visits primarily tight contrast recommendation flying recruitment organized adoption improving expensive meant capture pounds plane programmes desire mechanism camping jewellery meets welfare peer caught eventually marked driven measured bottle agreements considering innovative conclusion closing thousand meat legend grace python monster villa bone columns disorders collaboration detection cookies inner formation tutorial engineers entity gate holder proposals moderator settlement portugal duties valuable erotic tone ethics forever dragon busy captain fantastic imagine brings heating leg neck governments purchasing scripts appointed taste dealing commit tiny operational rail liberal trips gap sides tube turns corresponding descriptions cache belt jacket determination animation oracle`.split(/\s+/);
    fallback.forEach((w) => words.add(w.toLowerCase()));
  }

  const merged = { ...existing };
  const wordArray = [...words];
  for (let i = 0; i < wordArray.length && Object.keys(merged).length < TARGET; i++) {
    const key = wordArray[i];
    if (!(key in merged)) merged[key] = '—';
  }

  // If we still don't have 5000, add more from the same set
  let idx = 0;
  while (Object.keys(merged).length < TARGET && idx < wordArray.length) {
    const key = wordArray[idx++];
    if (!(key in merged)) merged[key] = '—';
  }

  fs.writeFileSync(dictPath, JSON.stringify(merged));
  console.log(`Dictionary built: ${Object.keys(merged).length} words`);
}

main().catch(console.error);
