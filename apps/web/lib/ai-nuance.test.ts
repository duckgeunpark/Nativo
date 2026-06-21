/**
 * 뉘앙스 퀴즈 파서(ai-nuance.ts) 단위 테스트.
 */

import { describe, it, expect } from "vitest";
import { parseNuanceQuiz, buildNuancePrompt } from "./ai-nuance";

describe("parseNuanceQuiz", () => {
  it("유효한 문제를 정규화한다", () => {
    const raw = JSON.stringify({
      questions: [
        {
          prompt: "상사에게 정중히 부탁할 때",
          options: ["Gimme that", "Could you pass me that?", "Pass it"],
          answer: 1,
          explanation: "정중한 표현은 Could you...",
        },
      ],
    });
    const out = parseNuanceQuiz(raw);
    expect(out).toHaveLength(1);
    expect(out[0]!.answer).toBe(1);
    expect(out[0]!.options).toHaveLength(3);
  });

  it("options 가 2개 미만이면 버린다", () => {
    const raw = JSON.stringify({
      questions: [{ prompt: "p", options: ["only one"], answer: 0 }],
    });
    expect(parseNuanceQuiz(raw)).toHaveLength(0);
  });

  it("answer 가 범위를 벗어나면 버린다", () => {
    const raw = JSON.stringify({
      questions: [{ prompt: "p", options: ["a", "b"], answer: 5 }],
    });
    expect(parseNuanceQuiz(raw)).toHaveLength(0);
  });

  it("answer 문자열도 숫자로 처리", () => {
    const raw = JSON.stringify({
      questions: [{ prompt: "p", options: ["a", "b"], answer: "1", explanation: "e" }],
    });
    const out = parseNuanceQuiz(raw);
    expect(out).toHaveLength(1);
    expect(out[0]!.answer).toBe(1);
  });

  it("잘못된 JSON / questions 누락은 빈 배열", () => {
    expect(parseNuanceQuiz("nope")).toEqual([]);
    expect(parseNuanceQuiz(JSON.stringify({ x: 1 }))).toEqual([]);
  });
});

describe("buildNuancePrompt", () => {
  it("언어/레벨 포함", () => {
    const p = buildNuancePrompt("english", "B2");
    expect(p).toContain("English");
    expect(p).toContain("B2");
  });
});
