/**
 * 페이즈 조건 평가(phases.ts) 단위 테스트.
 */

import { describe, it, expect } from "vitest";
import {
  evaluatePhase,
  phaseConditionsSnapshot,
  type LearnerSignals,
} from "./phases";

/** 모든 신호 0 기본값 — 테스트에서 필요한 필드만 덮어쓴다. */
function signals(over: Partial<LearnerSignals> = {}): LearnerSignals {
  return {
    masteredWords: 0,
    masteredChunks: 0,
    currentStreak: 0,
    longestStreak: 0,
    studyDays: 0,
    shadowingCompleted: 0,
    readingCompleted: 0,
    journalCount: 0,
    roleplay: { count: 0, avgTotal: 0, avgFluency: 0, avgAccuracy: 0, avgVocab: 0, bestTotal: 0 },
    translation: { count: 0, passedCount: 0, avgTotal: 0, avgAccuracy: 0, avgNaturalness: 0, avgNuance: 0 },
    ...over,
  };
}

describe("evaluatePhase — Phase 1", () => {
  it("빈 신호면 아무 조건도 충족하지 않는다", () => {
    const e = evaluatePhase(signals(), 1);
    expect(e.total).toBe(4);
    expect(e.metCount).toBe(0);
    expect(e.allMet).toBe(false);
    expect(e.progressPct).toBe(0);
  });

  it("모든 조건을 채우면 allMet=true, progress=100", () => {
    const e = evaluatePhase(
      signals({ longestStreak: 14, masteredWords: 40, masteredChunks: 20, shadowingCompleted: 1 }),
      1,
    );
    expect(e.allMet).toBe(true);
    expect(e.metCount).toBe(4);
    expect(e.progressPct).toBe(100);
  });

  it("경계값: 목표 미만은 미충족, 목표 이상은 충족", () => {
    const below = evaluatePhase(signals({ longestStreak: 13, masteredWords: 40, masteredChunks: 20, shadowingCompleted: 1 }), 1);
    expect(below.allMet).toBe(false);
    const streak = below.conditions.find((c) => c.id === "streak")!;
    expect(streak.met).toBe(false);
    expect(streak.pct).toBe(93); // round(13/14*100)

    const at = evaluatePhase(signals({ longestStreak: 14, masteredWords: 40, masteredChunks: 20, shadowingCompleted: 1 }), 1);
    expect(at.conditions.find((c) => c.id === "streak")!.met).toBe(true);
  });

  it("pct 는 100 을 넘지 않는다", () => {
    const e = evaluatePhase(signals({ masteredWords: 9999, longestStreak: 200, masteredChunks: 999, shadowingCompleted: 9 }), 1);
    for (const c of e.conditions) expect(c.pct).toBeLessThanOrEqual(100);
  });
});

describe("evaluatePhase — 산출(output) 요구 페이즈", () => {
  it("Phase 3 은 roleplay 횟수/평균/유창성 + 번역 통과를 요구", () => {
    const almost = evaluatePhase(
      signals({
        masteredWords: 1000,
        masteredChunks: 250,
        roleplay: { count: 5, avgTotal: 70, avgFluency: 69, avgAccuracy: 80, avgVocab: 80, bestTotal: 90 },
        translation: { count: 3, passedCount: 3, avgTotal: 70, avgAccuracy: 70, avgNaturalness: 70, avgNuance: 70 },
      }),
      3,
    );
    // 유창성 69 < 70 하나만 부족
    expect(almost.allMet).toBe(false);
    expect(almost.conditions.find((c) => c.id === "roleplayFluency")!.met).toBe(false);

    const full = evaluatePhase(
      signals({
        masteredWords: 1000,
        masteredChunks: 250,
        roleplay: { count: 5, avgTotal: 70, avgFluency: 70, avgAccuracy: 80, avgVocab: 80, bestTotal: 90 },
        translation: { count: 3, passedCount: 3, avgTotal: 70, avgAccuracy: 70, avgNaturalness: 70, avgNuance: 70 },
      }),
      3,
    );
    expect(full.allMet).toBe(true);
  });
});

describe("phaseConditionsSnapshot", () => {
  it("조건 id → 현재값 스냅샷을 만든다", () => {
    const snap = phaseConditionsSnapshot(signals({ longestStreak: 14, masteredWords: 40, masteredChunks: 20, shadowingCompleted: 1 }), 1);
    expect(snap.streak).toBe(14);
    expect(snap.words).toBe(40);
    expect(snap.shadowing).toBe(1);
  });
});
