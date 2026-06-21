/**
 * 영작 첨삭 파서(ai-writing.ts) 단위 테스트.
 */

import { describe, it, expect } from "vitest";
import { parseWritingFeedback, buildWritingPrompt, countWords } from "./ai-writing";

describe("parseWritingFeedback", () => {
  it("유효한 첨삭을 정규화한다", () => {
    const raw = JSON.stringify({
      summary: "전반적으로 좋아요!",
      corrections: [
        { original: "I goed", corrected: "I went", reason: "go의 과거형은 went" },
      ],
    });
    const fb = parseWritingFeedback(raw);
    expect(fb.summary).toBe("전반적으로 좋아요!");
    expect(fb.corrections).toHaveLength(1);
    expect(fb.corrections[0]!.corrected).toBe("I went");
  });

  it("잘못된 JSON 은 빈 피드백", () => {
    expect(parseWritingFeedback("xyz")).toEqual({ summary: "", corrections: [] });
  });

  it("original/corrected 누락 항목은 버린다", () => {
    const raw = JSON.stringify({
      summary: "s",
      corrections: [
        { original: "", corrected: "x", reason: "r" },
        { original: "a", corrected: "", reason: "r" },
        { original: "valid", corrected: "fixed", reason: "ok" },
      ],
    });
    expect(parseWritingFeedback(raw).corrections).toHaveLength(1);
  });

  it("corrections 가 배열이 아니면 빈 배열", () => {
    expect(parseWritingFeedback(JSON.stringify({ summary: "s" })).corrections).toEqual([]);
  });

  it("최대 8개로 제한", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      original: `o${i}`,
      corrected: `c${i}`,
      reason: "r",
    }));
    expect(parseWritingFeedback(JSON.stringify({ summary: "s", corrections: many })).corrections)
      .toHaveLength(8);
  });
});

describe("countWords", () => {
  it("공백 분할로 단어 수", () => {
    expect(countWords("hello   world  foo")).toBe(3);
    expect(countWords("  ")).toBe(0);
    expect(countWords("one")).toBe(1);
  });
});

describe("buildWritingPrompt", () => {
  it("언어 이름을 포함", () => {
    expect(buildWritingPrompt("spanish")).toContain("Spanish");
  });
});
