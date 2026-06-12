/**
 * 청크 복습(SRS) 로직 — chunks.review_count / last_reviewed_at 기반 Leitner 방식.
 * (flashcards 의 SM-2 와 달리 청크 테이블엔 ease/interval 컬럼이 없어 단계별 고정 간격을 쓴다.)
 */

import type { Chunk, TablesUpdate } from "@nativo/core";

/** 복습 화면에 필요한 청크 필드. */
export type StudyChunk = Pick<
  Chunk,
  | "id"
  | "expression"
  | "translation_ko"
  | "situation"
  | "nuance"
  | "example_1"
  | "example_2"
  | "category"
  | "language"
  | "level"
  | "review_count"
  | "last_reviewed_at"
  | "source"
>;

export const STUDY_CHUNK_COLUMNS =
  "id, expression, translation_ko, situation, nuance, example_1, example_2, category, language, level, review_count, last_reviewed_at, source";

/** 숙지 기준: 복습 횟수. 이 값 이상이면 '학습 완료'. */
export const CHUNK_COMPLETE_THRESHOLD = 5;

// Leitner 간격(일): review_count 단계별 다음 복습까지의 간격.
const SCHEDULE_DAYS = [1, 2, 4, 7, 14, 30, 60];

/** 다음 복습 도래 시각(ms). 한 번도 안 했으면 0(=지금 due). */
export function chunkDueAt(reviewCount: number, lastReviewedAt: string | null): number {
  if (!lastReviewedAt) return 0;
  const days = SCHEDULE_DAYS[Math.min(reviewCount, SCHEDULE_DAYS.length - 1)] ?? 60;
  return new Date(lastReviewedAt).getTime() + days * 86400000;
}

export function isChunkDue(c: {
  review_count: number;
  last_reviewed_at: string | null;
}): boolean {
  return chunkDueAt(c.review_count, c.last_reviewed_at) <= Date.now();
}

/** 복습 1회 반영 — 횟수 +1, 마지막 복습 시각 갱신. */
export function chunkReviewUpdate(reviewCount: number): TablesUpdate<"chunks"> {
  return {
    review_count: reviewCount + 1,
    last_reviewed_at: new Date().toISOString(),
  };
}
