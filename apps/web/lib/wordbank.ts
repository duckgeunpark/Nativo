/**
 * 빈도 기반 단어 은행(word bank) — 언어별 상위 1만 단어.
 * 데이터: data/word-bank/{lang}.json (scripts/build-wordbank.mjs 로 생성)
 *
 * ⚠️ 서버 전용. 10k 배열이 클라이언트 번들에 들어가지 않도록
 *    서버 컴포넌트 / Route Handler 에서만 import 한다.
 *    (뜻/발음/예문은 저장하지 않고, 카드 추가 시 사전 API로 보강 — lib/dictionary.ts)
 */

import type { Language } from "@nativo/core";
import english from "../data/word-bank/english.json";
import spanish from "../data/word-bank/spanish.json";
import japanese from "../data/word-bank/japanese.json";

const BANKS: Record<Language, string[]> = {
  english: english as string[],
  spanish: spanish as string[],
  japanese: japanese as string[],
};

export interface WordBankPage {
  words: string[];
  total: number;
  page: number;
  pageSize: number;
}

/** 빈도순 단어 목록을 검색/페이지네이션해서 반환. */
export function getWordBankPage(
  language: Language,
  opts: { query?: string; page?: number; pageSize?: number } = {},
): WordBankPage {
  const all = BANKS[language] ?? [];
  const q = (opts.query ?? "").trim().toLowerCase();
  const filtered = q ? all.filter((w) => w.toLowerCase().includes(q)) : all;

  const pageSize = opts.pageSize ?? 60;
  const page = Math.max(1, opts.page ?? 1);
  const start = (page - 1) * pageSize;

  return { words: filtered.slice(start, start + pageSize), total: filtered.length, page, pageSize };
}

export function wordBankSize(language: Language): number {
  return (BANKS[language] ?? []).length;
}
