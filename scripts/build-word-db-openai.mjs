// 단어 은행(빈도 단어) → 뜻 포함 단어 DB 생성 — OpenAI(gpt-5.4-nano) 버전.
// Gemini 무료 한도 소진 대비. 입출력·형식·이어하기·제외 로직은 build-word-db.mjs 와 동일.
//
// 실행 예:
//   OPENAI_API_KEY=... LANG=spanish node scripts/build-word-db-openai.mjs
//   (LANG=all 이면 세 언어 / LIMIT 기본 10000 / BATCH 기본 40 / OPENAI_MODEL 로 모델 변경)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url)) + "/..";
const IN_DIR = `${ROOT}/apps/web/data/word-bank`;
const OUT_DIR = `${ROOT}/apps/web/data/word-db`;

const KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL ?? "gpt-5.4-nano";
const LIMIT = Number(process.env.LIMIT ?? 10000);
const BATCH = Number(process.env.BATCH ?? 40);
const DELAY = Number(process.env.DELAY ?? 400);
const LANGS =
  process.env.LANG && process.env.LANG !== "all"
    ? [process.env.LANG]
    : ["english", "spanish", "japanese"];

const LANG_NAME = { english: "English", spanish: "Spanish", japanese: "Japanese" };

// 강한 비속어 차단(이름/속어는 모델 exclude 플래그로 추가 제거)
const PROFANITY = new Set(
  (
    "fuck fucking fucked fucker motherfucker shit bullshit bitch ass asshole arse dick cock pussy cunt " +
    "bastard whore slut fag faggot nigga nigger piss pissed wanker bollocks twat prick jerk " +
    "mierda joder puta puto coño cabron cabrón gilipollas pendejo verga chinga chingar pinche culo polla " +
    "くそ クソ ちくしょう 畜生 ばか馬鹿 きさま 貴様 てめえ"
  ).split(/\s+/),
);
const isBlocked = (w) => PROFANITY.has(String(w).toLowerCase());

if (!KEY) {
  console.error("❌ OPENAI_API_KEY 환경변수가 필요합니다.");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function enrichBatch(language, words) {
  const langName = LANG_NAME[language];
  const prompt = [
    `You are a bilingual lexicographer for Korean learners of ${langName}.`,
    `For EACH ${langName} word below, return: a concise Korean meaning (뜻),`,
    `pronunciation (${language === "japanese" ? "kana reading like かな (romaji)" : "IPA"}),`,
    `one short natural example sentence in ${langName},`,
    `part_of_speech (noun/verb/adjective/...), CEFR difficulty (A1~C2),`,
    `and "exclude": true if the word is profanity, vulgar slang, a person's name / proper noun, or not a standard dictionary word (else false).`,
    `Return ONLY JSON: {"words":[{"word","meaning","pronunciation","example_1","part_of_speech","difficulty","exclude"}]}.`,
    `Keep the same "word" spelling. Words:`,
    JSON.stringify(words),
  ].join(" ");

  // 429(rate limit)/503 은 잠깐 대기 후 재시도, 429 insufficient_quota 는 즉시 중단 신호
  let attempt = 0;
  while (true) {
    let res;
    try {
      res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(60000),
      });
    } catch (e) {
      if (attempt++ < 3) {
        await sleep(4000);
        continue;
      }
      throw new Error(`network/timeout: ${e.message}`);
    }

    if (res.ok) {
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(text);
      return Array.isArray(parsed.words) ? parsed.words : [];
    }

    const body = await res.text();
    // 결제/한도 소진 → 재시도 무의미, 상위로 신호
    if (res.status === 429 && /insufficient_quota|exceeded your current quota/i.test(body)) {
      const err = new Error("quota 소진(insufficient_quota)");
      err.quota = true;
      throw err;
    }
    if ((res.status === 429 || res.status >= 500) && attempt++ < 5) {
      await sleep(Math.min(2000 * attempt, 15000)); // 점증 백오프
      continue;
    }
    throw new Error(`OpenAI ${res.status}: ${body.slice(0, 180)}`);
  }
}

const readJson = (file, fallback) => {
  if (!existsSync(file)) return fallback;
  try {
    const t = readFileSync(file, "utf8").trim();
    return t ? JSON.parse(t) : fallback;
  } catch {
    return fallback;
  }
};

async function build(language) {
  const inFile = `${IN_DIR}/${language}.json`;
  if (!existsSync(inFile)) {
    console.warn(`⚠️ ${inFile} 없음 — 건너뜀`);
    return;
  }
  mkdirSync(OUT_DIR, { recursive: true });
  const outFile = `${OUT_DIR}/${language}.json`;
  const exclFile = `${OUT_DIR}/${language}.excluded.json`;

  const allWords = JSON.parse(readFileSync(inFile, "utf8"))
    .slice(0, LIMIT)
    .filter((w) => !isBlocked(w));

  let out = readJson(outFile, []).filter((w) => w && w.word && !isBlocked(w.word));
  const excluded = new Set(readJson(exclFile, []));
  const done = new Set(out.map((w) => String(w.word).toLowerCase()));
  const todo = allWords.filter(
    (w) => !done.has(w.toLowerCase()) && !excluded.has(w.toLowerCase()),
  );

  console.log(
    `\n[${language}] 목표 ${allWords.length} · 기존 ${out.length} · 제외 ${excluded.size} · 생성 대상 ${todo.length} · 모델 ${MODEL}`,
  );
  writeFileSync(outFile, JSON.stringify(out, null, 0));

  for (let i = 0; i < todo.length; i += BATCH) {
    const chunk = todo.slice(i, i + BATCH);
    try {
      const enriched = await enrichBatch(language, chunk);
      for (const w of enriched) {
        if (!w || !w.word || !w.meaning) continue;
        const key = String(w.word).toLowerCase();
        if (done.has(key)) continue;
        if (w.exclude === true || isBlocked(w.word)) {
          excluded.add(key);
          continue;
        }
        delete w.exclude;
        done.add(key);
        out.push(w);
      }
      writeFileSync(outFile, JSON.stringify(out, null, 0));
      writeFileSync(exclFile, JSON.stringify([...excluded], null, 0));
      process.stdout.write(`\r${language}: ${out.length}/${allWords.length} [${MODEL}]  `);
    } catch (e) {
      if (e.quota) {
        console.warn(
          `\n  ⛔ OpenAI 한도/결제 소진 — 진행분 저장됨(${out.length}개). 결제 활성화 후 같은 명령으로 이어서 실행하세요.`,
        );
        return;
      }
      console.warn(`\n  배치 실패(건너뜀): ${e.message}`);
    }
    await sleep(DELAY);
  }
  console.log(`\n✅ ${language}: ${out.length}개 → data/word-db/${language}.json`);
}

for (const lang of LANGS) {
  await build(lang);
}
