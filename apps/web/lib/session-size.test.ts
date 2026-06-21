/**
 * 회당 학습량 설정(session-size.ts) 단위 테스트.
 */

import { describe, it, expect } from "vitest";
import {
  clampSize,
  parseSessionCookie,
  SESSION_MIN,
  SESSION_MAX,
  SESSION_SIZE,
} from "./session-size";

describe("clampSize", () => {
  it("범위 내 값은 반올림만", () => {
    expect(clampSize(42.4, 60)).toBe(42);
    expect(clampSize(42.6, 60)).toBe(43);
  });

  it("하한/상한으로 클램프", () => {
    expect(clampSize(0, 60)).toBe(SESSION_MIN);
    expect(clampSize(99999, 60)).toBe(SESSION_MAX);
  });

  it("NaN/Infinity 는 기본값", () => {
    expect(clampSize(Number.NaN, 60)).toBe(60);
    expect(clampSize(Number.POSITIVE_INFINITY, 60)).toBe(60);
  });
});

describe("parseSessionCookie", () => {
  it("undefined 는 기본값", () => {
    expect(parseSessionCookie(undefined, 30)).toBe(30);
  });

  it("숫자 문자열은 클램프된 값", () => {
    expect(parseSessionCookie("45", 30)).toBe(45);
    expect(parseSessionCookie("1", 30)).toBe(SESSION_MIN);
  });

  it("비숫자 문자열은 기본값", () => {
    expect(parseSessionCookie("abc", 30)).toBe(30);
  });
});

describe("SESSION_SIZE 설정", () => {
  it("flashcard/chunk 기본값이 유효 범위 내", () => {
    expect(SESSION_SIZE.flashcard.default).toBeGreaterThanOrEqual(SESSION_MIN);
    expect(SESSION_SIZE.flashcard.default).toBeLessThanOrEqual(SESSION_MAX);
    expect(SESSION_SIZE.chunk.default).toBeGreaterThanOrEqual(SESSION_MIN);
    expect(SESSION_SIZE.chunk.default).toBeLessThanOrEqual(SESSION_MAX);
  });
});
