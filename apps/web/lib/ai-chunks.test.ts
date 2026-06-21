/**
 * 청크 AI 생성 파서(ai-chunks.ts) 단위 테스트.
 */

import { describe, it, expect } from "vitest";
import { parseGeneratedChunks, buildChunkGenPrompt } from "./ai-chunks";

describe("parseGeneratedChunks", () => {
  it("유효한 항목을 정규화한다", () => {
    const raw = JSON.stringify({
      chunks: [
        {
          expression: "Could you give me a hand?",
          translation_ko: "좀 도와줄래요?",
          situation: "도움을 요청할 때",
          nuance: "정중하고 일상적",
          example_1: "Could you give me a hand with this box?",
          example_2: "Hey, could you give me a hand?",
          category: "daily",
          level: "B1",
        },
      ],
    });
    const out = parseGeneratedChunks(raw);
    expect(out).toHaveLength(1);
    expect(out[0]!.expression).toBe("Could you give me a hand?");
    expect(out[0]!.category).toBe("daily");
  });

  it("잘못된 JSON 은 빈 배열", () => {
    expect(parseGeneratedChunks("not json")).toEqual([]);
  });

  it("expression/translation_ko 누락 항목은 버린다", () => {
    const raw = JSON.stringify({
      chunks: [
        { expression: "", translation_ko: "뜻" },
        { expression: "ok", translation_ko: "" },
        { expression: "valid", translation_ko: "유효" },
      ],
    });
    expect(parseGeneratedChunks(raw)).toHaveLength(1);
  });

  it("중복 expression 은 한 번만", () => {
    const raw = JSON.stringify({
      chunks: [
        { expression: "Same", translation_ko: "같음1" },
        { expression: "same", translation_ko: "같음2" },
      ],
    });
    expect(parseGeneratedChunks(raw)).toHaveLength(1);
  });

  it("잘못된 category/level 은 기본값으로 보정", () => {
    const raw = JSON.stringify({
      chunks: [{ expression: "x", translation_ko: "엑스", category: "weird", level: "Z9" }],
    });
    const out = parseGeneratedChunks(raw, "business");
    expect(out[0]!.category).toBe("business");
    expect(out[0]!.level).toBe("B1");
  });

  it("chunks 키가 없으면 빈 배열", () => {
    expect(parseGeneratedChunks(JSON.stringify({ items: [] }))).toEqual([]);
  });
});

describe("buildChunkGenPrompt", () => {
  it("상황·언어·레벨을 프롬프트에 포함", () => {
    const p = buildChunkGenPrompt("english", "공항에서 체크인", "A2");
    expect(p).toContain("English");
    expect(p).toContain("공항에서 체크인");
    expect(p).toContain("A2");
  });
});
