// 청크(의미덩어리) 학습 DB 생성/확장 — OpenAI(gpt-5.4-nano).
// 카테고리×레벨로 LLM 생성하되, 카테고리별 다양한 "세부 주제(subtopic)"를
// 프롬프트에 명시하고 기존 표현을 회피시켜 중복 없이 폭넓게 모은다.
// 출력: apps/web/data/chunk-db/{lang}.json (SeedChunk[])
//
// 실행 예:
//   OPENAI_API_KEY=... LANG=all NEW_PER=40 node scripts/build-chunk-db.mjs
//   (NEW_PER: 조합(카테고리×레벨)당 새로 추가할 목표 개수 / OPENAI_MODEL 로 모델 변경)
//   이어하기: data/chunk-db/{lang}.progress.json 에 끝낸 조합을 기록 → 재실행 시 건너뜀.
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url)) + "/..";
const OUT_DIR = `${ROOT}/apps/web/data/chunk-db`;

const KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL ?? "gpt-5.4-nano";
const NEW_PER = Number(process.env.NEW_PER ?? 40); // 조합당 새로 추가할 목표 개수
const DELAY = Number(process.env.DELAY ?? 400);
const LANGS =
  process.env.LANG && process.env.LANG !== "all"
    ? [process.env.LANG]
    : ["english", "spanish", "japanese"];

const LANG_NAME = { english: "English", spanish: "Spanish", japanese: "Japanese" };
const CATEGORIES = (process.env.CATEGORIES ?? "daily,business,travel,social").split(",");
const LEVELS = (process.env.LEVELS ?? "A1,A2,B1,B2,C1,C2").split(",");
const CATEGORY_DESC = {
  daily: "everyday casual conversation",
  business: "business / work / professional settings",
  travel: "travel (airport, hotel, restaurant, directions)",
  social: "socializing casually with friends",
};
// 카테고리별 세부 주제 — 다양성 확보용(프롬프트에 명시)
const SUBTOPICS = {
  daily:
    "greetings & small talk, feelings & emotions, food & eating, health & the body, weather & seasons, shopping & money, time & schedules, home & family, hobbies & free time, phone & messaging, asking for/offering help, opinions & preferences, directions, apologies & thanks, complaints",
  business:
    "meetings, emails & writing, negotiation, presentations, phone/video calls, scheduling & deadlines, giving/receiving feedback, networking & introductions, sales & clients, interviews & hiring, agreeing/disagreeing, reporting progress, problem solving, small talk at work",
  travel:
    "airport & flights, hotel & check-in, restaurants & ordering, transport & directions, sightseeing & tours, shopping abroad, emergencies & help, booking & reservations, customs & immigration, talking with locals, money & exchange",
  social:
    "making friends, invitations & plans, parties & gatherings, dating & romance, compliments, congratulations & celebrations, sharing news, social media & online, sports & games, saying goodbye, encouraging & comforting, opinions & debate",
};

const PROFANITY = new Set(
  (
    "fuck fucking shit bitch ass asshole dick cock pussy cunt bastard whore slut nigga nigger " +
    "mierda joder puta puto coño cabron gilipollas pendejo verga chinga pinche culo polla " +
    "くそ クソ ちくしょう 畜生 ばか 馬鹿 きさま てめえ"
  ).split(/\s+/),
);
const hasProfanity = (s) =>
  String(s).toLowerCase().split(/\s+/).some((w) => PROFANITY.has(w.replace(/[^a-z]/g, "")));

if (!KEY) {
  console.error("❌ OPENAI_API_KEY 환경변수가 필요합니다.");
  process.exit(1);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => String(s).trim().toLowerCase().replace(/\s+/g, " ").replace(/[.!?¿¡。、]+$/g, "");
const sample = (arr, n) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
};

