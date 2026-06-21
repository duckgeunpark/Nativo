/**
 * 단어 DB 출제(word-db.ts) 통합 테스트.
 * 실제 data/word-db/english.json 을 읽어 레벨 ±1 윈도우/제외/개수 제한을 검증한다.
 * (cwd = apps/web 기준으로 data/ 를 찾는다.)
 */

import { describe, it, expect } from "vitest";
import { nextNewWords, getWordDbPage, wordDbSize, lookupWordDb } from "./word-db";

const LEVEL_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

describe("word-db 데이터 존재", () => {
  it("영어 단어 DB가 비어있지 않다", () => {
    expect(wordDbSize("english")).toBeGreaterThan(0);
  });
});

describe("nextNewWords — 레벨 ±1 윈도우", () => {
  it("요청 개수를 넘지 않는다", () => {
    const out = nextNewWords("english", "A2", new Set(), 10);
    expect(out.length).toBeLessThanOrEqual(10);
  });

  it("난이도가 있는 단어는 레벨 ±1 범위 안에만 든다 (B1 → A2~B2)", () => {
    const center = LEVEL_ORDER.indexOf("B1");
    const allowed = new Set(LEVEL_ORDER.slice(center - 1, center + 2));
    const out = nextNewWords("english", "B1", new Set(), 50);
    for (const w of out) {
      if (w.difficulty) expect(allowed.has(w.difficulty)).toBe(true);
    }
  });

  it("exclude 에 든 단어는 제외된다", () => {
    const first = nextNewWords("english", "A2", new Set(), 1);
    if (first.length === 0) return; // 데이터 없으면 skip
    const excluded = new Set([first[0]!.word.toLowerCase()]);
    const out = nextNewWords("english", "A2", excluded, 20);
    expect(out.some((w) => w.word.toLowerCase() === first[0]!.word.toLowerCase())).toBe(false);
  });

  it("count<=0 이면 빈 배열", () => {
    expect(nextNewWords("english", "A2", new Set(), 0)).toEqual([]);
  });
});

describe("getWordDbPage", () => {
  it("페이지 크기를 넘지 않고 total 을 함께 돌려준다", () => {
    const page = getWordDbPage("english", { page: 1, pageSize: 5 });
    expect(page.words.length).toBeLessThanOrEqual(5);
    expect(page.total).toBeGreaterThanOrEqual(page.words.length);
  });
});

describe("lookupWordDb", () => {
  it("빈 문자열은 null", () => {
    expect(lookupWordDb("english", "   ")).toBeNull();
  });
});
