/**
 * 스킬 진단·보강 추천(skills.ts) 단위 테스트.
 */

import { describe, it, expect } from "vitest";
import { computeSkillProfile } from "./skills";
import type { LearnerSignals } from "./phases";

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

describe("computeSkillProfile", () => {
  it("점수를 0~100 으로 정규화한다", () => {
    const p = computeSkillProfile(signals({ masteredWords: 20 }), 1); // 목표 40 → 50점
    expect(p.skills.find((s) => s.id === "vocab")!.score).toBe(50);
    for (const s of p.skills) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(100);
    }
  });

  it("가장 약한 스킬을 추천한다 — 말하기만 0일 때", () => {
    // 나머지 스킬을 높이고 말하기만 비운다.
    const p = computeSkillProfile(
      signals({
        masteredWords: 40,
        masteredChunks: 20,
        shadowingCompleted: 5,
        readingCompleted: 3,
        currentStreak: 14,
        translation: { count: 1, passedCount: 1, avgTotal: 90, avgAccuracy: 90, avgNaturalness: 90, avgNuance: 90 },
        roleplay: { count: 0, avgTotal: 0, avgFluency: 0, avgAccuracy: 0, avgVocab: 0, bestTotal: 0 },
      }),
      1,
    );
    expect(p.weakest.id).toBe("speaking");
    expect(p.recommendation.href).toBe("/learn/roleplay");
    expect(p.recommendation.taskId).toBeUndefined(); // 말하기는 핵심 루틴 태스크가 아님
  });

  it("핵심 태스크 스킬이 약하면 taskId 로 강조 대상을 지정", () => {
    const p = computeSkillProfile(
      signals({
        masteredWords: 0, // 어휘 0점 → 최약
        masteredChunks: 20,
        shadowingCompleted: 5,
        readingCompleted: 3,
        currentStreak: 14,
        roleplay: { count: 5, avgTotal: 80, avgFluency: 80, avgAccuracy: 80, avgVocab: 80, bestTotal: 80 },
        translation: { count: 1, passedCount: 1, avgTotal: 80, avgAccuracy: 80, avgNaturalness: 80, avgNuance: 80 },
      }),
      1,
    );
    expect(p.weakest.id).toBe("vocab");
    expect(p.recommendation.taskId).toBe("flashcard_review");
  });

  it("동점(전부 0)이면 배열 앞선 어휘를 우선 추천", () => {
    const p = computeSkillProfile(signals(), 1);
    expect(p.weakest.id).toBe("vocab");
  });

  it("페이즈가 오르면 같은 숙달량이라도 어휘 점수가 낮아진다", () => {
    const p1 = computeSkillProfile(signals({ masteredWords: 300 }), 1).skills.find((s) => s.id === "vocab")!.score;
    const p3 = computeSkillProfile(signals({ masteredWords: 300 }), 3).skills.find((s) => s.id === "vocab")!.score;
    expect(p1).toBe(100); // 목표 40 → cap 100
    expect(p3).toBe(30); // 목표 1000 → 30
  });
});