async function genChunks(language, category, level, n, avoid) {
  const langName = LANG_NAME[language];
  const prompt = [
    `You are a bilingual phrasebook author for Korean learners of ${langName}.`,
    `Generate ${n} NEW, natural, commonly-used ${langName} "chunks"`,
    `(multi-word set phrases / collocations / useful expressions — NOT single words)`,
    `for ${CATEGORY_DESC[category] ?? category} at CEFR level ${level}.`,
    `Cover a VARIED range of subtopics such as: ${SUBTOPICS[category] ?? category}.`,
    `Every expression must be distinct.`,
    avoid.length
      ? `Do NOT repeat or closely paraphrase any of these existing expressions: ${JSON.stringify(avoid)}.`
      : ``,
    `For EACH: expression (in ${langName}), translation_ko (Korean meaning),`,
    `situation (Korean: when to use), nuance (Korean: tone/nuance),`,
    `example_1 and example_2 (natural ${langName} sentences using it).`,
    `Avoid profanity and vulgar slang.`,
    `Return ONLY JSON: {"chunks":[{"expression","translation_ko","situation","nuance","example_1","example_2"}]}.`,
  ]
    .filter(Boolean)
    .join(" ");

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
      const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
      return Array.isArray(parsed.chunks) ? parsed.chunks : [];
    }
    const body = await res.text();
    if (res.status === 429 && /insufficient_quota|exceeded your current quota/i.test(body)) {
      const err = new Error("quota 소진(insufficient_quota)");
      err.quota = true;
      throw err;
    }
    if ((res.status === 429 || res.status >= 500) && attempt++ < 5) {
      await sleep(Math.min(2000 * attempt, 15000));
      continue;
    }
    throw new Error(`OpenAI ${res.status}: ${body.slice(0, 180)}`);
  }
}

const readJson = (file, fb) => {
  if (!existsSync(file)) return fb;
  try {
    const t = readFileSync(file, "utf8").trim();
    return t ? JSON.parse(t) : fb;
  } catch {
    return fb;
  }
};

async function build(language) {
  mkdirSync(OUT_DIR, { recursive: true });
  const outFile = `${OUT_DIR}/${language}.json`;
  const progFile = `${OUT_DIR}/${language}.progress.json`;
  const out = readJson(outFile, []);
  const seen = new Set(out.map((c) => norm(c.expression)));
  const progress = new Set(readJson(progFile, []));

  const combos = [];
  for (const cat of CATEGORIES) for (const lv of LEVELS) combos.push([cat, lv]);
  const todo = combos.filter(([cat, lv]) => !progress.has(`${cat}|${lv}`));
  console.log(
    `\n[${language}] 기존 ${out.length}개 · 조합 ${combos.length}(남음 ${todo.length}) · 조합당 +${NEW_PER} · 모델 ${MODEL}`,
  );

  for (const [cat, lv] of todo) {
    // 같은 카테고리의 기존 표현 일부를 회피 목록으로 전달(중복 억제)
    const avoid = sample(
      out.filter((c) => c.category === cat).map((c) => c.expression),
      25,
    );
    try {
      const gen = await genChunks(language, cat, lv, NEW_PER, avoid);
      let added = 0;
      for (const c of gen) {
        if (!c || !c.expression || !c.translation_ko) continue;
        const key = norm(c.expression);
        if (seen.has(key) || hasProfanity(c.expression)) continue; // 중복/비속어 제외
        seen.add(key);
        out.push({
          expression: String(c.expression).trim(),
          translation_ko: String(c.translation_ko).trim(),
          situation: c.situation ?? undefined,
          nuance: c.nuance ?? undefined,
          example_1: c.example_1 ?? undefined,
          example_2: c.example_2 ?? undefined,
          category: cat,
          level: lv,
        });
        added++;
      }
      progress.add(`${cat}|${lv}`);
      writeFileSync(outFile, JSON.stringify(out, null, 0));
      writeFileSync(progFile, JSON.stringify([...progress], null, 0));
      process.stdout.write(`\r${language}: ${out.length}개 (${cat}/${lv} +${added}) [${MODEL}]   `);
    } catch (e) {
      if (e.quota) {
        console.warn(
          `\n  ⛔ OpenAI 한도/결제 소진 — 진행분 저장됨(${out.length}개). 결제 후 같은 명령으로 이어서 실행하세요.`,
        );
        return;
      }
      console.warn(`\n  ${cat}/${lv} 실패(건너뜀): ${e.message}`);
    }
    await sleep(DELAY);
  }
  // 완료 → 진행상황 sidecar 제거
  if (existsSync(progFile)) rmSync(progFile);
  console.log(`\n✅ ${language}: ${out.length}개 → data/chunk-db/${language}.json`);
}

for (const lang of LANGS) {
  await build(lang);
}
