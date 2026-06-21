/**
 * 번역 평가 파서(ai-translate.ts) 단위 테스트.
 */

import { describe, it, expect } from "vitest";
import {
  parseTranslationEvaluation,
  buildTranslatePrompt,
  TRANSLATION_PASS_SCORE,
} from "./ai-translate";

describe("parseTranslationEvaluation", () => {
  it("점수를 합산하고 합격 판정", () => {
    const raw = JSON.stringify({
      score_accuracy: 38,
      score_naturalness: 28,
      score_nuance: 27,
      feedback: { good_points: ["자연스러움"], improvements: [] },
    });
    const ev = parseTranslationEvaluation(raw);
    expect(ev.score_total).toBe(93);
    expect(ev.passed).toBe(true);
  });

  it("범위를 벗어난 점수는 클램프", () => {
    const raw = JSON.stringify({
      score_accuracy: 999,
      score_naturalness: -5,
      score_nuance: 30,
    });
    const ev = parseTranslationEvaluation(raw);
    expect(ev.score_accuracy).toBe(40);
    expect(ev.score_naturalness).toBe(0);
    expect(ev.score_total).toBe(70);
    expect(ev.passed).toBe(false); // 70 < 80
  });

  it("잘못된 JSON 은 0점 + 빈 피드백", () => {
    const ev = parseTranslationEvaluation("garbage");
    expect(ev.score_total).toBe(0);
    expect(ev.passed).toBe(false);
    expect(ev.feedback.good_points).toEqual([]);
    expect(ev.feedback.improvements).toEqual([]);
  });

  it("improvements 의 불완전 항목은 버리고 최대 5개", () => {
    const improvements = Array.from({ length: 10 }, (_, i) => ({
      original: `o${i}`,
      recommended: `r${i}`,
      reason: "이유",
    }));
    improvements.push({ original: "", recommended: "x", reason: "y" });
    const ev = parseTranslationEvaluation(
      JSON.stringify({ score_accuracy: 10, feedback: { improvements } }),
    );
    expect(ev.feedback.improvements).toHaveLength(5);
  });

  it("합격선 상수와 일치", () => {
    const raw = JSON.stringify({
      score_accuracy: 40,
      score_naturalness: 30,
      score_nuance: 10,
    });
    const ev = parseTranslationEvaluation(raw);
    expect(ev.score_total).toBe(TRANSLATION_PASS_SCORE);
    expect(ev.passed).toBe(true); // 80 >= 80
  });
});

describe("buildTranslatePrompt", () => {
  it("언어 이름 포함", () => {
    expect(buildTranslatePrompt("japanese")).toContain("Japanese");
  });
});
