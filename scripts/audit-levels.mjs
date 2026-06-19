// 단어/청크 DB 레벨 검수 후 재배치 (v4 §6).
//
// 단어 DB(word-db)는 "빈도순"으로 정렬돼 있다(앞쪽 = 더 흔한 단어).
// 따라서 단어의 빈도 순위(rank)로 기대 CEFR 레벨을 도출할 수 있고,
// LLM이 매긴 difficulty 가 기대치에서 TOLERANCE(기본 2)밴드 넘게 벗어나면
// "명백히 맞지 않는 항목"으로 보고 기대 밴드 가장자리로 스냅(snap)한다.
// (LLM 라벨을 존중하되, 흔한 단어가 C1/C2거나 희귀 단어가 A1인 명백한 이상치만 정리)
//
// 또한 일본어 DB에 CEFR 컬럼인데 JLPT(N1~N5)로 잘못 들어간 항목을 CEFR로 정규화한다.
//
// 청크 DB(chunk-db)는 빈도순이 아니므로 레벨 유효성(CEFR 여부)만 검수한다.
//
// 실행: node scripts/audit-levels.mjs            (덮어쓰기)
//       node scripts/audit-levels.mjs --dry-run  (변경만 출력, 저장 안 함)

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url)) + "/..";
const WORD_DIR = `${ROOT}/apps/web/data/word-db`;
const CHUNK_DIR = `${ROOT}/apps/web/data/chunk-db`;
const LANGS = ["english", "spanish", "japanese"];
const DRY = process.argv.includes("--dry-run");
const TOLERANCE = Number(process.env.TOLERANCE ?? 2); // 허용 편차(밴드)

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const idx = (lv) => LEVELS.indexOf(lv);

// JLPT → CEFR 대응 (대략적 등가)
const JLPT_TO_CEFR = { N5: "A1", N4: "A2", N3: "B1", N2: "B2", N1: "C1" };

// 빈도 순위(0-based) → 기대 CEFR 인덱스. (CEFR 어휘량 연구에 기반한 누적 경계)
function expectedLevelByRank(rank) {
  if (rank < 800) return 0; // A1
  if (rank < 1600) return 1; // A2
  if (rank < 3200) return 2; // B1
  if (rank < 5200) return 3; // B2
  if (rank < 7500) return 4; // C1
  return 5; // C2
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function dist(items, key) {
  const d = {};
  for (const it of items) {
    const k = it[key] ?? "NONE";
    d[k] = (d[k] ?? 0) + 1;
  }
  return LEVELS.map((l) => `${l}:${d[l] ?? 0}`).join(" ") +
    (d.NONE ? ` NONE:${d.NONE}` : "");
}

function auditWords(language) {
  const file = `${WORD_DIR}/${language}.json`;
  if (!existsSync(file)) return console.warn(`⚠️ ${file} 없음 — 건너뜀`);
  const words = JSON.parse(readFileSync(file, "utf8"));

  let normalized = 0; // JLPT → CEFR
  let snapped = 0; // 기대 밴드로 스냅
  let filled = 0; // 비어있던 difficulty 채움

  words.forEach((w, rank) => {
    let cur = w.difficulty;

    // 1) JLPT 정규화
    if (cur && JLPT_TO_CEFR[cur]) {
      cur = JLPT_TO_CEFR[cur];
      normalized++;
    }

    const e = expectedLevelByRank(rank);
    const ci = idx(cur);

    if (ci === -1) {
      // difficulty 없음/이상값 → 빈도 기대치로 채움
      w.difficulty = LEVELS[e];
      filled++;
      return;
    }

    // 2) 기대 밴드 ±TOLERANCE 밖이면 가장자리로 스냅
    const next = clamp(ci, Math.max(0, e - TOLERANCE), Math.min(5, e + TOLERANCE));
    if (next !== ci) snapped++;
    w.difficulty = LEVELS[next];
  });

  console.log(`\n[word-db/${language}] ${words.length}개`);
  console.log(`  정규화(JLPT→CEFR) ${normalized} · 스냅 ${snapped} · 채움 ${filled}`);
  console.log(`  분포: ${dist(words, "difficulty")}`);

  if (!DRY) writeFileSync(file, JSON.stringify(words));
  return normalized + snapped + filled;
}

function auditChunks(language) {
  const file = `${CHUNK_DIR}/${language}.json`;
  if (!existsSync(file)) return console.warn(`⚠️ ${file} 없음 — 건너뜀`);
  const chunks = JSON.parse(readFileSync(file, "utf8"));

  let invalid = 0;
  for (const c of chunks) {
    if (c.level && JLPT_TO_CEFR[c.level]) {
      c.level = JLPT_TO_CEFR[c.level];
      invalid++;
    } else if (c.level && idx(c.level) === -1) {
      c.level = null; // 알 수 없는 레벨 → 비움(레벨 무관 출제)
      invalid++;
    }
  }

  console.log(`\n[chunk-db/${language}] ${chunks.length}개 · 정리 ${invalid}`);
  console.log(`  분포: ${dist(chunks, "level")}`);
  if (!DRY && invalid > 0) writeFileSync(file, JSON.stringify(chunks));
  return invalid;
}

console.log(DRY ? "=== DRY RUN (저장 안 함) ===" : "=== 레벨 검수·재배치 ===");
for (const lang of LANGS) auditWords(lang);
for (const lang of LANGS) auditChunks(lang);
console.log("\n완료.");
