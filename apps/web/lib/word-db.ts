/**
 * 뜻 포함 단어 DB (자동 출제 소스). 서버 전용.
 * 데이터: data/word-db/{lang}.json (scripts/build-word-db.mjs 로 생성, 빈도순 SeedWord[])
 *
 * - import 대신 런타임 fs 읽기: 생성 중이거나 아직 없는 언어도 안전하게 [] 처리
 * - 동시 쓰기 중 부분 JSON 을 읽어도 try/catch 로 무시
 */

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import type { CefrLevel, Language } from "@nativo/core";

/** 뜻 포함 단어 1건 (data/word-db/{lang}.json 요소). */
export interface SeedWord {
  word: string;
  meaning: string; // 한국어 뜻
  meaning_en?: string; // 영영 뜻 (영어 카드)
  pronunciation?: string;
  example_1?: string;
  part_of_speech?: string;
  difficulty?: CefrLevel;
}

const LEVEL_ORDER: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

function load(language: Language): SeedWord[] {
  const file = path.join(process.cwd(), "data", "word-db", `${language}.json`);
  if (!existsSync(file)) return [];
  try {
    const data = JSON.parse(readFileSync(file, "utf8"));
    return Array.isArray(data) ? (data as SeedWord[]) : [];
  } catch {
    return []; // 생성 중 부분 쓰기 등
  }
}

export function wordDbSize(language: Language): number {
  return load(language).length;
}

export interface WordDbPage {
  words: SeedWord[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * word-db 전체 목록(뜻 포함)을 단어·뜻 검색 + 페이지네이션해서 반환.
 * '내 단어 사전' 의 "전체 단어" 탭 출처.
 */
export function getWordDbPage(
  language: Language,
  opts: { query?: string; page?: number; pageSize?: number } = {},
): WordDbPage {
  const all = load(language).filter((w) => w?.word && w?.meaning);
  const q = (opts.query ?? "").trim().toLowerCase();
  const filtered = q
    ? all.filter(
        (w) =>
          w.word.toLowerCase().includes(q) || w.meaning.toLowerCase().includes(q),
      )
    : all;

  const pageSize = opts.pageSize ?? 60;
  const page = Math.max(1, opts.page ?? 1);
  const start = (page - 1) * pageSize;

  return {
    words: filtered.slice(start, start + pageSize),
    total: filtered.length,
    page,
    pageSize,
  };
}

/**
 * 아직 학습하지 않은 단어를 레벨 ±1 우선, 빈도순으로 count개 반환.
 * @param exclude 이미 보유한 단어(소문자) 집합
 */
export function nextNewWords(
  language: Language,
  level: CefrLevel,
  exclude: Set<string>,
  count: number,
): SeedWord[] {
  if (count <= 0) return [];
  const all = load(language);
  const li = LEVEL_ORDER.indexOf(level);
  const allowed = new Set(
    LEVEL_ORDER.slice(Math.max(0, li - 1), li + 2), // 레벨 ±1
  );

  const result: SeedWord[] = [];
  for (const w of all) {
    if (result.length >= count) break;
    if (!w?.word || !w?.meaning) continue;
    if (exclude.has(w.word.toLowerCase())) continue;
    if (w.difficulty && !allowed.has(w.difficulty)) continue; // 난이도 없으면 통과
    result.push(w);
  }
  return result;
}
