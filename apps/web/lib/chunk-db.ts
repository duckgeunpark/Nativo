/**
 * 청크(의미덩어리) 학습 DB 로더. 서버 전용.
 * 데이터: data/chunk-db/{lang}.json (scripts/build-chunk-db.mjs 로 생성, SeedChunk[])
 *
 * - import 대신 런타임 fs 읽기: 생성 중이거나 아직 없는 언어도 안전하게 [] 처리
 * - 큰 배열이 클라이언트 번들에 들어가지 않도록 서버 컴포넌트/Route Handler 에서만 import
 */

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import type { CefrLevel, ChunkCategory, Language } from "@nativo/core";
import type { SeedChunk } from "./chunks";

function load(language: Language): SeedChunk[] {
  const file = path.join(process.cwd(), "data", "chunk-db", `${language}.json`);
  if (!existsSync(file)) return [];
  try {
    const data = JSON.parse(readFileSync(file, "utf8"));
    return Array.isArray(data) ? (data as SeedChunk[]) : [];
  } catch {
    return []; // 생성 중 부분 쓰기 등
  }
}

export function chunkDbSize(language: Language): number {
  return load(language).length;
}

const LEVEL_ORDER: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

/**
 * 아직 학습하지 않은 청크를 레벨 ±1 우선으로 count개 반환. (복습 세션 자동 보충용)
 * @param exclude 이미 보유한 청크 표현(소문자) 집합
 */
export function nextNewChunks(
  language: Language,
  level: CefrLevel,
  exclude: Set<string>,
  count: number,
): SeedChunk[] {
  if (count <= 0) return [];
  const all = load(language);
  const li = LEVEL_ORDER.indexOf(level);
  const allowed = new Set(LEVEL_ORDER.slice(Math.max(0, li - 1), li + 2));

  const result: SeedChunk[] = [];
  for (const c of all) {
    if (result.length >= count) break;
    if (!c?.expression || !c?.translation_ko) continue;
    if (exclude.has(c.expression.toLowerCase())) continue;
    if (c.level && !allowed.has(c.level)) continue;
    result.push(c);
  }
  return result;
}

export interface ChunkDbPage {
  chunks: SeedChunk[];
  total: number;
  page: number;
  pageSize: number;
}

/** 청크 전체 목록을 표현/뜻 검색 + 카테고리/레벨 필터 + 페이지네이션해서 반환. */
export function getChunkDbPage(
  language: Language,
  opts: {
    query?: string;
    category?: ChunkCategory | "all";
    level?: CefrLevel | "all";
    page?: number;
    pageSize?: number;
  } = {},
): ChunkDbPage {
  const all = load(language).filter((c) => c?.expression && c?.translation_ko);
  const q = (opts.query ?? "").trim().toLowerCase();
  const cat = opts.category ?? "all";
  const lv = opts.level ?? "all";

  const filtered = all.filter((c) => {
    if (cat !== "all" && c.category !== cat) return false;
    if (lv !== "all" && c.level !== lv) return false;
    if (
      q &&
      !c.expression.toLowerCase().includes(q) &&
      !c.translation_ko.toLowerCase().includes(q)
    )
      return false;
    return true;
  });

  const pageSize = opts.pageSize ?? 30;
  const page = Math.max(1, opts.page ?? 1);
  const start = (page - 1) * pageSize;

  return {
    chunks: filtered.slice(start, start + pageSize),
    total: filtered.length,
    page,
    pageSize,
  };
}
