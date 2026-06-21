/**
 * 청크 Leitner 복습(chunk-review.ts) 단위 테스트.
 * Date.now() 의존은 명시적 시각을 넣어 경계만 검증한다.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  chunkDueAt,
  isChunkDue,
  chunkReviewUpdate,
  chunkReviewUpdateGraded,
  CHUNK_COMPLETE_THRESHOLD,
} from "./chunk-review";

const DAY = 86400000;

afterEach(() => {
  vi.useRealTimers();
});

describe("chunkDueAt", () => {
  it("한 번도 복습 안 했으면 0(즉시 due)", () => {
    expect(chunkDueAt(0, null)).toBe(0);
  });

  it("review_count 0 → 1일 뒤 due", () => {
    const last = "2026-06-21T00:00:00.000Z";
    expect(chunkDueAt(0, last)).toBe(new Date(last).getTime() + 1 * DAY);
  });

  it("review_count 2 → 4일 뒤 due", () => {
    const last = "2026-06-21T00:00:00.000Z";
    expect(chunkDueAt(2, last)).toBe(new Date(last).getTime() + 4 * DAY);
  });

  it("스케줄 길이를 넘는 count 는 마지막 간격(60일)으로 클램프", () => {
    const last = "2026-06-21T00:00:00.000Z";
    expect(chunkDueAt(99, last)).toBe(new Date(last).getTime() + 60 * DAY);
  });
});

describe("isChunkDue", () => {
  it("미복습 청크는 항상 due", () => {
    expect(isChunkDue({ review_count: 0, last_reviewed_at: null })).toBe(true);
  });

  it("최근 복습한 청크는 아직 due 아님", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-21T12:00:00.000Z"));
    expect(
      isChunkDue({ review_count: 0, last_reviewed_at: "2026-06-21T00:00:00.000Z" }),
    ).toBe(false); // 1일 안 지남
  });

  it("간격이 지난 청크는 due", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-25T00:00:00.000Z"));
    expect(
      isChunkDue({ review_count: 0, last_reviewed_at: "2026-06-21T00:00:00.000Z" }),
    ).toBe(true); // 1일 간격 한참 지남
  });
});

describe("chunkReviewUpdate", () => {
  it("review_count 를 +1 하고 last_reviewed_at 을 ISO 로 기록", () => {
    const u = chunkReviewUpdate(3);
    expect(u.review_count).toBe(4);
    expect(typeof u.last_reviewed_at).toBe("string");
    expect(() => new Date(u.last_reviewed_at as string).toISOString()).not.toThrow();
  });
});

describe("chunkReviewUpdateGraded", () => {
  it("정답이면 횟수 +1", () => {
    expect(chunkReviewUpdateGraded(2, true).review_count).toBe(3);
  });

  it("오답이면 횟수 0으로 리셋", () => {
    expect(chunkReviewUpdateGraded(4, false).review_count).toBe(0);
  });

  it("정답/오답 모두 last_reviewed_at 갱신", () => {
    expect(typeof chunkReviewUpdateGraded(1, true).last_reviewed_at).toBe("string");
    expect(typeof chunkReviewUpdateGraded(1, false).last_reviewed_at).toBe("string");
  });
});

describe("CHUNK_COMPLETE_THRESHOLD", () => {
  it("숙지 기준이 양수로 정의됨", () => {
    expect(CHUNK_COMPLETE_THRESHOLD).toBeGreaterThan(0);
  });
});
