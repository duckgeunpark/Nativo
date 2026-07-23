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
import { listCachedWords } from "./dictionary-cache";

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

/** 언어별 소문자 단어 → SeedWord 색인 (반복 조회 캐시). */
const lookupCache = new Map<Language, Map<string, SeedWord>>();

function lookupIndex(language: Language): Map<string, SeedWord> {
  const cached = lookupCache.get(language);
  if (cached) return cached;
  const index = new Map<string, SeedWord>();
  for (const w of load(language)) {
    if (!w?.word || !w?.meaning) continue;
    const key = w.word.toLowerCase();
    if (!index.has(key)) index.set(key, w); // 첫(빈도 높은) 항목 우선
  }
  lookupCache.set(language, index);
  return index;
}

/**
 * 전체 사전(word-db)에서 단어를 정확히(대소문자 무시) 1건 조회.
 * 읽기 화면의 "사전 1차 검색" 출처 — 있으면 AI 보강을 건너뛴다.
 */
export function lookupWordDb(language: Language, word: string): SeedWord | null {
  const key = word.trim().toLowerCase();
  if (!key) return null;
  return lookupIndex(language).get(key) ?? null;
}

export interface WordDbPage {
  words: SeedWord[];
  total: number; // 필터 적용 후 개수(페이지네이션 기준)
  page: number;
  pageSize: number;
  grandTotal: number; // 필터 이전 전체 개수(정적 + 캐시)
}

interface PageOpts {
  query?: string;
  level?: CefrLevel | "all";
  page?: number;
  pageSize?: number;
}

/** 단어 목록에 검색·레벨 필터 + 페이지네이션 적용(정적/병합 공용). */
function filterAndPaginate(all: SeedWord[], opts: PageOpts): WordDbPage {
  const q = (opts.query ?? "").trim().toLowerCase();
  let filtered = q
    ? all.filter(
        (w) =>
          w.word.toLowerCase().includes(q) || w.meaning.toLowerCase().includes(q),
      )
    : all;
  if (opts.level && opts.level !== "all") {
    filtered = filtered.filter((w) => w.difficulty === opts.level);
  }

  const pageSize = opts.pageSize ?? 60;
  const page = Math.max(1, opts.page ?? 1);
  const start = (page - 1) * pageSize;

  return {
    words: filtered.slice(start, start + pageSize),
    total: filtered.length,
    page,
    pageSize,
    grandTotal: all.length,
  };
}

/**
 * 정적 word-db 목록(뜻 포함)만 검색 + 페이지네이션해서 반환(캐시 미포함).
 */
export function getWordDbPage(language: Language, opts: PageOpts = {}): WordDbPage {
  const all = load(language).filter((w) => w?.word && w?.meaning);
  return filterAndPaginate(all, opts);
}

/**
 * '전체 목록' 탭 출처 — 정적 word-db + dictionary_cache(DeepL/사전으로 찾은 단어) 합집합.
 * 정적 단어가 우선(중복 시 캐시 무시), 캐시 단어는 정적 뒤(빈도순 뒤)에 붙는다.
 * 캐시 단어는 CEFR 난이도가 없어 특정 레벨 필터에서는 제외되고 '전체 레벨'에서만 보인다.
 */
export async function getWordDbPageWithCache(
  language: Language,
  opts: PageOpts = {},
): Promise<WordDbPage> {
  const staticWords = load(language).filter((w) => w?.word && w?.meaning);
  const cached = await listCachedWords(language);

  const seen = new Set(staticWords.map((w) => w.word.toLowerCase()));
  const merged: SeedWord[] = [...staticWords];
  for (const c of cached) {
    const key = c.word.toLowerCase();
    if (seen.has(key)) continue; // 정적 사전에 있으면 캐시 무시
    seen.add(key);
    merged.push(c); // CachedSeedWord 는 SeedWord 와 구조 호환(difficulty 없음)
  }

  return filterAndPaginate(merged, opts);
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
