/**
 * SM-2(srs.ts) 단위 테스트.
 * 시간 의존성은 review(state, grade, now) 의 now 주입으로 제거한다.
 */

import { describe, it, expect } from "vitest";
import {
  review,
  choiceToGrade,
  initialSrsState,
  DEFAULT_EASE_FACTOR,
  MIN_EASE_FACTOR,
  type SrsState,
} from "./srs.js";

const FIXED_NOW = new Date("2026-06-21T00:00:00.000Z");

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

describe("initialSrsState", () => {
  it("기본값: ease 2.5, interval 0, repetitions 0", () => {
    expect(initialSrsState()).toEqual({
      easeFactor: DEFAULT_EASE_FACTOR,
      intervalDays: 0,
      repetitions: 0,
    });
  });
});

describe("choiceToGrade", () => {
  it("hard<3(다시), good=4, easy=5 로 매핑", () => {
    expect(choiceToGrade("hard")).toBe(2);
    expect(choiceToGrade("good")).toBe(4);
    expect(choiceToGrade("easy")).toBe(5);
  });
});

describe("review — 정답 경로(grade>=3)", () => {
  it("첫 정답: repetitions 1, interval 1일", () => {
    const r = review(initialSrsState(), 4, FIXED_NOW);
    expect(r.repetitions).toBe(1);
    expect(r.intervalDays).toBe(1);
    expect(daysBetween(FIXED_NOW, r.nextReviewAt)).toBe(1);
  });

  it("두 번째 정답: interval 6일", () => {
    const s1 = review(initialSrsState(), 4, FIXED_NOW);
    const s2 = review(s1, 4, FIXED_NOW);
    expect(s2.repetitions).toBe(2);
    expect(s2.intervalDays).toBe(6);
  });

  it("세 번째 정답: interval = round(이전 interval * ease)", () => {
    let s: SrsState = initialSrsState();
    const r1 = review(s, 4, FIXED_NOW); // interval 1
    const r2 = review(r1, 4, FIXED_NOW); // interval 6
    const r3 = review(r2, 4, FIXED_NOW); // 6 * ease
    expect(r3.intervalDays).toBe(Math.round(6 * r3.easeFactor));
    expect(r3.repetitions).toBe(3);
  });
});

describe("review — 오답 경로(grade<3)", () => {
  it("오답: repetitions 0 리셋, interval 1일 복귀", () => {
    const s1 = review(initialSrsState(), 5, FIXED_NOW);
    const s2 = review(s1, 5, FIXED_NOW); // 진행
    const fail = review(s2, 1, FIXED_NOW);
    expect(fail.repetitions).toBe(0);
    expect(fail.intervalDays).toBe(1);
  });
});

describe("review — ease_factor", () => {
  it("좋은 등급은 ease 유지/상승, 하한 1.3 미만으로 떨어지지 않음", () => {
    let s: SrsState = { easeFactor: MIN_EASE_FACTOR, intervalDays: 10, repetitions: 5 };
    const r = review(s, 0, FIXED_NOW); // 최악 등급
    expect(r.easeFactor).toBeGreaterThanOrEqual(MIN_EASE_FACTOR);
  });

  it("grade 5 반복 시 ease 가 증가한다", () => {
    const r = review(initialSrsState(), 5, FIXED_NOW);
    expect(r.easeFactor).toBeGreaterThan(DEFAULT_EASE_FACTOR);
  });

  it("lastGrade 가 입력 등급으로 기록된다", () => {
    expect(review(initialSrsState(), 3, FIXED_NOW).lastGrade).toBe(3);
  });
});
