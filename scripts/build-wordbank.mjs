// 빈도 기반 단어 은행(word bank) 데이터 생성기.
// 출처: hermitdave/FrequencyWords (OpenSubtitles 빈도 리스트)
// 실행: node scripts/build-wordbank.mjs
// 결과: apps/web/data/word-bank/{english,spanish,japanese}.json  (빈도순 string[])
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = dirname(fileURLToPath(import.meta.url)) + "/../apps/web/data/word-bank";
const LIMIT = 10000;

const SOURCES = {
  english: "https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/en/en_50k.txt",
  spanish: "https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/es/es_50k.txt",
  japanese: "https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2016/ja/ja_50k.txt",
};

// 불용어(기능어) — 빈도 상위를 차지하지만 학습 가치가 낮아 제외
const STOPWORDS = {
  english: new Set("a an the and or but if of to in on at by for with about as i you he she it we they me him her us them my your his its our their this that these those is am are was were be been being do does did have has had having will would can could shall should may might must not no nor yes so than then there here what which who whom whose when where why how all any both each few more most other some such only own same very just too also well get got go goes went gone going s t m re ve ll d don dont cant cannot im ive id youre hes shes its were theyre wont didnt doesnt isnt arent wasnt werent couldnt wouldnt shouldnt aint gonna wanna gotta yeah ok okay oh hey huh hmm uh um mr mrs ms".split(" ")),
  spanish: new Set("de que no a la el en y es los se las un por con una su para lo como mas pero sus le ya o este si porque esta entre cuando muy sin sobre ser tiene tambien me hasta hay donde quien desde todo nos durante todos uno les ni contra otros ese eso ante ellos e esto mi antes algunos unos yo otro otras otra tanto esa estos mucho quienes nada muchos cual poco ella estar estas algunas algo nosotros mis tu te ti tus ellas os al del soy eres somos son fui fue ha han habia he has voy va vamos van lo qué está están estás sí más también cómo dónde cuándo quién él mí tú sólo aquí ahí allí así bien aún ése ésta esto eso vez aquel".split(" ")),
  japanese: new Set("する した して です ます ない いる ある れる られる この その あの こと もの それ これ あれ ため よう なる いう だ な に は を が と で も へ や か から まで より だけ でも しか こそ さん でしょ という ところ なん なに わけ 私 何 君 僕 俺 私たち あなた あなた達 そう こう ああ どう とても もう まだ また".split(" ")),
};

// 언어별 정제 필터 (노이즈/기능어/토큰화 찌꺼기 제거)
const KEEP = {
  english: (w) =>
    /^[a-z]+(?:['’-][a-z]+)*$/.test(w) && w.length >= 2 && !STOPWORDS.english.has(w),
  spanish: (w) =>
    /^[a-záéíóúñü]+$/.test(w) && w.length >= 2 && !STOPWORDS.spanish.has(w),
  japanese: (w) => {
    if (!/^[぀-ヿ一-鿿ー]+$/.test(w)) return false; // 일본어 문자만
    if (STOPWORDS.japanese.has(w)) return false;
    // 순수 히라가나 2자 이하 → 조사/문법 조각 가능성 높음 → 제외
    if (/^[぀-ゟ]+$/.test(w) && w.length <= 2) return false;
    return true;
  },
};

async function build(lang) {
  const res = await fetch(SOURCES[lang]);
  if (!res.ok) throw new Error(`${lang}: HTTP ${res.status}`);
  const text = await res.text();

  const seen = new Set();
  const words = [];
  for (const line of text.split("\n")) {
    const word = line.split(" ")[0]?.trim();
    if (!word || seen.has(word) || !KEEP[lang](word)) continue;
    seen.add(word);
    words.push(word);
    if (words.length >= LIMIT) break;
  }

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(`${OUT_DIR}/${lang}.json`, JSON.stringify(words));
  console.log(`✅ ${lang}: ${words.length}개 → data/word-bank/${lang}.json (예: ${words.slice(0, 5).join(", ")})`);
}

for (const lang of Object.keys(SOURCES)) {
  await build(lang).catch((e) => console.error(`❌ ${lang}:`, e.message));
}
