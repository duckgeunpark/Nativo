/**
 * DeepL 순수 헬퍼(엔드포인트 선택) 단위 테스트.
 * 네트워크 호출/쿠키 의존 함수(translateToKorean 등)는 통합 영역이라 제외.
 */

import { describe, it, expect } from "vitest";
import { deeplEndpoint, deeplUsageEndpoint } from "./deepl";

describe("deeplEndpoint — 키 종류별 엔드포인트", () => {
  it("무료 키(:fx)는 api-free 로 간다", () => {
    expect(deeplEndpoint("abc-123:fx")).toBe(
      "https://api-free.deepl.com/v2/translate",
    );
  });

  it("유료 키(:fx 아님)는 api 로 간다", () => {
    expect(deeplEndpoint("abc-123")).toBe("https://api.deepl.com/v2/translate");
  });

  it("앞뒤 공백이 있어도 :fx 를 인식한다", () => {
    expect(deeplEndpoint("  abc-123:fx  ")).toBe(
      "https://api-free.deepl.com/v2/translate",
    );
  });
});

describe("deeplUsageEndpoint — 검증용 엔드포인트", () => {
  it("무료 키는 api-free/usage", () => {
    expect(deeplUsageEndpoint("k:fx")).toBe("https://api-free.deepl.com/v2/usage");
  });

  it("유료 키는 api/usage", () => {
    expect(deeplUsageEndpoint("k")).toBe("https://api.deepl.com/v2/usage");
  });
});
