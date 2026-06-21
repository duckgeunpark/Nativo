/**
 * 플래시카드 SRS↔DB 매핑(flashcards.ts) 단위 테스트.
 */

import { describe, it, expect } from "vitest";
import { reviewUpdate, type StudyCard } from "./flashcards";

const baseCard: StudyCard = {
  id: "1",
  word: "hello",
  meaning: "안녕",
  meaning_en: null,
  pronunciation: null,
  example_1: null,
  example_2: null,
  part_of_speech: null,
  difficulty: "A1",
  language: "english",
  source: "curated",
  ease_factor: 2.5,
  interval_days: 0,
  repetitions: 0,
};

describe("reviewUpdate", () => {
  it("good 선택 시 정답 경로 페이로드를 만든다", () => {
    const u = reviewUpdate(baseCard, "good");
    expect(u.repetitions).toBe(1);
    expect(u.interval_days).toBe(1);
    expect(u.last_grade).toBe(4);
    expect(typeof u.next_review_at).toBe("string");
  });

  it("hard 선택 시 오답 경로(repetitions 0, interval 1)", () => {
    const advanced: StudyCard = { ...baseCard, repetitions: 3, interval_days: 15 };
    const u = reviewUpdate(advanced, "hard");
    expect(u.repetitions).toBe(0);
    expect(u.interval_days).toBe(1);
    expect(u.last_grade).toBe(2);
  });

  it("next_review_at 은 파싱 가능한 ISO 문자열", () => {
    const u = reviewUpdate(baseCard, "easy");
    expect(() => new Date(u.next_review_at as string).toISOString()).not.toThrow();
  });
});
