// 단어 은행(빈도 단어) → 뜻 포함 단어 DB 생성 (Gemini로 한국어 뜻).
// 입력: apps/web/data/word-bank/{lang}.json (빈도순 string[])
// 출력: apps/web/data/word-db/{lang}.json (SeedWord[] — meaning/pronunciation/example/pos/difficulty)
//
// 실행 예:
//   GEMINI_API_KEY=... LANG=english LIMIT=2000 node scripts/build-word-db.mjs
//   (LANG=all 이면 세 언어 모두 / LIMIT 기본 2000 / BATCH 기본 40)
//   무료 키 발급: https://aistudio.google.com/apikey
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url)) + "/..";
const IN_DIR = `${ROOT}/apps/web/data/word-bank`;
const OUT_DIR = `${ROOT}/apps/web/data/word-db`;

const KEY = process.env.GEMINI_API_KEY;
// quota 소진 시 앞에서부터 차례로 폴백 (GEMINI_MODELS 로 덮어쓰기 가능)
const MODELS = (
  process.env.GEMINI_MODELS ??
  "gemini-3.1-flash-lite,gemini-2.5-flash,gemini-3.5-flash,gemini-3-flash-preview,gemini-2.5-flash-lite"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
let modelIdx = 0;
const LIMIT = Number(process.env.LIMIT ?? 10000);
const BATCH = Number(process.env.BATCH ?? 40);
const DELAY = Number(process.env.DELAY ?? 4000); // 무료 티어 RPM 여유
const LANGS =
  process.env.LANG && process.env.LANG !== "all"
    ? [process.env.LANG]
    : ["english", "spanish", "japanese"];

const LANG_NAME = { english: "English", spanish: "Spanish", japanese: "Japanese" };

// 강한 비속어 차단(이름/속어는 Gemini exclude 플래그로 추가 제거)
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
  console.error("❌ GEMINI_API_KEY 환경변수가 필요합니다. (https://aistudio.google.com/apikey)");
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

  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
  });

  // 현재 모델 → 503은 잠깐 대기 후 재시도, 429(quota 소진)는 다음 모델로 전환
  while (modelIdx < MODELS.length) {
    const model = MODELS[modelIdx];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${KEY}`;
    let overload = 0;
    let switched = false;
    while (!switched) {
      let res;
      try {
        res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          signal: AbortSignal.timeout(45000), // hang 방지
        });
      } catch {
        // 네트워크/타임아웃 → 503처럼 처리
        if (overload < 2) {
          overload++;
          await sleep(8000);
          continue;
        }
        console.warn(`\n  ⚠️ ${model} 네트워크/타임아웃 → 다음 모델로 전환`);
        modelIdx++;
        switched = true;
        continue;
      }
      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
        const parsed = JSON.parse(text);
        return Array.isArray(parsed.words) ? parsed.words : [];
      }
      if (res.status === 503 && overload < 2) {
        overload++;
        await sleep(8000);
        continue;
      }
      if (res.status === 429 || res.status === 503) {
        console.warn(`\n  ⚠️ ${model} ${res.status} → 다음 모델로 전환`);
        modelIdx++;
        switched = true;
      } else {
        throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 150)}`);
      }
    }
  }
  throw new Error("모든 폴백 모델 quota 소진");
}

async function build(language) {
  const inFile = `${IN_DIR}/${language}.json`;
  if (!existsSync(inFile)) {
    console.warn(`⚠️ ${inFile} 없음 — 건너뜀`);
    return;
  }
  mkdirSync(OUT_DIR, { recursive: true });
  const outFile = `${OUT_DIR}/${language}.json`;

  const allWords = JSON.parse(readFileSync(inFile, "utf8"))
    .slice(0, LIMIT)
    .filter((w) => !isBlocked(w)); // 비속어는 애초에 제외

  // 이어서 재개: 기존 결과 로드(빈/손상 파일은 무시) + 제외 단어 목록
  const readJson = (file, fallback) => {
    if (!existsSync(file)) return fallback;
    try {
      const t = readFileSync(file, "utf8").trim();
      return t ? JSON.parse(t) : fallback;
    } catch {
      return fallback;
    }
  };
  const exclFile = `${OUT_DIR}/${language}.excluded.json`;
  let out = readJson(outFile, []).filter((w) => w && w.word && !isBlocked(w.word));
  const excluded = new Set(readJson(exclFile, []));

  const done = new Set(out.map((w) => String(w.word).toLowerCase()));
  // 이미 했거나 제외된 단어는 다시 요청하지 않음
  const todo = allWords.filter(
    (w) => !done.has(w.toLowerCase()) && !excluded.has(w.toLowerCase()),
  );

  console.log(`\n[${language}] 목표 ${allWords.length} · 기존 ${out.length} · 제외 ${excluded.size} · 생성 대상 ${todo.length}`);
  writeFileSync(outFile, JSON.stringify(out, null, 0)); // 정리분 즉시 저장

  for (let i = 0; i < todo.length; i += BATCH) {
    const chunk = todo.slice(i, i + BATCH);
    try {
      const enriched = await enrichBatch(language, chunk);
      for (const w of enriched) {
        if (!w || !w.word || !w.meaning) continue;
        const key = String(w.word).toLowerCase();
        if (done.has(key)) continue; // 중복 제거
        if (w.exclude === true || isBlocked(w.word)) {
          excluded.add(key); // 비속어/속어/이름 → 제외 목록(재요청 방지)
          continue;
        }
        delete w.exclude; // 저장 데이터엔 플래그 제외
        done.add(key);
        out.push(w);
      }
      writeFileSync(outFile, JSON.stringify(out, null, 0)); // 증분 저장(중단돼도 보존)
      writeFileSync(exclFile, JSON.stringify([...excluded], null, 0));
      process.stdout.write(`\r${language}: ${out.length}/${allWords.length} [${MODELS[modelIdx]}]  `);
    } catch (e) {
      console.warn(`\n  배치 실패: ${e.message}`);
      if (/quota 소진/.test(e.message)) {
        console.warn(`  ⛔ 모든 모델 quota 소진 — 진행분 저장됨(${out.length}개). 나중에 같은 명령으로 이어서 실행하세요.`);
        return;
      }
    }
    await sleep(DELAY);
  }
  console.log(`\n✅ ${language}: ${out.length}개 → data/word-db/${language}.json`);
}

for (const lang of LANGS) {
  await build(lang);
}
